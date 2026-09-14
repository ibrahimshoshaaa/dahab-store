# Production notes

## Implemented in Phase 2
- Product hero/gallery images use `next/image` for optimized delivery.
- HSTS is enabled through `Strict-Transport-Security`.

## Intentionally deferred
- Product-specific server metadata: the current product page is a Client Component and moving it to a Server/Client split is a larger refactor.
- Admin token migration from localStorage to HttpOnly cookies: this changes authentication flow and should be tested as a dedicated change.
- CSP: should be introduced only after auditing all Cloudinary, font, script, and inline-style requirements.

## Before deployment
Run `npm run build`, then test product pages and image uploads.
