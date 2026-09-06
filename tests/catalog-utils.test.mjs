import assert from "node:assert/strict";
import test from "node:test";
import { buildImages, filterPublicCatalog, productFromFields } from "../netlify/functions/_shared/catalog-utils.mjs";

test("filterPublicCatalog returns only published products by default", () => {
  const db = {
    categories: [{ id: "cat_a", name: "Brake Pads", sortOrder: 1 }],
    products: [
      { id: "prod_1", name: "Published", categoryId: "cat_a", status: "published", sortOrder: 1 },
      { id: "prod_2", name: "Draft", categoryId: "cat_a", status: "draft", sortOrder: 2 }
    ]
  };

  const result = filterPublicCatalog(db, new URLSearchParams());
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].id, "prod_1");
  assert.equal(result.products[0].category.name, "Brake Pads");
});

test("buildImages removes selected existing images and appends new uploads", () => {
  const images = buildImages(
    ["/uploads/a.jpg", "/uploads/b.jpg"],
    ["/uploads/c.jpg"],
    [0]
  );

  assert.deepEqual(images, ["/uploads/b.jpg", "/uploads/c.jpg"]);
});

test("productFromFields normalizes multiline features", () => {
  const product = productFromFields({
    name: " Pad ",
    categoryId: "cat_a",
    features: "Low noise\nHigh heat, Stable friction"
  });

  assert.deepEqual(product.features, ["Low noise", "High heat", "Stable friction"]);
  assert.equal(product.name, "Pad");
  assert.equal(product.status, "published");
});
