// =============================================================================
// lib/store.js - SQLite Data Access Layer
// =============================================================================
// Provides atomic CRUD operations for all entities.
// SQLite handles concurrency natively via file-level locking.
// Multi-language fields are stored as JSON text (e.g. '{"en":"Brake Pads"}').
// =============================================================================

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(process.cwd(), "data", "zag.db");
const LEGACY_JSON = path.join(process.cwd(), "data", "db.json");

let db; // singleton

// --------------- Database Initialization ---------------

function initDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");       // better concurrent read performance
  db.pragma("foreign_keys = ON");
  createTables();
  migrateFromLegacyJson();
  return db;
}

function createTables() {
  db.exec(`
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '{}',
      description TEXT DEFAULT '{}',
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 100,
      seo_title TEXT DEFAULT '{}',
      seo_desc TEXT DEFAULT '{}',
      seo_keywords TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT '{}',
      brand TEXT DEFAULT '',
      category_id TEXT,
      material TEXT DEFAULT '{}',
      description TEXT DEFAULT '{}',
      specifications TEXT DEFAULT '{}',
      length REAL,
      width REAL,
      thickness REAL,
      status TEXT DEFAULT 'published',
      sort_order INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Product Images
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      label TEXT DEFAULT '',
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Product Downloads
    CREATE TABLE IF NOT EXISTS product_downloads (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT DEFAULT 'datasheet',
      label TEXT DEFAULT '{}',
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Cross References (OEM/EBC/SBS/Vesrah mappings)
    CREATE TABLE IF NOT EXISTS cross_references (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      ref_type TEXT NOT NULL,
      ref_number TEXT NOT NULL,
      brand TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cr_number ON cross_references(ref_number);
    CREATE INDEX IF NOT EXISTS idx_cr_type ON cross_references(ref_type);

    -- Vehicle hierarchy (4 levels)
    CREATE TABLE IF NOT EXISTS vehicle_makes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '{}',
      slug TEXT NOT NULL UNIQUE,
      logo TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS vehicle_models (
      id TEXT PRIMARY KEY,
      make_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '{}',
      slug TEXT NOT NULL,
      sort_order INTEGER DEFAULT 100,
      FOREIGN KEY (make_id) REFERENCES vehicle_makes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_years (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_engine_sizes (
      id TEXT PRIMARY KEY,
      year_id TEXT NOT NULL,
      displacement TEXT NOT NULL,
      engine_type TEXT DEFAULT '',
      FOREIGN KEY (year_id) REFERENCES vehicle_years(id) ON DELETE CASCADE
    );

    -- Product-Vehicle junction (many-to-many with Position)
    CREATE TABLE IF NOT EXISTS product_vehicles (
      product_id TEXT NOT NULL,
      engine_size_id TEXT NOT NULL,
      position TEXT NOT NULL,
      notes TEXT DEFAULT '',
      PRIMARY KEY (product_id, engine_size_id, position),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (engine_size_id) REFERENCES vehicle_engine_sizes(id) ON DELETE CASCADE
    );

    -- Blog
    CREATE TABLE IF NOT EXISTS blog (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '{}',
      slug TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '{}',
      excerpt TEXT DEFAULT '{}',
      image TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      author_id TEXT,
      seo_title TEXT DEFAULT '{}',
      seo_desc TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    -- SEO
    CREATE TABLE IF NOT EXISTS seo (
      page_path TEXT PRIMARY KEY,
      title TEXT DEFAULT '{}',
      description TEXT DEFAULT '{}',
      keywords TEXT DEFAULT '{}'
    );

    -- Settings (key-value)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
}

// --------------- Legacy Migration ---------------

function migrateFromLegacyJson() {
  if (!fs.existsSync(LEGACY_JSON)) return;
  const raw = fs.readFileSync(LEGACY_JSON, "utf8");
  // strip BOM if present
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  let legacy;
  try { legacy = JSON.parse(clean); } catch (e) { return; }

  const existing = db.prepare("SELECT COUNT(*) AS cnt FROM categories").get();
  if (existing.cnt > 0) return; // already migrated

  const now = () => new Date().toISOString();
  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (id, name, description, slug, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)"
  );
  const insertProduct = db.prepare(
    "INSERT OR IGNORE INTO products (id, sku, name, category_id, material, description, status, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  const insertImage = db.prepare(
    "INSERT OR IGNORE INTO product_images (id, product_id, url, sort_order) VALUES (?,?,?,?)"
  );

  const migrate = db.transaction(() => {
    (legacy.categories || []).forEach((c, i) => {
      const name = typeof c.name === "string" ? JSON.stringify({ en: c.name }) : JSON.stringify(c.name || {});
      const desc = typeof c.description === "string" ? JSON.stringify({ en: c.description || "" }) : JSON.stringify(c.description || {});
      insertCategory.run(c.id, name, desc, c.slug, c.sortOrder, c.createdAt, c.updatedAt);
    });

    (legacy.products || []).forEach((p) => {
      const name = typeof p.name === "string" ? JSON.stringify({ en: p.name }) : JSON.stringify(p.name || {});
      const mat = typeof p.material === "string" ? JSON.stringify({ en: p.material || "" }) : JSON.stringify(p.material || {});
      const desc = typeof p.description === "string" ? JSON.stringify({ en: p.description || "" }) : JSON.stringify(p.description || {});
      insertProduct.run(p.id, p.sku || null, name, p.categoryId || null, mat, desc, p.status || "published", p.sortOrder || 100, p.createdAt, p.updatedAt);

      // Migrate images
      const images = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
      images.forEach((url, idx) => {
        if (url) insertImage.run(`img_mig_${p.id}_${idx}`, p.id, url, idx);
      });
    });
  });

  try { migrate(); } catch (e) { /* migration already done or invalid */ }
}

// --------------- Helpers ---------------

function generateId(prefix = "id") {
  const { v4 } = require("uuid");
  return `${prefix}_${v4().replace(/-/g, "").slice(0, 12)}`;
}

function now() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Parse locale JSON field to object, with default
function parseLocale(raw, fallback = {}) {
  if (!raw) return typeof fallback === "string" ? { en: fallback } : fallback;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch (e) { return { en: String(raw) }; }
}

// Ensure locale field is stored as JSON string
function toLocaleStr(value) {
  if (!value) return "{}";
  if (typeof value === "string") {
    try { JSON.parse(value); return value; } catch (e) { return JSON.stringify({ en: value }); }
  }
  return JSON.stringify(value);
}

// =============================================================================
// Public API - Data Access Functions
// =============================================================================

// --- Categories ---

function getCategories() {
  return db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
}

function getCategoryById(id) {
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
}

function createCategory(data) {
  const id = data.id || generateId("cat");
  const slug = data.slug || slugify(data.name?.en || data.name || "");
  db.prepare(`
    INSERT INTO categories (id, name, description, slug, sort_order, seo_title, seo_desc, seo_keywords, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    toLocaleStr(data.name),
    toLocaleStr(data.description),
    slug,
    data.sortOrder || 100,
    toLocaleStr(data.seoTitle),
    toLocaleStr(data.seoDesc),
    toLocaleStr(data.seoKeywords),
    now(), now()
  );
  return getCategoryById(id);
}

function updateCategory(id, data) {
  const exists = getCategoryById(id);
  if (!exists) return null;
  const name = data.name !== undefined ? toLocaleStr(data.name) : exists.name;
  const desc = data.description !== undefined ? toLocaleStr(data.description) : exists.description;
  const slug = data.slug || slugify(data.name?.en || JSON.parse(name).en || "");
  db.prepare(`
    UPDATE categories SET name=?, description=?, slug=?, sort_order=?, seo_title=?, seo_desc=?, seo_keywords=?, updated_at=?
    WHERE id=?
  `).run(
    name, desc, slug,
    data.sortOrder ?? exists.sort_order,
    data.seoTitle !== undefined ? toLocaleStr(data.seoTitle) : exists.seo_title,
    data.seoDesc !== undefined ? toLocaleStr(data.seoDesc) : exists.seo_desc,
    data.seoKeywords !== undefined ? toLocaleStr(data.seoKeywords) : exists.seo_keywords,
    now(), id
  );
  return getCategoryById(id);
}

function deleteCategory(id) {
  const products = db.prepare("SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?").get(id);
  if (products.cnt > 0) return { error: "Move or delete products in this category first" };
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return { ok: true };
}

// --- Products ---

function getProducts(filters = {}) {
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (filters.status && filters.status !== "all") {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.categoryId) {
    sql += " AND category_id = ?";
    params.push(filters.categoryId);
  }
  sql += " ORDER BY sort_order ASC";
  return db.prepare(sql).all(...params);
}

function getProductById(id) {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) return null;
  product.images = db.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(id);
  product.downloads = db.prepare("SELECT * FROM product_downloads WHERE product_id = ?").all(id);
  product.crossRefs = db.prepare("SELECT * FROM cross_references WHERE product_id = ?").all(id);
  product.vehicles = db.prepare(`
    SELECT pv.*, ves.displacement, vy.year, vm.name AS model_name, vm.slug AS model_slug,
           vma.name AS make_name, vma.slug AS make_slug
    FROM product_vehicles pv
    JOIN vehicle_engine_sizes ves ON pv.engine_size_id = ves.id
    JOIN vehicle_years vy ON ves.year_id = vy.id
    JOIN vehicle_models vm ON vy.model_id = vm.id
    JOIN vehicle_makes vma ON vm.make_id = vma.id
    WHERE pv.product_id = ?
    ORDER BY vma.name, vm.name, vy.year, ves.displacement, pv.position
  `).all(id);
  return product;
}

function createProduct(data) {
  const id = data.id || generateId("prod");
  const sku = data.sku?.trim() || null;
  db.prepare(`
    INSERT INTO products (id, sku, name, brand, category_id, material, description, specifications,
      length, width, thickness, status, sort_order, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    sku,
    toLocaleStr(data.name),
    data.brand || "",
    data.categoryId || null,
    toLocaleStr(data.material),
    toLocaleStr(data.description),
    toLocaleStr(data.specifications),
    data.length || null,
    data.width || null,
    data.thickness || null,
    data.status || "published",
    data.sortOrder || 100,
    now(), now()
  );
  return getProductById(id);
}

function updateProduct(id, data) {
  const exists = getProductById(id);
  if (!exists) return null;
  db.prepare(`
    UPDATE products SET sku=?, name=?, brand=?, category_id=?, material=?, description=?,
      specifications=?, length=?, width=?, thickness=?, status=?, sort_order=?, updated_at=?
    WHERE id=?
  `).run(
    data.sku !== undefined ? (data.sku?.trim() || null) : exists.sku,
    data.name !== undefined ? toLocaleStr(data.name) : exists.name,
    data.brand !== undefined ? data.brand : exists.brand,
    data.categoryId !== undefined ? data.categoryId : exists.category_id,
    data.material !== undefined ? toLocaleStr(data.material) : exists.material,
    data.description !== undefined ? toLocaleStr(data.description) : exists.description,
    data.specifications !== undefined ? toLocaleStr(data.specifications) : exists.specifications,
    data.length !== undefined ? data.length : exists.length,
    data.width !== undefined ? data.width : exists.width,
    data.thickness !== undefined ? data.thickness : exists.thickness,
    data.status !== undefined ? data.status : exists.status,
    data.sortOrder !== undefined ? data.sortOrder : exists.sort_order,
    now(), id
  );
  return getProductById(id);
}

function deleteProduct(id) {
  // Images/downloads/crossRefs cascade-deleted via FK
  db.prepare("DELETE FROM product_vehicles WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  return { ok: true };
}

// --- Product Images ---

function addProductImage(productId, url, label = "") {
  const id = generateId("img");
  const maxOrder = db.prepare("SELECT MAX(sort_order) AS m FROM product_images WHERE product_id = ?").get(productId);
  db.prepare("INSERT INTO product_images (id, product_id, url, sort_order, label) VALUES (?,?,?,?,?)")
    .run(id, productId, url, (maxOrder.m || 0) + 1, label);
  return { id, url, sort_order: (maxOrder.m || 0) + 1 };
}

function removeProductImage(imageId) {
  db.prepare("DELETE FROM product_images WHERE id = ?").run(imageId);
}

// --- Product Downloads ---

function addProductDownload(productId, fileName, url, type = "datasheet", label = "{}") {
  const id = generateId("dl");
  db.prepare("INSERT INTO product_downloads (id, product_id, file_name, url, type, label) VALUES (?,?,?,?,?,?)")
    .run(id, productId, fileName, url, type, toLocaleStr(label));
  return { id, fileName, url, type };
}

function removeProductDownload(downloadId) {
  db.prepare("DELETE FROM product_downloads WHERE id = ?").run(downloadId);
}

// --- Cross References ---

function getCrossReferences(productId) {
  return db.prepare("SELECT * FROM cross_references WHERE product_id = ? ORDER BY ref_type, ref_number").all(productId);
}

function addCrossReference(productId, refType, refNumber, brand = "", notes = "") {
  const id = generateId("ref");
  db.prepare("INSERT INTO cross_references (id, product_id, ref_type, ref_number, brand, notes) VALUES (?,?,?,?,?,?)")
    .run(id, productId, refType, refNumber, brand, notes);
  return { id, productId, refType, refNumber, brand, notes };
}

function removeCrossReference(refId) {
  db.prepare("DELETE FROM cross_references WHERE id = ?").run(refId);
}

function searchByCrossReference(refNumber, refType) {
  let sql = "SELECT cr.*, p.sku, p.name FROM cross_references cr JOIN products p ON cr.product_id = p.id WHERE 1=1";
  const params = [];
  if (refType) { sql += " AND cr.ref_type = ?"; params.push(refType); }
  if (refNumber) {
    sql += " AND cr.ref_number LIKE ?";
    params.push("%" + refNumber + "%");
  }
  return db.prepare(sql).all(...params);
}

// --- Vehicle Hierarchy ---

function getMakes() {
  return db.prepare("SELECT * FROM vehicle_makes ORDER BY name ASC").all();
}

function createMake(data) {
  const id = data.id || generateId("vmake");
  db.prepare("INSERT INTO vehicle_makes (id, name, slug, logo, sort_order) VALUES (?,?,?,?,?)")
    .run(id, toLocaleStr(data.name), data.slug || slugify(JSON.parse(toLocaleStr(data.name)).en || ""), data.logo || "", data.sortOrder || 100);
  return db.prepare("SELECT * FROM vehicle_makes WHERE id = ?").get(id);
}

function updateMake(id, data) {
  const exists = db.prepare("SELECT * FROM vehicle_makes WHERE id = ?").get(id);
  if (!exists) return null;
  db.prepare("UPDATE vehicle_makes SET name=?, slug=?, logo=?, sort_order=? WHERE id=?")
    .run(data.name ? toLocaleStr(data.name) : exists.name, data.slug || exists.slug, data.logo ?? exists.logo, data.sortOrder ?? exists.sort_order, id);
  return db.prepare("SELECT * FROM vehicle_makes WHERE id = ?").get(id);
}

function deleteMake(id) {
  db.prepare("DELETE FROM vehicle_makes WHERE id = ?").run(id);
  return { ok: true };
}

function getModels(makeId) {
  return db.prepare("SELECT * FROM vehicle_models WHERE make_id = ? ORDER BY name ASC").all(makeId);
}

function createModel(data) {
  const id = data.id || generateId("vmod");
  db.prepare("INSERT INTO vehicle_models (id, make_id, name, slug, sort_order) VALUES (?,?,?,?,?)")
    .run(id, data.makeId, toLocaleStr(data.name), data.slug || slugify(JSON.parse(toLocaleStr(data.name)).en || ""), data.sortOrder || 100);
  return db.prepare("SELECT * FROM vehicle_models WHERE id = ?").get(id);
}

function updateModel(id, data) {
  const exists = db.prepare("SELECT * FROM vehicle_models WHERE id = ?").get(id);
  if (!exists) return null;
  db.prepare("UPDATE vehicle_models SET name=?, slug=?, sort_order=? WHERE id=?")
    .run(data.name ? toLocaleStr(data.name) : exists.name, data.slug || exists.slug, data.sortOrder ?? exists.sort_order, id);
  return db.prepare("SELECT * FROM vehicle_models WHERE id = ?").get(id);
}

function deleteModel(id) {
  db.prepare("DELETE FROM vehicle_models WHERE id = ?").run(id);
  return { ok: true };
}

function getYears(modelId) {
  return db.prepare("SELECT * FROM vehicle_years WHERE model_id = ? ORDER BY year ASC").all(modelId);
}

function createYear(data) {
  const id = data.id || generateId("vyr");
  db.prepare("INSERT INTO vehicle_years (id, model_id, year) VALUES (?,?,?)").run(id, data.modelId, data.year);
  return db.prepare("SELECT * FROM vehicle_years WHERE id = ?").get(id);
}

function updateYear(id, data) {
  const exists = db.prepare("SELECT * FROM vehicle_years WHERE id = ?").get(id);
  if (!exists) return null;
  db.prepare("UPDATE vehicle_years SET year=? WHERE id=?").run(data.year ?? exists.year, id);
  return db.prepare("SELECT * FROM vehicle_years WHERE id = ?").get(id);
}

function deleteYear(id) {
  db.prepare("DELETE FROM vehicle_years WHERE id = ?").run(id);
  return { ok: true };
}

function getEngineSizes(yearId) {
  return db.prepare("SELECT * FROM vehicle_engine_sizes WHERE year_id = ? ORDER BY displacement ASC").all(yearId);
}

function createEngineSize(data) {
  const id = data.id || generateId("ves");
  db.prepare("INSERT INTO vehicle_engine_sizes (id, year_id, displacement, engine_type) VALUES (?,?,?,?)")
    .run(id, data.yearId, data.displacement, data.engineType || "");
  return db.prepare("SELECT * FROM vehicle_engine_sizes WHERE id = ?").get(id);
}

function updateEngineSize(id, data) {
  const exists = db.prepare("SELECT * FROM vehicle_engine_sizes WHERE id = ?").get(id);
  if (!exists) return null;
  db.prepare("UPDATE vehicle_engine_sizes SET displacement=?, engine_type=? WHERE id=?")
    .run(data.displacement ?? exists.displacement, data.engineType ?? exists.engine_type, id);
  return db.prepare("SELECT * FROM vehicle_engine_sizes WHERE id = ?").get(id);
}

function deleteEngineSize(id) {
  db.prepare("DELETE FROM vehicle_engine_sizes WHERE id = ?").run(id);
  return { ok: true };
}

// --- Product-Vehicle Applications ---

function getApplications(productId) {
  return db.prepare(`
    SELECT pv.*, ves.displacement, vy.year, vm.name AS model_name, vm.slug AS model_slug,
           vma.name AS make_name, vma.slug AS make_slug
    FROM product_vehicles pv
    JOIN vehicle_engine_sizes ves ON pv.engine_size_id = ves.id
    JOIN vehicle_years vy ON ves.year_id = vy.id
    JOIN vehicle_models vm ON vy.model_id = vm.id
    JOIN vehicle_makes vma ON vm.make_id = vma.id
    WHERE pv.product_id = ?
    ORDER BY vma.name, vm.name, vy.year, ves.displacement, pv.position
  `).all(productId);
}

function addApplication(productId, engineSizeId, position, notes = "") {
  db.prepare("INSERT OR IGNORE INTO product_vehicles (product_id, engine_size_id, position, notes) VALUES (?,?,?,?)")
    .run(productId, engineSizeId, position, notes);
  return { productId, engineSizeId, position, notes };
}

function removeApplication(productId, engineSizeId, position) {
  db.prepare("DELETE FROM product_vehicles WHERE product_id = ? AND engine_size_id = ? AND position = ?")
    .run(productId, engineSizeId, position);
  return { ok: true };
}

/** Batch add: one product to multiple engineSizeIds with positions */
function batchAddApplications(productId, entries) {
  const insert = db.prepare("INSERT OR IGNORE INTO product_vehicles (product_id, engine_size_id, position, notes) VALUES (?,?,?,?)");
  const txn = db.transaction((items) => {
    for (const e of items) {
      insert.run(productId, e.engineSizeId, e.position || "Front", e.notes || "");
    }
  });
  txn(entries);
  return { ok: true, count: entries.length };
}

// --- Universal Search ---

function universalSearch(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const results = [];
  const seen = new Set();

  // 1. Exact SKU match
  const bySku = db.prepare("SELECT * FROM products WHERE sku = ? AND status = 'published'").all(q);
  for (const p of bySku) { if (!seen.has(p.id)) { seen.add(p.id); results.push({ matchType: "sku", product: enrichProduct(p) }); } }

  // 2. Cross-reference match
  const byRef = db.prepare(`
    SELECT DISTINCT p.*, cr.ref_type, cr.ref_number
    FROM cross_references cr JOIN products p ON cr.product_id = p.id
    WHERE cr.ref_number LIKE ? AND p.status = 'published'
    LIMIT 50
  `).all("%" + q + "%");
  for (const r of byRef) { if (!seen.has(r.id)) { seen.add(r.id); results.push({ matchType: "cross_reference", product: enrichProduct(r), refType: r.ref_type, refNumber: r.ref_number }); } }

  // 3. Product name fuzzy match
  const byName = db.prepare("SELECT * FROM products WHERE name LIKE ? AND status = 'published' LIMIT 30").all("%" + q + "%");
  for (const p of byName) { if (!seen.has(p.id)) { seen.add(p.id); results.push({ matchType: "product", product: enrichProduct(p) }); } }

  // 4. Vehicle match (make or model name)
  const vehicleProductRows = db.prepare(`
    SELECT DISTINCT p.*, vma.name AS make_name, vm.name AS model_name
    FROM vehicle_makes vma
    JOIN vehicle_models vm ON vm.make_id = vma.id
    JOIN vehicle_years vy ON vy.model_id = vm.id
    JOIN vehicle_engine_sizes ves ON ves.year_id = vy.id
    JOIN product_vehicles pv ON pv.engine_size_id = ves.id
    JOIN products p ON p.id = pv.product_id
    WHERE (vma.name LIKE ? OR vm.name LIKE ?) AND p.status = 'published'
    LIMIT 50
  `).all("%" + q + "%", "%" + q + "%");
  for (const r of vehicleProductRows) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      results.push({ matchType: "vehicle", product: enrichProduct(r), makeName: r.make_name, modelName: r.model_name });
    }
  }

  return results;
}

/** Dimension search with tolerance */
function searchByDimensions(length, width, thickness, tolerance = 1) {
  let sql = "SELECT * FROM products WHERE status = 'published'";
  const params = [];

  if (length !== undefined && length !== null && !isNaN(length)) {
    const t = tolerance || 1;
    sql += " AND length BETWEEN ? AND ?";
    params.push(length - t, length + t);
  }
  if (width !== undefined && width !== null && !isNaN(width)) {
    const t = tolerance || 1;
    sql += " AND width BETWEEN ? AND ?";
    params.push(width - t, width + t);
  }
  if (thickness !== undefined && thickness !== null && !isNaN(thickness)) {
    const t = tolerance || 1;
    sql += " AND thickness BETWEEN ? AND ?";
    params.push(thickness - t, thickness + t);
  }

  if (params.length === 0) return [];

  sql += " ORDER BY ABS(length - ?) + ABS(width - ?) + ABS(thickness - ?) ASC";
  params.push(length || 0, width || 0, thickness || 0);

  return db.prepare(sql).all(...params).map(enrichProduct);
}

// --- Blog ---

function getBlogPosts(filters = {}) {
  let sql = "SELECT * FROM blog WHERE 1=1";
  const params = [];
  if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
  sql += " ORDER BY created_at DESC";
  if (filters.limit) { sql += " LIMIT ?"; params.push(filters.limit); }
  if (filters.offset) { sql += " OFFSET ?"; params.push(filters.offset); }
  return db.prepare(sql).all(...params);
}

function getBlogBySlug(slug) {
  return db.prepare("SELECT * FROM blog WHERE slug = ? AND status = 'published'").get(slug);
}

function createBlogPost(data) {
  const id = data.id || generateId("blog");
  const slug = data.slug || slugify(JSON.parse(toLocaleStr(data.title)).en || "");
  db.prepare(`
    INSERT INTO blog (id, title, slug, content, excerpt, image, status, author_id, seo_title, seo_desc, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, toLocaleStr(data.title), slug, toLocaleStr(data.content), toLocaleStr(data.excerpt),
    data.image || "", data.status || "draft", data.authorId || null,
    toLocaleStr(data.seoTitle), toLocaleStr(data.seoDesc), now(), now());
  return db.prepare("SELECT * FROM blog WHERE id = ?").get(id);
}

function updateBlogPost(id, data) {
  const exists = db.prepare("SELECT * FROM blog WHERE id = ?").get(id);
  if (!exists) return null;
  db.prepare(`
    UPDATE blog SET title=?, slug=?, content=?, excerpt=?, image=?, status=?, seo_title=?, seo_desc=?, updated_at=? WHERE id=?
  `).run(
    data.title !== undefined ? toLocaleStr(data.title) : exists.title,
    data.slug || exists.slug,
    data.content !== undefined ? toLocaleStr(data.content) : exists.content,
    data.excerpt !== undefined ? toLocaleStr(data.excerpt) : exists.excerpt,
    data.image ?? exists.image,
    data.status ?? exists.status,
    data.seoTitle !== undefined ? toLocaleStr(data.seoTitle) : exists.seo_title,
    data.seoDesc !== undefined ? toLocaleStr(data.seoDesc) : exists.seo_desc,
    now(), id
  );
  return db.prepare("SELECT * FROM blog WHERE id = ?").get(id);
}

function deleteBlogPost(id) {
  db.prepare("DELETE FROM blog WHERE id = ?").run(id);
  return { ok: true };
}

// --- Users ---

function getUsers() {
  return db.prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC").all();
}

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function createUser(username, passwordHash, role = "admin") {
  const id = generateId("usr");
  db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)")
    .run(id, username, passwordHash, role, now());
  return { id, username, role };
}

function updateUserPassword(id, passwordHash) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

function deleteUser(id) {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return { ok: true };
}

// --- SEO ---

function getSeo(pagePath) {
  const row = db.prepare("SELECT * FROM seo WHERE page_path = ?").get(pagePath);
  return row || { page_path: pagePath, title: "{}", description: "{}", keywords: "{}" };
}

function upsertSeo(pagePath, data) {
  db.prepare(`
    INSERT INTO seo (page_path, title, description, keywords)
    VALUES (?,?,?,?) ON CONFLICT(page_path) DO UPDATE SET title=excluded.title, description=excluded.description, keywords=excluded.keywords
  `).run(pagePath, toLocaleStr(data.title), toLocaleStr(data.description), toLocaleStr(data.keywords));
  return getSeo(pagePath);
}

// --- Settings ---

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, String(value));
}

function getAllSettings() {
  const rows = db.prepare("SELECT * FROM settings").all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// --- Dashboard Stats ---

function getDashboardStats() {
  return {
    productCount: db.prepare("SELECT COUNT(*) AS cnt FROM products").get().cnt,
    publishedCount: db.prepare("SELECT COUNT(*) AS cnt FROM products WHERE status = 'published'").get().cnt,
    categoryCount: db.prepare("SELECT COUNT(*) AS cnt FROM categories").get().cnt,
    makeCount: db.prepare("SELECT COUNT(*) AS cnt FROM vehicle_makes").get().cnt,
    modelCount: db.prepare("SELECT COUNT(*) AS cnt FROM vehicle_models").get().cnt,
    applicationCount: db.prepare("SELECT COUNT(*) AS cnt FROM product_vehicles").get().cnt,
    crossRefCount: db.prepare("SELECT COUNT(*) AS cnt FROM cross_references").get().cnt,
    blogCount: db.prepare("SELECT COUNT(*) AS cnt FROM blog").get().cnt,
    recentProducts: db.prepare("SELECT id, sku, name, updated_at FROM products ORDER BY updated_at DESC LIMIT 5").all()
  };
}

// --- CSV Import Helpers ---

function importCrossReferencesCSV(rows) {
  const insert = db.prepare("INSERT OR IGNORE INTO cross_references (id, product_id, ref_type, ref_number, brand, notes) VALUES (?,?,?,?,?,?)");
  const txn = db.transaction((items) => {
    for (const r of items) {
      if (!r.product_id || !r.ref_number) continue;
      insert.run(generateId("ref"), r.product_id, r.ref_type || "OEM", r.ref_number, r.brand || "", r.notes || "");
    }
  });
  txn(rows);
  return { ok: true, imported: rows.length };
}

function exportCrossReferencesCSV() {
  const rows = db.prepare(`
    SELECT p.sku, p.name, cr.ref_type, cr.ref_number, cr.brand, cr.notes
    FROM cross_references cr JOIN products p ON cr.product_id = p.id
    ORDER BY p.sku, cr.ref_type
  `).all();
  return rows;
}

// --- Public catalog (enriched, for front-end consumption) ---

function getPublicCatalog(filters = {}) {
  const categories = getCategories();
  let products = getProducts({ status: "published" });

  if (filters.category) {
    products = products.filter(p => p.category_id === filters.category);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    products = products.filter(p => {
      const name = JSON.parse(p.name || "{}");
      const sku = (p.sku || "").toLowerCase();
      return sku.includes(q) || Object.values(name).some(v => String(v).toLowerCase().includes(q));
    });
  }

  // Attach category name and images to each product
  const catMap = new Map(categories.map(c => [c.id, c]));
  products = products.map(p => {
    const images = db.prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(p.id);
    return {
      ...p,
      images: images.map(img => img.url),
      category: catMap.get(p.category_id) || null
    };
  });

  return { categories, products };
}

/** Attach images to a single product row */
function enrichProduct(p) {
  if (!p) return p;
  const images = db.prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(p.id);
  return { ...p, images: images.map(img => img.url) };
}

// --------------- Initialization ---------------

if (!db) initDatabase();

// =============================================================================


/** Query products by engine size IDs */
function getProductsByEngineSizeIds(engineSizeIds) {
  if (!engineSizeIds || !engineSizeIds.length) return [];
  const placeholders = engineSizeIds.map(function() { return '?'; }).join(',');
  return db.prepare(
    'SELECT DISTINCT p.* FROM product_vehicles pv JOIN products p ON p.id = pv.product_id WHERE pv.engine_size_id IN (' + placeholders + ') AND p.status = ?'
  ).all(...engineSizeIds, 'published');
}

module.exports = {
  initDatabase,
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  addProductImage, removeProductImage,
  addProductDownload, removeProductDownload,
  getCrossReferences, addCrossReference, removeCrossReference, searchByCrossReference,
  importCrossReferencesCSV, exportCrossReferencesCSV,
  getMakes, createMake, updateMake, deleteMake,
  getModels, createModel, updateModel, deleteModel,
  getYears, createYear, updateYear, deleteYear,
  getEngineSizes, createEngineSize, updateEngineSize, deleteEngineSize,
  getProductsByEngineSizeIds,
  getApplications, addApplication, removeApplication, batchAddApplications,
  universalSearch, searchByDimensions,
  getBlogPosts, getBlogBySlug, createBlogPost, updateBlogPost, deleteBlogPost,
  getUsers, getUserByUsername, createUser, updateUserPassword, deleteUser,
  getSeo, upsertSeo,
  getSetting, setSetting, getAllSettings,
  getDashboardStats, getPublicCatalog,
  slugify
};
