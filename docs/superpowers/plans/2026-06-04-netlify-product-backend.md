# Netlify Product Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the product admin backend so product and image uploads work after deploying the static ZAG BRAKES website to Netlify.

**Architecture:** Keep `index.html` and `admin.html` as static pages. Replace the local-file-only production backend with Netlify Functions that store catalog data and uploaded images in Netlify Blobs, while leaving `server.js` available for simple local legacy testing.

**Tech Stack:** Vanilla HTML/CSS/JS, Netlify Functions, Netlify Blobs, Node test runner.

---

### Task 1: Shared Catalog Storage

**Files:**
- Create: `netlify/functions/_shared/catalog-store.mjs`
- Create: `netlify/functions/_shared/http.mjs`
- Modify: `package.json`

- [ ] Add `@netlify/blobs` as a production dependency.
- [ ] Implement JSON response helpers.
- [ ] Implement strongly consistent Blobs storage for `db.json` and uploaded image objects.
- [ ] Seed Blobs from the current `data/db.json` structure if no online database exists yet.

### Task 2: Admin Auth

**Files:**
- Create: `netlify/functions/_shared/auth.mjs`
- Create: `netlify/functions/login.mjs`

- [ ] Implement `/api/login`.
- [ ] Use `ADMIN_USERNAME` and `ADMIN_PASSWORD` from Netlify environment variables.
- [ ] Keep local defaults only for development.
- [ ] Use signed stateless tokens so Functions do not rely on in-memory sessions.

### Task 3: Catalog APIs

**Files:**
- Create: `netlify/functions/catalog.mjs`
- Create: `netlify/functions/admin-catalog.mjs`
- Create: `netlify/functions/admin-categories.mjs`
- Create: `netlify/functions/admin-products.mjs`
- Create: `netlify/functions/uploads.mjs`

- [ ] Implement public `/api/catalog`.
- [ ] Implement authenticated `/api/admin/catalog`.
- [ ] Implement authenticated category create/update/delete.
- [ ] Implement authenticated product create/update/delete with `Request.formData()`.
- [ ] Implement `/uploads/:fileName` so saved image blobs render on the public site.

### Task 4: Netlify Config and Docs

**Files:**
- Create: `netlify.toml`
- Modify: `README.md`

- [ ] Configure Netlify publish directory and Functions directory.
- [ ] Document local development, production deployment, and required environment variables.
- [ ] Explain that secrets must be stored in Netlify, not committed.

### Task 5: Tests and Verification

**Files:**
- Create: `tests/catalog-store.test.mjs`
- Create: `tests/auth.test.mjs`

- [ ] Add focused tests for token signing/verification.
- [ ] Add focused tests for catalog filtering and product image list behavior.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run Netlify deploy after local verification and authentication check.
