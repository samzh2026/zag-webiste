import { requireAuth } from "./_shared/auth.mjs";
import { deleteImage, readDb, saveImageFile, writeDb } from "./_shared/catalog-store.mjs";
import { buildImages, makeId, now, productFromFields } from "./_shared/catalog-utils.mjs";
import { json, methodNotAllowed } from "./_shared/http.mjs";

export default async (request, context) => {
  const authError = requireAuth(request);
  if (authError) return authError;

  const id = context.params?.id;
  if (!id && request.method === "POST") return createProduct(request);
  if (id && request.method === "PUT") return updateProduct(request, id);
  if (id && request.method === "DELETE") return deleteProduct(id);
  return methodNotAllowed();
};

async function formParts(request) {
  const form = await request.formData();
  const fields = {};
  const files = [];
  const removed = [];

  for (const [key, value] of form.entries()) {
    const isFile = value && typeof value === "object" && typeof value.arrayBuffer === "function" && "name" in value;
    if (isFile && key.startsWith("image") && value.size > 0) files.push(value);
    if (!isFile) fields[key] = String(value);
    if (key.startsWith("removeImage") && String(value) === "1") {
      const index = Number(key.replace("removeImage", ""));
      if (Number.isInteger(index)) removed.push(index);
    }
  }

  return { fields, files, removed };
}

async function uploadedImagePaths(files) {
  const paths = [];
  for (const file of files) {
    const saved = await saveImageFile(file);
    if (saved) paths.push(saved);
  }
  return paths;
}

async function createProduct(request) {
  const { fields, files } = await formParts(request);
  const imagePaths = await uploadedImagePaths(files);
  const product = productFromFields(fields, {
    id: makeId("prod"),
    images: buildImages([], imagePaths, []),
    createdAt: now(),
    updatedAt: now()
  });

  if (!product.name || !product.categoryId) {
    await Promise.all(imagePaths.map((path) => deleteImage(path)));
    return json({ error: "Product name and category are required" }, 400);
  }

  const db = await readDb();
  db.products.push(product);
  await writeDb(db);
  return json(product, 201);
}

async function updateProduct(request, id) {
  const { fields, files, removed } = await formParts(request);
  const db = await readDb();
  const index = db.products.findIndex((item) => item.id === id);
  if (index === -1) return json({ error: "Product not found" }, 404);

  const existingImages = db.products[index].images || (db.products[index].image ? [db.products[index].image] : []);
  const imagePaths = await uploadedImagePaths(files);
  const images = buildImages(existingImages, imagePaths, removed);

  await Promise.all(removed.map((imageIndex) => deleteImage(existingImages[imageIndex])));
  db.products[index] = productFromFields(fields, {
    ...db.products[index],
    images,
    updatedAt: now()
  });
  delete db.products[index].image;

  if (!db.products[index].name || !db.products[index].categoryId) {
    await Promise.all(imagePaths.map((path) => deleteImage(path)));
    return json({ error: "Product name and category are required" }, 400);
  }

  await writeDb(db);
  return json(db.products[index]);
}

async function deleteProduct(id) {
  const db = await readDb();
  const product = db.products.find((item) => item.id === id);
  if (product) {
    const images = product.images || (product.image ? [product.image] : []);
    await Promise.all(images.map((image) => deleteImage(image)));
  }
  db.products = db.products.filter((item) => item.id !== id);
  await writeDb(db);
  return json({ ok: true });
}

export const config = {
  path: ["/api/admin/products", "/api/admin/products/:id"]
};
