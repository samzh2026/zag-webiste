import { getStore } from "@netlify/blobs";
import fs from "node:fs";
import path from "node:path";

const CATALOG_KEY = "db.json";
const DEFAULT_DB = {
  categories: [
    {
      id: "cat_brake_pad",
      name: "Brake Pads",
      slug: "brake-pads",
      description: "Sintered and semi-metallic pads for motorcycles, ATV and UTV applications.",
      sortOrder: 10,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z"
    },
    {
      id: "cat_brake_disc",
      name: "Brake Discs",
      slug: "brake-discs",
      description: "Precision rotors engineered for heat control and stable stopping power.",
      sortOrder: 20,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z"
    },
    {
      id: "cat_brake_shoe",
      name: "Brake Shoes",
      slug: "brake-shoes",
      description: "Durable drum brake shoes with smooth, consistent friction performance.",
      sortOrder: 30,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z"
    },
    {
      id: "cat_clutch_plate",
      name: "Clutch Plates",
      slug: "clutch-plates",
      description: "Reliable clutch friction plates for motorcycles, ATV and UTV drivetrains.",
      sortOrder: 40,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z"
    }
  ],
  products: [
    {
      id: "prod_cbe489ae9788",
      images: ["/uploads/1780070698636-500712df80.jpg"],
      createdAt: "2026-05-29T16:04:58.638Z",
      updatedAt: "2026-05-29T16:04:58.638Z",
      sku: "",
      name: "FRONT BRAKE PAD",
      categoryId: "cat_brake_pad",
      material: "",
      vehicleModels: "",
      description: "",
      features: [],
      status: "published",
      sortOrder: 100
    }
  ]
};

function store(name) {
  return getStore({ name, consistency: "strong" });
}

export function catalogStore() {
  return store("zag-catalog");
}

export function imageStore() {
  return store("zag-product-images");
}

export async function readDb() {
  const db = await catalogStore().get(CATALOG_KEY, { type: "json" });
  if (db && Array.isArray(db.categories) && Array.isArray(db.products)) return db;
  await writeDb(DEFAULT_DB);
  return structuredClone(DEFAULT_DB);
}

export async function writeDb(db) {
  await catalogStore().setJSON(CATALOG_KEY, db);
}

export function safeImageName(originalName = "upload.bin") {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".bin";
  return `${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}${safeExt}`;
}

export async function saveImageFile(file) {
  if (!file || !file.size || !file.name) return "";
  const fileName = safeImageName(file.name);
  const contentType = file.type || "application/octet-stream";
  const buffer = await file.arrayBuffer();
  await imageStore().set(fileName, buffer, {
    metadata: { contentType, uploadedAt: new Date().toISOString() }
  });
  return `/uploads/${fileName}`;
}

export async function deleteImage(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return;
  const fileName = imagePath.replace("/uploads/", "");
  await imageStore().delete(fileName);
}

export async function getImage(fileName) {
  const safeName = path.basename(fileName || "");
  const images = imageStore();
  const data = await images.get(safeName, { type: "arrayBuffer" });
  if (data) {
    const metadata = await images.getMetadata(safeName);
    return {
      data,
      contentType: metadata?.metadata?.contentType || "application/octet-stream"
    };
  }

  const fallback = path.join(process.cwd(), "uploads", safeName);
  if (fs.existsSync(fallback)) {
    return {
      data: fs.readFileSync(fallback),
      contentType: mimeFromName(safeName)
    };
  }

  return null;
}

function mimeFromName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
  }[ext] || "application/octet-stream";
}
