// =============================================================================
// lib/auth.js - JWT Authentication Middleware
// =============================================================================
// Uses jsonwebtoken for stateless signed tokens.
// Admin credentials come from environment variables:
//   ADMIN_USERNAME  (default: "admin")
//   ADMIN_PASSWORD  (default: "88888888")
//   ADMIN_TOKEN_SECRET (default: auto-generated, change in production!)
// =============================================================================

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Load env (dotenv called in server.js before importing)
function env(name, fallback) {
  return process.env[name] || fallback;
}

const ADMIN_USERNAME = env("ADMIN_USERNAME", "admin");
const ADMIN_PASSWORD = env("ADMIN_PASSWORD", "88888888");

// Auto-generate a secret if none provided. In production, set ADMIN_TOKEN_SECRET
// in environment variables and keep it the same across server restarts.
const TOKEN_SECRET = env(
  "ADMIN_TOKEN_SECRET",
  "zag-local-dev-secret-" + crypto.randomBytes(8).toString("hex")
);

const TOKEN_EXPIRY = "12h";

// ---- Token Creation & Verification ----

function createToken(username) {
  return jwt.sign({ username, role: "admin" }, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, TOKEN_SECRET);
  } catch (e) {
    return null;
  }
}

// ---- Express Middleware ----

function extractToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

/** Express middleware: rejects with 401 if token is missing or invalid */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token expired or invalid. Please log in again." });
  }
  req.user = payload;
  next();
}

// ---- Login Handler ----

function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Username or password is incorrect" });
  }
  const token = createToken(username);
  return res.json({ token });
}

module.exports = {
  createToken,
  verifyToken,
  requireAuth,
  handleLogin,
  ADMIN_USERNAME
};
