# Listing Studio implementation checklist

Checked means implemented with the verification stated here, not production deployment. API integration tests use real Neon transactions and roll back every test user and business record. Product images use public HTTPS URLs only; generated workbook bytes are retained in the database in all environments. No object-storage integration is required.

## Current URL-only image update verification
- [x] Removed upload component, API routes, binary-image validation, private-image model, storage readiness flag, and Worker object-storage context
- [x] Export service retains workbook bytes in the database in production; generation failures preserve retry snapshots
- [x] Automated tests: 30 passed, 0 failed, 1 skipped; real database transaction coverage remains blocked by missing DATABASE_URL
- [x] Frontend ESLint, TypeScript/Vite production build, and Worker bundle dry run pass
- [x] Browser-verified real SKU editor in isolation: accessible URL field and URL-only help, no upload controls; not an authenticated save/reload test
- [ ] Live database persistence, authenticated browser flows, and production export/download verification require configured database and authentication secrets

## Previous Flipkart XLSX update verification
- [x] Four supplied Flipkart v1 XLSX templates registered; twelve workbook fidelity tests and four fifty-row Flipkart round-trip tests pass
- [x] Latest full automated run: 27 passed, 0 failed, 1 skipped; the real Neon transaction test could not run because DATABASE_URL is not configured in this session
- [x] Current frontend ESLint, TypeScript/Vite production build, Worker bundle dry run, and git whitespace check pass
- [x] Browser-verified actual schema component at 643 × 682: double-colon multi-value state, integer constraints, and no horizontal overflow; corrected development frontend/API port routing
- [ ] Authenticated end-to-end browser verification and live Worker/Neon/SMTP verification remain unperformed in this session
- [ ] Obtain corrected Flipkart Seller SKU ID validation before custom seller-SKU production exports; all four supplied XLSX files currently permit only `Individual FSN`

The older verification section below records earlier environment-specific work, not current database connectivity. See HOSTING.md for this update's complete changed-file list and deployment steps.

## Implemented foundation
- [x] Preserve existing local authentication, JWT refresh/rotation, logout, roles and identity contracts; replace Prisma internals with Drizzle
- [x] Remove Google sign-in UI, routes, callbacks and provider dependencies; retain legacy identity columns without destructive changes
- [x] Create Neon business tables and owner-scope business queries, related-ID checks and downloads
- [x] Add Cloudflare Worker Node HTTP adapter and static Vite assets; request-scoped database pools
- [x] Make SMTP initialization and rate-limit stores compatible with Worker startup (no global network/random/timer side effects)
- [x] Add responsive shadcn application shell and page routes; frontend lint and TypeScript build pass

## Implemented seller workspace
- [x] Real-data dashboard metrics, recent drafts and activity (API integration verified)
- [x] Seller accounts: create/edit/search/filter/deactivate and referenced-record deletion safeguards (core API verified)
- [x] Global SKUs: create/edit/search, normalized SKU uniqueness, public image URLs and common attribute objects (core API verified)
- [x] Alternate account SKU mappings: create/edit/remove, account/global-SKU ownership and inactive-account checks (creation/edit/isolation verified)
- [x] URL-only catalog images: up to eight public HTTPS links, first link primary; no image upload UI, API, file storage, or copied image bytes
- [x] Profile, password and session settings screens (build verified; authenticated browser verification pending secrets)

## Implemented listing workflow
- [x] Versioned registry from all eight supplied Meesho XLSX workbooks
- [x] Required fields, dropdowns, exact columns, offsets and template SHA-256 hashes
- [x] Marketplace/category/version/account/product wizard with inline SKU creation and product duplication
- [x] Schema-driven fields, account-specific overrides and exact alternate mapping selection
- [x] Persistent draft save/resume, revision conflicts and authoritative server validation (real Neon API verified)
- [x] Separate XLSX per seller account; original ZIP parts preserved except the targeted worksheet cells (eight golden fixture tests pass)
- [x] Immutable resolved-value snapshots, history, checksum-verified owner downloads (real Neon verified)
- [x] Persist account-specific export failures and retry into a new history entry from the original snapshot (historical real Neon verification; current generation-failure test is database-independent)
- [x] Database-backed retained workbook bytes in development and production; authenticated owner-scoped checksum-verified downloads

## Verification evidence
- [x] 19 automated tests pass, none skipped with the connected development environment
- [x] Frontend ESLint, TypeScript and Vite production build pass
- [x] Production Worker bundle dry run passes; no remote deployment performed
- [x] Local workerd starts Express and verifies bcrypt, JWT and a 50-row Meesho export (145 ms observed elapsed export time, 103,763 bytes; not a production CPU/memory guarantee)
- [x] Sign-in screen inspected in browser at 1440 × 900 and 390 × 844
- [ ] Authenticated browser flows: accounts, alternate mappings, drafts, multi-account export, retry/download and mobile shell (blocked by missing JWT secrets)
- [ ] Worker-to-Neon TCP integration, live SMTP delivery, and production database-retained export verification
- [ ] Production CPU/memory/load validation for the maximum 5-account × 50-row export
- [ ] Recovery/verification/expired-session and mapping-edit browser/regression coverage beyond the tested auth core

## Remaining implementation, not external completion
- [ ] Explicit parent/variant hierarchy and shared conditional/repeatable validation contracts beyond the current flat template field renderer
- [ ] Replace capped account/SKU/draft/history lists with cursor pagination and matching UI controls
- [ ] Add relational draft-account/product/override tables from the approved architecture; current drafts are owner-validated JSONB with optimistic revisions
- [ ] Add a guided common-attribute editor; current catalog editor exposes advanced JSON attributes
- [ ] Add cross-isolate production authentication rate limiting (the bounded request-window store is local to each Worker isolate)

## Cloudflare / Neon deployment checklist
1. Connect this Git repository to Cloudflare Workers Builds. Use the repository root, build command `pnpm install --frozen-lockfile && pnpm build`, and deployment command `pnpm exec wrangler deploy`. Keep the existing `wrangler.jsonc` entrypoint, Node compatibility flag and static-assets setup. Cloudflare is the hosting target, not Vercel.
2. Add encrypted Worker secrets `DATABASE_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET`. Use distinct strong random JWT secrets. The Neon integration supplies the database URL to v0, but does not automatically copy it into Cloudflare. Never add any of these to `VITE_*` variables, source control or browser bundles.
3. Set `CLIENT_URL` to the exact HTTPS production origin. Keep development preview origins separate. Production authentication uses Secure HttpOnly same-origin cookies.
4. No object-storage setup is needed. Store direct public HTTPS image links only. Retain export bytes in `listing_exports.file_base64`, include them in database backups, and monitor database growth. Re-export historical records with no retained database file; no existing data or remote resources are deleted by this update.
5. Configure email secrets/settings: `EMAIL_HOST`, `EMAIL_PORT` (587 with STARTTLS or 465 with implicit TLS), `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`. Verify provider connectivity in Workers and actual verification/reset delivery; SMTP compatibility is not yet proven. Registration does not claim email was sent when transport is unconfigured.
6. Add Cloudflare edge rate-limiting/WAF rules for login, registration, reset and refresh endpoints. Per-isolate memory rate limits are not a distributed brute-force defense.
7. Select adequate Worker CPU/memory allowances and validate the bounded export workload on the actual hosting plan. Local elapsed timing does not establish a free-plan CPU budget. Maximum synchronous request size is five accounts and fifty product rows.
8. Re-run the automated tests and the authenticated browser flows, then verify Worker-to-Neon, URL-only image persistence, email delivery and database-backed production export/download behavior before launch.

- [ ] User supplies JWT secrets for normal preview authentication
- [ ] User configures Cloudflare account, bindings, secrets and hosting plan
- [ ] User configures and verifies email delivery
- [ ] Production deployment approved and performed
- [x] Four replacement Flipkart XLSX templates supplied and ZIP/cell fidelity tested; this is not marketplace approval. All four supplied files restrict Seller SKU ID to `Individual FSN`; corrected templates are needed for custom seller SKU values.

## Template gates and limitations
Original supplied files remain unchanged under `data/`. Legacy Flipkart XLS files are never converted or exported. The four supplied Flipkart v1 XLSX replacements are now registered and fidelity tested, with visible warnings: each supplied file restricts Seller SKU ID to `Individual FSN`, so custom account/catalog SKU values are rejected unless the user supplies a corrected template. The toe-ring source uses the `ring` sheet and omits offer price and stock columns; those fields are not fabricated. Purple conditionally mandatory fields are explained but category-specific conditional rules are not fully implemented. Amazon seller accounts work, but no Amazon listing template was supplied. No marketplace API integration, marketplace acceptance, inventory/orders/shipping features, persistent demo users or mock authentication are included. See HOSTING.md for current deployment instructions and this update's changed-file list.
