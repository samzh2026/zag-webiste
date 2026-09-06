"""
Fix vehicle search bug: getApplications(null) returns empty due to SQL NULL comparison
Adds getProductsByEngineSizeIds() and fixes the /api/vehicles/search endpoint
"""
BASE = "/var/www/zagbrakes"

# 1. Add helper function to store.js before "module.exports"
store = open(f"{BASE}/lib/store.js").read()

new_func = """
/** Query products by engine size IDs */
function getProductsByEngineSizeIds(engineSizeIds) {
  if (!engineSizeIds || !engineSizeIds.length) return [];
  const placeholders = engineSizeIds.map(function() { return '?'; }).join(',');
  return db.prepare(
    'SELECT DISTINCT p.* FROM product_vehicles pv JOIN products p ON p.id = pv.product_id WHERE pv.engine_size_id IN (' + placeholders + ') AND p.status = ?'
  ).all(...engineSizeIds, 'published');
}
"""

if "getProductsByEngineSizeIds" not in store:
    store = store.replace("module.exports = {", new_func + "\nmodule.exports = {")
    store = store.replace("  getApplications", "  getProductsByEngineSizeIds,\n  getApplications")
    open(f"{BASE}/lib/store.js", "w").write(store)
    print("store.js: added getProductsByEngineSizeIds")

# 2. Fix server.js vehicle search endpoint
srv = open(f"{BASE}/server.js").read()

old_search = """app.get("/api/vehicles/search", (req, res) => {
  const { makeId, modelId, yearId } = req.query;
  if (!makeId && !modelId && !yearId) return res.json([]);
  let engineSizes = [];
  if (yearId) {
    engineSizes = store.getEngineSizes(yearId);
  } else if (modelId) {
    const years = store.getYears(modelId);
    for (const y of years) {
      engineSizes = engineSizes.concat(store.getEngineSizes(y.id));
    }
  } else if (makeId) {
    const models = store.getModels(makeId);
    for (const m of models) {
      const years = store.getYears(m.id);
      for (const y of years) {
        engineSizes = engineSizes.concat(store.getEngineSizes(y.id));
      }
    }
  }
  const engineSizeIds = engineSizes.map(e => e.id);
  const productIds = new Set();
  const allApps = [];
  for (const esid of engineSizeIds) {
    const apps = store.getApplications ? store.getApplications(null).filter(a => a.engine_size_id === esid) : [];
    for (const a of apps) {
      const key = a.product_id;
      if (!productIds.has(key)) {
        productIds.add(key);
        allApps.push(a);
      }
    }
  }
  // Get products directly
  const products = allApps.map(a => {
    let p = store.getProductById(a.product_id);
    if (!p) return null;
    p = flattenToLang(req, p, PRODUCT_LOCALE_FIELDS);
    return p;
  }).filter(Boolean);
  res.json(products);
});"""

new_search = """app.get("/api/vehicles/search", (req, res) => {
  const { makeId, modelId, yearId } = req.query;
  if (!makeId && !modelId && !yearId) return res.json([]);
  // Collect all engine size IDs for the selected make/model/year
  let engineSizeIds = [];
  if (yearId) {
    engineSizeIds = store.getEngineSizes(yearId).map(function(e) { return e.id; });
  } else if (modelId) {
    store.getYears(modelId).forEach(function(y) {
      engineSizeIds = engineSizeIds.concat(store.getEngineSizes(y.id).map(function(e) { return e.id; }));
    });
  } else if (makeId) {
    store.getModels(makeId).forEach(function(m) {
      store.getYears(m.id).forEach(function(y) {
        engineSizeIds = engineSizeIds.concat(store.getEngineSizes(y.id).map(function(e) { return e.id; }));
      });
    });
  }
  if (!engineSizeIds.length) return res.json([]);
  // Direct query - much faster than filtering all apps
  const products = store.getProductsByEngineSizeIds(engineSizeIds);
  const result = products.map(function(p) {
    let product = flattenToLang(req, p, PRODUCT_LOCALE_FIELDS);
    product.images = db().prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(p.id).map(function(i) { return i.url; });
    return product;
  });
  res.json(result);
});"""

if old_search in srv:
    srv = srv.replace(old_search, new_search)
    open(f"{BASE}/server.js", "w").write(srv)
    print("server.js: vehicle search fixed")
else:
    print("WARNING: search pattern not found, checking...")
    if "store.getApplications(null)" in srv:
        print("   found buggy code, attempting partial fix")
        srv = srv.replace("const apps = store.getApplications ? store.getApplications(null).filter(a => a.engine_size_id === esid) : [];", "const apps = store.getProductsByEngineSizeIds([esid]);")
        # Also need to handle the mapping differently
        srv = srv.replace("const products = allApps.map(a => {\n    let p = store.getProductById(a.product_id);", "const products = store.getProductsByEngineSizeIds(engineSizeIds).map(p => {")
        srv = srv.replace("    if (!p) return null;\n    p = flattenToLang(req, p, PRODUCT_LOCALE_FIELDS);\n    return p;\n  }).filter(Boolean);", "    return flattenToLang(req, p, PRODUCT_LOCALE_FIELDS);\n  });")
        open(f"{BASE}/server.js", "w").write(srv)
        print("   partial fix applied")

print("Done")
