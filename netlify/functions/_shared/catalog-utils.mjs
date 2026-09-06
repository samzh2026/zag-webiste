export const MAX_IMAGES = 3;

export function now() {
  return new Date().toISOString();
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function publicDb(db) {
  const categories = [...(db.categories || [])].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  const products = [...(db.products || [])].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  return { categories, products };
}

export function filterPublicCatalog(db, searchParams) {
  const catalog = publicDb(db);
  const status = searchParams.get("status") || "published";
  const category = searchParams.get("category");
  const q = String(searchParams.get("q") || "").toLowerCase();
  let products = catalog.products;

  if (status !== "all") products = products.filter((item) => item.status === "published");
  if (category) products = products.filter((item) => item.categoryId === category || item.categorySlug === category);
  if (q) {
    products = products.filter((item) =>
      [item.sku, item.name, item.description, item.material, item.vehicleModels]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const categoryById = new Map(catalog.categories.map((item) => [item.id, item]));
  return {
    categories: catalog.categories,
    products: products.map((item) => ({
      ...item,
      category: categoryById.get(item.categoryId) || null
    }))
  };
}

export function productFromFields(fields, existing = {}) {
  const features = String(fields.features || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ...existing,
    sku: String(fields.sku || existing.sku || "").trim(),
    name: String(fields.name || existing.name || "").trim(),
    categoryId: String(fields.categoryId || existing.categoryId || "").trim(),
    brand: String(fields.brand || existing.brand || "").trim(),
    material: String(fields.material || existing.material || "").trim(),
    vehicleModels: String(fields.vehicleModels || existing.vehicleModels || "").trim(),
    description: String(fields.description || existing.description || "").trim(),
    features,
    status: fields.status === "draft" ? "draft" : "published",
    sortOrder: Number(fields.sortOrder || existing.sortOrder || 100)
  };
}

export function buildImages(existingImages = [], uploadedPaths = [], removedIndexes = []) {
  const removed = new Set(removedIndexes);
  const clean = [];

  for (let i = 0; i < existingImages.length; i += 1) {
    if (!removed.has(i) && existingImages[i]) clean.push(existingImages[i]);
  }

  for (const path of uploadedPaths) {
    if (path && clean.length < MAX_IMAGES) clean.push(path);
  }

  return clean.slice(0, MAX_IMAGES);
}
