import assert from "node:assert/strict";
import test from "node:test";

process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_TOKEN_SECRET = "test-secret";

const auth = await import("../netlify/functions/_shared/auth.mjs");

test("createToken returns a token that verifies for the configured admin user", () => {
  const token = auth.createToken("admin", Date.now());
  assert.equal(auth.verifyToken(token), true);
});

test("verifyToken rejects tampered tokens", () => {
  const token = auth.createToken("admin", Date.now());
  const [payload, signature] = token.split(".");
  const tampered = `${payload.slice(0, -1)}x.${signature}`;
  assert.equal(auth.verifyToken(`${token}x`), false);
  assert.equal(auth.verifyToken(tampered), false);
});

test("verifyToken rejects expired tokens", () => {
  const thirteenHoursAgo = Date.now() - 1000 * 60 * 60 * 13;
  const token = auth.createToken("admin", thirteenHoursAgo);
  assert.equal(auth.verifyToken(token), false);
});
