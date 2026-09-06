const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const db = new Database('data/zag.db');

// Get all products
const products = db.prepare('SELECT id, sku FROM products').all();
const skuMap = {};
products.forEach(p => { skuMap[p.sku] = p.id; });
console.log('Products in DB: ' + products.length);

// Read images from product_images_raw/
const srcDir = 'product_images_raw';
if (!fs.existsSync(srcDir)) {
  console.error('ERROR: ' + srcDir + ' not found. Upload images/ folder and rename to product_images_raw/');
  process.exit(1);
}

const destDir = 'uploads/products';
fs.mkdirSync(destDir, { recursive: true });

const insert = db.prepare(
  'INSERT INTO product_images (id, product_id, url, sort_order, label) VALUES (?, ?, ?, ?, ?)'
);

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
console.log('Images found: ' + files.length);

let done = 0;
let skipped = 0;

files.forEach(f => {
  // Extract ZG-F007A from p009_r1_c1_ZG-F007A.png
  const parts = f.replace('.png', '').split('_');
  const sku = parts.length >= 4 ? parts[3] : null;

  if (!sku || !skuMap[sku]) {
    if (sku && sku.startsWith('ZG-')) {
      console.log('No DB match: ' + f + ' (sku=' + sku + ')');
    }
    skipped++;
    return;
  }

  fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  const imgId = 'img_' + crypto.randomBytes(6).toString('hex');
  insert.run(imgId, skuMap[sku], '/uploads/products/' + f, 1, '');
  done++;
});

console.log('Linked: ' + done + ', Skipped: ' + skipped);
db.close();
