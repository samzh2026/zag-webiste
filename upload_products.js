// =============================================================================
// upload_products.js - Batch import products from JSON to SQLite database
// =============================================================================
// Usage: node upload_products.js <json_file>
// Example: node upload_products.js products_from_pdf_page_051_062.json
// =============================================================================

const fs = require('fs');
const path = require('path');

// Load store module
const store = require('./lib/store');

// Helper to parse dimensions like "124X43 X9mm" -> { length: 124, width: 43, thickness: 9 }
function parseDimensions(dimStr) {
  if (!dimStr) return {};
  // Remove 'mm' and extra spaces, normalize separators
  const cleaned = dimStr.replace(/mm/g, '').replace(/\s+/g, ' ').trim();
  // Try to extract numbers - take the first 3 distinct numbers
  const numbers = cleaned.match(/\d+\.?\d*/g);
  if (!numbers || numbers.length < 2) return {};
  return {
    length: parseFloat(numbers[0]) || null,
    width: parseFloat(numbers[1]) || null,
    thickness: parseFloat(numbers[2]) || null
  };
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || 'products_from_pdf_page_051_062.json';

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error('Usage: node upload_products.js <json_file>');
    process.exit(1);
  }

  let products;
  try {
    products = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(products)) {
    console.error('JSON must be an array of products');
    process.exit(1);
  }

  console.log(`Found ${products.length} products to import`);

  // Get existing SKUs to avoid duplicates
  const existingProducts = store.getProducts({ status: 'all' });
  const existingSkus = new Set(existingProducts.map(p => p.sku).filter(Boolean));
  console.log(`Database currently has ${existingProducts.length} products`);

  let created = 0;
  let skipped = 0;
  let errors = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const sku = (p.sku || '').trim();

    if (!sku) {
      console.log(`[${i + 1}/${products.length}] SKIPPED: No SKU`);
      skipped++;
      continue;
    }

    if (existingSkus.has(sku)) {
      console.log(`[${i + 1}/${products.length}] SKIPPED: SKU ${sku} already exists`);
      skipped++;
      continue;
    }

    try {
      const dims = parseDimensions(p.dimensions);

      const productData = {
        sku: sku,
        name: { en: p.name || `${sku} Brake Pad` },
        brand: p.brand || 'YONGLI',
        categoryId: p.categoryId || 'cat_brake_pad',
        material: { en: p.material || 'Semi-metallic' },
        description: { en: p.description || '' },
        specifications: {
          vehicleModels: p.vehicleModels || '',
          features: p.features || []
        },
        length: dims.length,
        width: dims.width,
        thickness: dims.thickness,
        status: p.status || 'published',
        sortOrder: p.sortOrder || 100
      };

      const createdProduct = store.createProduct(productData);
      existingSkus.add(sku);
      console.log(`[${i + 1}/${products.length}] CREATED: ${sku} (id: ${createdProduct.id})`);
      created++;

    } catch (e) {
      console.error(`[${i + 1}/${products.length}] ERROR: ${sku} - ${e.message}`);
      errors.push({ sku, error: e.message });
    }
  }

  console.log('\n========================================');
  console.log('Import Summary');
  console.log('========================================');
  console.log(`Total products in file: ${products.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.sku}: ${e.error}`));
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
