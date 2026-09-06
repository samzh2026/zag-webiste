# ZAG BRAKES Website

Lightweight product website and admin backend for ZAG BRAKES.

## Run locally

```powershell
node server.js
```

Open locally:

- Website: http://localhost:3000/
- Admin: http://localhost:3000/admin.html

Production domain:

- Website: https://www.zagbrakes.com/

Set the admin password with an environment variable before starting the server:

```powershell
$env:ADMIN_PASSWORD="your-new-password"; node server.js
```

## What the backend manages

- Product categories
- Products
- SKU / part number
- Material
- Vehicle model/application notes
- Product features
- Publish/draft status
- Product image upload

Current category structure:

- Brake Pads
- Brake Discs
- Brake Shoes
- Clutch Plates

Data is stored in `data/db.json`. Uploaded images are stored in `uploads/`.

## Netlify production backend

The production-ready backend uses Netlify Functions and Netlify Blobs:

- API functions live in `netlify/functions/`.
- Product data is stored in the `zag-catalog` Blob store.
- Uploaded product images are stored in the `zag-product-images` Blob store.
- Public image URLs stay the same format: `/uploads/<file-name>`.

Required Netlify environment variables:

- `ADMIN_USERNAME`: admin login name.
- `ADMIN_PASSWORD`: admin login password. Do not keep the default password online.
- `ADMIN_TOKEN_SECRET`: a long random secret used to sign admin login tokens.

Do not commit passwords, tokens, or customer-private data to the project files. Set secrets in the Netlify dashboard under Site settings > Environment variables.

Useful commands:

```powershell
npm install
npm test
npm run build
npx netlify deploy
npx netlify deploy --prod
```

The local `server.js` backend is kept for quick offline testing. Netlify production should use the Functions backend configured in `netlify.toml`.
