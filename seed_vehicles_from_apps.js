/**
 * seed_vehicles_from_apps.js
 * Parse APPLICATION data from products.csv and populate vehicle tables.
 * Usage: node seed_vehicles_from_apps.js products.csv
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const db = new Database('data/zag.db');

const csvPath = process.argv[2] || 'products.csv';
if (!fs.existsSync(csvPath)) {
  console.error('File not found: ' + csvPath);
  process.exit(1);
}
const csvText = fs.readFileSync(csvPath, 'utf-8');
const lines = csvText.split('\n');

const BRAND_MAP = {
  'KAWASAKI': 'Kawasaki', 'KAWASKI': 'Kawasaki',
  'HONDA': 'Honda',
  'YAMAHA': 'Yamaha', 'YAMHA': 'Yamaha',
  'SUZUKI': 'Suzuki', 'SUZUK': 'Suzuki',
  'KYMCO': 'KYMCO',
  'SYM': 'SYM',
  'POLARIS': 'Polaris',
  'CANAM': 'Can-Am', 'CAN AM': 'Can-Am',
  'BMW': 'BMW', 'KTM': 'KTM',
  'DUCATI': 'Ducati', 'TRIUMPH': 'Triumph',
  'HARLEY': 'Harley-Davidson', 'APRILIA': 'Aprilia',
  'PIAGGIO': 'Piaggio', 'VESPA': 'Vespa',
  'PEUGEOT': 'Peugeot', 'CPI': 'CPI', 'CSC': 'CSC',
  'BETTER': 'Better', 'ATV': 'ATV',
  'LONCIN': 'Loncin', 'LIFAN': 'Lifan', 'ZONGSHEN': 'Zongshen',
  'TOUMP': 'TOUMP', 'TOUME': 'TOUMP',
  'SAV': 'Suzuki', 'SUZUK': 'Suzuki',
};

const insertMake = db.prepare('INSERT OR IGNORE INTO vehicle_makes (id, name, slug) VALUES (?, ?, ?)');
const insertModel = db.prepare('INSERT OR IGNORE INTO vehicle_models (id, make_id, name, slug) VALUES (?, ?, ?, ?)');
const insertYear = db.prepare('INSERT OR IGNORE INTO vehicle_years (id, model_id, year) VALUES (?, ?, ?)');
const insertEngine = db.prepare('INSERT OR IGNORE INTO vehicle_engine_sizes (id, year_id, displacement) VALUES (?, ?, ?)');
const insertPV = db.prepare('INSERT OR IGNORE INTO product_vehicles (product_id, engine_size_id, position) VALUES (?, ?, ?)');

const makeCache = {};
const modelCache = {};
const yearCache = {};
const engineCache = {};

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function getOrCreateMake(name) {
  const canonical = BRAND_MAP[name.toUpperCase()] || name;
  const slug = slugify(canonical);
  if (makeCache[slug]) return makeCache[slug];
  let row = db.prepare('SELECT id FROM vehicle_makes WHERE slug = ?').get(slug);
  if (!row) {
    const id = 'make_' + crypto.randomBytes(4).toString('hex');
    insertMake.run(id, JSON.stringify({ en: canonical }), slug);
    row = { id };
  }
  makeCache[slug] = row.id;
  return row.id;
}

function getOrCreateModel(makeId, modelName) {
  const slug = slugify(modelName);
  const key = makeId + '::' + slug;
  if (modelCache[key]) return modelCache[key];
  let row = db.prepare('SELECT id FROM vehicle_models WHERE make_id = ? AND slug = ?').get(makeId, slug);
  if (!row) {
    const id = 'model_' + crypto.randomBytes(4).toString('hex');
    insertModel.run(id, makeId, JSON.stringify({ en: modelName }), slug);
    row = { id };
  }
  modelCache[key] = row.id;
  return row.id;
}

function getOrCreateYear(modelId, year) {
  const key = modelId + '::' + year;
  if (yearCache[key]) return yearCache[key];
  let row = db.prepare('SELECT id FROM vehicle_years WHERE model_id = ? AND year = ?').get(modelId, year);
  if (!row) {
    const id = 'year_' + crypto.randomBytes(4).toString('hex');
    insertYear.run(id, modelId, year);
    row = { id };
  }
  yearCache[key] = row.id;
  return row.id;
}

function getOrCreateEngine(yearId, displacement) {
  const key = yearId + '::' + displacement;
  if (engineCache[key]) return engineCache[key];
  let row = db.prepare('SELECT id FROM vehicle_engine_sizes WHERE year_id = ? AND displacement = ?').get(yearId, displacement);
  if (!row) {
    const id = 'engine_' + crypto.randomBytes(4).toString('hex');
    insertEngine.run(id, yearId, String(displacement));
    row = { id };
  }
  engineCache[key] = row.id;
  return row.id;
}

// Get all products
const products = db.prepare('SELECT id, sku FROM products').all();
const skuToId = {};
products.forEach(p => { skuToId[p.sku] = p.id; });

let parsed = 0;
let linked = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length < 9) continue;
  const zgCode = cols[1];
  const appsStr = cols[8];
  if (!zgCode || zgCode === '?') continue;
  if (!appsStr || !appsStr.trim()) continue;
  const productId = skuToId[zgCode];
  if (!productId) continue;

  const appLines = appsStr.split(/\s*\|\s*/);
  for (const appLine of appLines) {
    const trimmed = appLine.trim();
    if (!trimmed || trimmed.length < 5) continue;
    const words = trimmed.split(/\s+/);
    if (words.length < 2) continue;

    const brandName = words[0].toUpperCase();
    const canonicalBrand = BRAND_MAP[brandName];
    if (!canonicalBrand) continue;
    const makeId = getOrCreateMake(canonicalBrand);

    // Position
    let position = 'F';
    for (let w = words.length - 1; w >= 0; w--) {
      const word = words[w].toUpperCase();
      if (word === 'F' || word === 'R' || word === 'F&R' || word === 'F/R') {
        position = word; break;
      }
    }

    // Year range
    let yearStart = null;
    for (let w = words.length - 1; w >= 0; w--) {
      const m = words[w].match(/^(\d{2})-(\d{2})$/);
      if (m) {
        yearStart = parseInt(m[1]) + (m[1] > 50 ? 1900 : 2000);
        break;
      }
    }

    // Engine CC
    let engineCC = null;
    for (const word of words) {
      const m = word.match(/^(\d{2,4})$/);
      if (m) {
        const cc = parseInt(m[1]);
        if (cc >= 50 && cc <= 2000) { engineCC = cc; break; }
      }
    }

    // Model name
    const modelWords = [];
    for (const word of words) {
      const upper = word.toUpperCase();
      if (upper === brandName) continue;
      if (word.match(/^\d{2,4}$/) && parseInt(word) >= 50) continue;
      if (upper === 'F' || upper === 'R' || upper === 'F&R' || upper === 'F/R') continue;
      if (word.match(/^\d{2}-\d{2}$/)) continue;
      modelWords.push(word);
    }
    const modelName = modelWords.join(' ');
    if (!modelName) continue;

    const modelId = getOrCreateModel(makeId, modelName);
    const yr = yearStart || 2000;
    const yearId = getOrCreateYear(modelId, yr);
    const displacement = engineCC ? String(engineCC) : '0';
    const engineId = getOrCreateEngine(yearId, displacement);
    insertPV.run(productId, engineId, position);
    linked++;
  }
  parsed++;
}

console.log('Parsed: ' + parsed + ' products');
console.log('Linked: ' + linked + ' product-vehicle records');
console.log('Makes: ' + db.prepare('SELECT COUNT(*) as c FROM vehicle_makes').get().c);
console.log('Models: ' + db.prepare('SELECT COUNT(*) as c FROM vehicle_models').get().c);
console.log('Years: ' + db.prepare('SELECT COUNT(*) as c FROM vehicle_years').get().c);
console.log('Engines: ' + db.prepare('SELECT COUNT(*) as c FROM vehicle_engine_sizes').get().c);
db.close();
