import crypto from "node:crypto";
import { json } from "./http.mjs";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function env(name, fallback = "") {
  if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name) || fallback;
  return process.env[name] || fallback;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function adminUsername() {
  return env("ADMIN_USERNAME", "admin");
}

export function adminPassword() {
  return env("ADMIN_PASSWORD", "88888888");
}

export function tokenSecret() {
  return env("ADMIN_TOKEN_SECRET", adminPassword());
}

export function createToken(username, createdAt = Date.now()) {
  const payload = base64Url(JSON.stringify({ username, createdAt }));
  const signature = sign(payload, tokenSecret());
  return `${payload}.${signature}`;
}

export function verifyToken(token, now = Date.now()) {
  if (!token || !token.includes(".")) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = sign(payload, tokenSecret());
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.username === adminUsername() && now - Number(parsed.createdAt) <= TOKEN_TTL_MS;
  } catch {
    return false;
  }
}

export function authToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function requireAuth(request) {
  if (verifyToken(authToken(request))) return null;
  return json({ error: "Unauthorized" }, 401);
}
