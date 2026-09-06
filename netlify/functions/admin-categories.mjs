import { requireAuth } from "./_shared/auth.mjs";
import { readDb, writeDb } from "./_shared/catalog-store.mjs";
import { makeId, now, slugify } from "./_shared/catalog-utils.mjs";
import { json, methodNotAllowed, parseJson } from "./_shared/http.mjs";

export default async (request, context) => {
  const authError = requireAuth(request);
  if (authError) return authError;

  const id = context.params?.id;
  if (!id && request.method === "POST") return createCategory(request);
  if (id && request.method === "PUT") return updateCategory(request, id);
  if (id && request.method === "DELETE") return deleteCategory(id);
  return methodNotAllowed();
};

async function createCategory(request) {
  const body = await parseJson(request);
  if (!String(body.name || "").trim()) return json({ error: "Category name is required" }, 400);

  const db = await readDb();
  const category = {
    id: makeId("cat"),
    name: String(body.name).trim(),
    slug: slugify(body.slug || body.name),
    description: String(body.description || "").trim(),
    sortOrder: Number(body.sortOrder || 100),
    createdAt: now(),
    updatedAt: now()
  };
  db.categories.push(category);
  await writeDb(db);
  return json(category, 201);
}

async function updateCategory(request, id) {
  const body = await parseJson(request);
  const db = await readDb();
  const category = db.categories.find((item) => item.id === id);
  if (!category) return json({ error: "Category not found" }, 404);

  category.name = String(body.name || category.name).trim();
  category.slug = slugify(body.slug || category.slug || category.name);
  category.description = String(body.description || "").trim();
  category.sortOrder = Number(body.sortOrder || category.sortOrder || 100);
  category.updatedAt = now();
  await writeDb(db);
  return json(category);
}

async function deleteCategory(id) {
  const db = await readDb();
  if (db.products.some((item) => item.categoryId === id)) {
    return json({ error: "Move or delete products in this category first" }, 409);
  }
  db.categories = db.categories.filter((item) => item.id !== id);
  await writeDb(db);
  return json({ ok: true });
}

export const config = {
  path: ["/api/admin/categories", "/api/admin/categories/:id"]
};
