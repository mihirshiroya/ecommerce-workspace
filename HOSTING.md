# Listing Studio: changed files and hosting guide

## What this update delivers

Four supplied Flipkart v1 XLSX templates are registered alongside the eight existing Meesho templates. Product data starts at row 5. Original workbook ZIP parts, worksheet headers, dropdowns, styles, guidance sheets, and marketplace-owned columns are preserved. Only mapped product cells in the target worksheet are rewritten. Legacy XLS files are not converted or enabled. No Amazon listing template has been supplied; Amazon account management is unchanged.

### Important source-file restrictions

- **All four supplied XLSX files restrict Seller SKU ID to the dropdown value `Individual FSN`.** Their instructions describe a seller-defined ID, but their actual dropdowns do not allow one. The app preserves the supplied restriction and rejects custom catalog/account SKU values instead of silently bypassing it. A visible warning explains this. Ask the template provider for corrected XLSX files with an appropriate Seller SKU ID rule before launching custom-SKU Flipkart exports. Do not substitute `Individual FSN` for your real SKUs merely to pass validation.
- The toe-ring file uses a worksheet named `ring`. Its Type options include Toe Ring and Toe Ring Set, but it has **no MRP, selling-price, or stock columns**. The app does not invent missing marketplace columns; this export retains the supplied catalogue-only structure.
- Purple fields are conditionally mandatory. The original guidance is shown, but complete category-specific conditional/variant rules are not implemented. Follow the original workbook guidance and verify uploads in Flipkart Seller Hub.
- Successful file-generation tests are not certification that Flipkart will accept a listing. No live marketplace submission was performed.

## Files changed in this update

Paths below are relative to the repository root. This list covers this update, not every earlier change to the application.

### Four new, unchanged source workbooks

- `data/template-for-earring-flipkart-v1-5615f9.xlsx`
- `data/template-for-toe-ring-flipkart-v1-239be1.xlsx`
- `data/template-for-mangalsutra-flipkart-v1-788caf.xlsx`
- `data/template-for-pendant-flipkart-v1-19db24.xlsx`

### Template generation and export

- `scripts/build-templates.cjs` — discover Flipkart XLSX files, locate the actual category sheets, extract required/conditional attributes, multi-value options, numeric/length rules, hashes, and source warnings.
- `bulk-listing/registry.json` — regenerated schemas for twelve supplied XLSX workbooks.
- `bulk-listing/template-bytes.json` — regenerated embedded original workbook bytes.
- `Backend/services/workbooks.js` — validate multi-value/numeric/length/Flipkart price constraints; fix self-closing XML cell matching so sample values cannot leak into exports.
- `Backend/routes/workspace.js` — correctly distinguish Main Image URL from Other Image URL 1 when resolving catalog images.
- `package.json` — add `templates:build` for reproducible registry generation. No dependencies added.

### Frontend and development build

- `Frontend/src/components/workspace/SchemaFields.tsx` — accessible double-colon multi-value entry, allowed-value help, and numeric/length constraints.
- `Frontend/src/pages/BulkListing.tsx` — show source-template warnings and correct additional-image indexes.
- `Frontend/src/types/workspace.ts` — field constraints and template-warning types.
- `Frontend/tsconfig.app.json` — resolve lowercase UI imports to the existing `components/Ui` directory on Linux.
- `Frontend/vite.config.ts` — same Linux-safe alias and correct preview-port/API-proxy configuration.
- `scripts/dev.mjs` — keep the frontend on the advertised preview port and the API on a separate internal port.
- `Backend/index.js` — bind the development API to loopback rather than taking over the public frontend preview.

### Tests and documentation

- `tests/workbooks.test.cjs` — cover all twelve templates; Flipkart fifty-row exports, source restrictions, output-only cells, literal formula-like text, sample clearing, and validation.
- `tests/security.test.cjs` — expect twelve available schemas while ensuring workbook bytes are not exposed by the manifest endpoint.
- `README.md` — point to this guide and mark the old boilerplate instructions as historical.
- `TODO.md` — update the Flipkart template gate and document remaining limitations.
- `HOSTING.md` — this guide.

## Verified and not verified

Current URL-only image update: **30 tests passed, 0 failed, 1 skipped**. Frontend ESLint, TypeScript/Vite production build, and Worker bundle dry run pass. Production export materialization and generation failures are covered without external storage. The real SKU editor was browser-checked in isolation for its URL field/help and absence of upload controls. Authenticated persistence/export flows remain unverified because this session has no database connection or authentication secrets. No schema migration, remote-resource deletion, or deployment was performed.

Earlier Flipkart template verification (historical):

- Automated tests: **27 passed, 0 failed, 1 skipped**. The real Neon transaction test is skipped because this session has no `DATABASE_URL`.
- All twelve original-workbook fidelity tests pass, including all four new Flipkart XLSX files.
- Fifty-row placement and multi-value round trips pass for all four Flipkart templates.
- Frontend ESLint, TypeScript, and Vite production build pass. Vite reports a non-fatal large-JavaScript-chunk warning.
- Cloudflare Worker production bundle dry run passes. This is not a deployment or proof of live database/storage connectivity.
- Browser verification at 643 × 682: real schema component, double-colon input state round trip, integer input constraints, and no horizontal overflow. This was an isolated component check, not an authenticated end-to-end listing/export flow.
- No production deployment, SMTP delivery test, live Worker-to-Neon test, or marketplace upload was performed.
- The current integration inventory does not provide a database connection, JWT secrets, or SMTP credentials to this session. Previous environment-specific verification recorded in TODO.md should not be mistaken for current connectivity.

# Hosting, step by step

## 1. Use the intended architecture

**Cloudflare Workers** serves both the React/Vite frontend and the Express API through the Node HTTP adapter. **Neon PostgreSQL** stores users/workspace records and retained export workbook bytes. Product images remain at their existing public HTTPS URLs; the app stores only the URL strings in `global_skus.images`. Images are never uploaded, downloaded, or copied by the API. No object-storage service or bucket binding is needed.

Deploy from the **repository root**, not `Frontend/` or `Backend/`. Keep `wrangler.jsonc`, `Backend/worker.mjs`, `compatibility_flags: ["nodejs_compat"]`, and the configured static-assets binding. Do not deploy just `Frontend/dist` to Cloudflare Pages: the API would be missing. The current project is not configured as a Vercel serverless app.

## 2. Put the complete project in GitHub

Use v0's GitHub connection in project settings. Review the changed files and use the Git/PR controls to put the complete repository on the branch you will deploy. Include `pnpm-lock.yaml`, the workspace manifests, `data/`, and both generated `bulk-listing/` files. Exclude credentials, `.env*`, `.dev.vars*`, `node_modules`, and build output. Keep the supplied files under their current paths.

Use GitHub to install/transfer the project; there is no need to run commands in the v0 preview. Build/deploy command strings below are entered in Cloudflare's web dashboard.

## 3. Confirm the production database already has the complete schema

In Neon, select the intended production project/branch/database. Prefer a dedicated production branch with backups, separate from test data. Retrieve its PostgreSQL connection string with SSL enabled. Keep it secret.

This update does not change database tables. If reusing the original configured database, verify the existing schema before proceeding. This read-only query should find all eight required tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'refresh_tokens', 'seller_accounts', 'global_skus',
    'account_sku_mappings', 'listing_drafts',
    'listing_exports', 'activity_logs'
  )
ORDER BY table_name;
```

Table existence alone does not establish correct columns, indexes, or constraints. Verify against `Backend/db/schema.js`. **For a brand-new or incomplete database, stop here:** the repository's historical Prisma migration is not a complete migration for the current workspace schema. A reviewed full-schema migration or a validated database-branch copy/import is required before hosting. Do not run `prisma migrate dev`, reset the database, or assume the old Prisma files provision the current app. No new-database migration was created or executed in this update.

The v0 integration does not automatically transfer database secrets to Cloudflare. This session currently has no connected database; obtain the real production connection details from the database owner/Neon console rather than using the unrelated Supabase redirect variable.

## 4. Use public image URLs and database-retained exports

Paste direct, publicly accessible HTTPS image URLs into the SKU editor, one per line, up to eight. The first URL is the primary image; reorder the lines to change it. The app validates and stores links only. Keep the original image host available for marketplace access; share-page URLs or links requiring sign-in may not work.

Generated XLSX files are stored as base64 in `listing_exports.file_base64` in both development and production. Downloads remain authenticated, owner-scoped, and checksum-verified. Database backups must include workbook data; base64 adds approximately one-third to the binary file size, so monitor database usage and define an appropriate export-retention policy.

No database migration or destructive cleanup is performed by this change. Existing unused legacy columns/tables may remain without being queried by the app. Historical exports that have no database-retained file must be re-exported from their drafts; the download endpoint reports that explicitly rather than returning an invalid file. No stored files or remote resources are deleted.

## 5. Create the Cloudflare Worker and connect GitHub

In **Workers & Pages**, create a Worker named `listing-studio` (or choose your name and update `name` in `wrangler.jsonc` to match). You can create it using Cloudflare's starter flow first so you can configure runtime secrets before deploying application code. Then connect your GitHub repository under the Worker's build settings. Select the intended production branch.

Use these settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root; blank or `/` in the dashboard |
| Node build version | 22 or a newer supported LTS, via `NODE_VERSION` build variable |
| Package manager | pnpm, matching `packageManager: pnpm@10.11.0` |
| Build command | `pnpm install --frozen-lockfile && pnpm templates:build && pnpm --dir Frontend lint && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |

Cloudflare may install dependencies automatically when it detects `pnpm-lock.yaml`; the explicit install also keeps the build reproducible. Do not use `pnpm deploy` as the dashboard deploy command because the root script would build again.

A first build may start as soon as Git is connected. Do not treat that deployment as ready until secrets, bindings, and the checks below are in place. Cloudflare Workers is the target here, not the v0 Vercel Publish workflow.

## 6. Set runtime secrets and application origin

Open **Worker → Settings → Variables and Secrets**. These are runtime settings, not the similarly named build-only settings.

Add encrypted secrets:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Real production Neon PostgreSQL SSL connection string |
| `JWT_SECRET` | Strong randomly generated secret; at least 32 random bytes |
| `JWT_REFRESH_SECRET` | A separate, independently generated strong random secret |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password/app password |

Generate the two JWT secrets using your password manager's secure generator. Do not reuse a password, use sample values, or paste secrets into chat/source files. Rotating JWT secrets later invalidates existing sessions.

Add the non-secret application settings to the `vars` object in `wrangler.jsonc` so Git-based deploys preserve them, replacing examples with your real values:

```jsonc
"vars": {
  "NODE_ENV": "production",
  "APP_NAME": "Listing Studio",
  "CLIENT_URL": "https://listing-studio.YOUR-SUBDOMAIN.workers.dev",
  "EMAIL_HOST": "YOUR-SMTP-HOST",
  "EMAIL_PORT": "587",
  "EMAIL_FROM": "verified-sender@your-domain.example"
}
```

Use the exact HTTPS frontend origin for `CLIENT_URL`, with no route suffix. The same Worker serves `/api`; leave the frontend Axios base URL as `/api`. No frontend API URL variable is required. Never put database URLs, JWT secrets, or SMTP passwords into `VITE_*` variables. No Google OAuth configuration is required.

If Cloudflare offers to reconcile dashboard settings with your Wrangler configuration, keep the committed non-secret vars as the source of truth and retain the separately configured encrypted secrets.

## 7. Verify email and choose an adequate hosting plan

Use an SMTP provider compatible with the deployed Worker TCP/TLS environment. The app uses port 587 with STARTTLS or 465 with implicit TLS; do not assume arbitrary SMTP providers or port 25 work. Verify the sending domain/address and configure SPF/DKIM/DMARC with the provider.

After deployment, test actual verification and reset email delivery, including the link's HTTPS origin. A health flag only checks that variables are present. SMTP delivery is not verified by this update; if the provider cannot work in Workers, an email-transport change is required before launch.

Use **Workers Paid** for this CPU-heavy bcrypt/XLSX workload rather than assuming the Free plan's 10 ms CPU allowance is sufficient. Check current Cloudflare limits and billing. Measure actual CPU, startup time, memory, latency, and concurrent exports on the selected plan. The maximum application batch remains five accounts and fifty rows. Increase CPU allowance only from observed needs, and ensure requests stay within the frontend's current 30-second API timeout. Raising the CPU limit alone does not fix browser timeouts or memory pressure.

## 8. Deploy through Cloudflare

Save the runtime secrets. Confirm that `CLIENT_URL` and the correct Worker name are committed. In Cloudflare's Builds view, trigger/retry the build for the intended commit. After completion, confirm the deployment log shows the `ASSETS` binding and that the application version is active. No object-storage binding is required.

No deployment was performed during this update. A successful local `wrangler deploy --dry-run` bundles the code but does not upload secrets, validate remote startup, or verify a database connection.

## 9. Validate the deployed application before launch

1. Open the HTTPS Worker URL. The frontend must load, not a JSON “Route not found” response. Refresh a nested route such as `/login` to check SPA fallback.
2. Open `/api/health`. `databaseConfigured`, `authConfigured`, and `emailConfigured` should be true. These are configuration flags, not connectivity tests.
3. Register a real test account, verify its email, sign in, refresh the page, and sign out. Test password reset too.
4. Create a seller account and a global SKU. Create an alternate account SKU mapping. Confirm a second user cannot access the first user's records.
5. Save up to eight public HTTPS image URLs on a SKU, reopen it, and confirm the URLs and primary-image order persist. Confirm private/local URLs and more than eight links are rejected, and that another user cannot change the SKU.
6. Save and reopen a Meesho draft. Validate, export, download, and open the XLSX in Excel/LibreOffice. Confirm workbook bytes are retained in the database and the download belongs to the correct account.
7. Inspect each Flipkart category's warnings and original guidance. Obtain corrected Seller SKU ID templates before testing exports with real custom account SKUs. Validate the replacement schema and repeat the fidelity tests before using it in production.
8. Verify multi-value fields round-trip using `::`. For toe rings, confirm whether the marketplace requires a different offer/listing workbook containing price and stock.
9. Test separate account exports, history, failure/retry behaviour, and unauthorized downloads. Check that sample rows are absent and the workbook opens without repair warnings.
10. Submit a small, reviewed workbook through the marketplace's seller portal. Marketplace acceptance is the final external check; the app does not submit it automatically.
11. Watch Cloudflare logs and metrics for database errors, email failures, CPU/memory limits, and request timeouts before increasing batch size or traffic.

## 10. Add a custom domain and operational protections

In **Worker → Settings → Domains & Routes**, add the intended application domain and wait for HTTPS activation. Update the committed `CLIENT_URL` to that exact origin and redeploy. Retest cookies, verification/reset links, and same-origin API calls. Use separate Workers, Neon branches, and secrets for staging versus production; do not point preview branches at the production database.

Add plan-appropriate Cloudflare edge rate limits for the actual `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/refresh-token` routes. Existing in-memory limits are per Worker isolate, not a distributed brute-force defence. Check the route definitions when configuring URL patterns.

Enable logs/alerts, database backups and a tested restore process. Include retained export bytes in database backups and establish an export-retention policy; rolling back a Worker does not roll back database data. Keep the preceding stable Worker version and Git commit for code rollback. Review the unchecked application limitations in `TODO.md`; template delivery does not mark those complete.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Frontend loads but API returns 404 | Deploy from repository root with the existing Worker adapter; do not host only the Vite output |
| “Authentication is awaiting secure JWT configuration” | Add both JWT secrets to Worker runtime settings, then deploy |
| Database errors or missing tables | Verify `DATABASE_URL`, SSL, branch selection, full current schema, and live Worker connectivity |
| Exports or downloads fail | Check database connectivity/capacity, retained `file_base64`, checksum, template version, and Worker logs; re-export older records with no retained database file |
| Flipkart rejects custom SKU during app validation | Source files allow only `Individual FSN`; obtain corrected Seller SKU ID templates rather than bypassing validation |
| Toe-ring export has no prices | Supplied workbook has no offer columns; use a marketplace-approved offer template if required |
| Email configured but no messages arrive | Test SMTP reachability/TLS, verified sender, provider logs and spam folder |
| Login loops or verification link opens wrong host | Check exact HTTPS `CLIENT_URL`, same-origin `/api`, and production cookies |
| Linux cannot resolve UI imports | Keep the explicit `components/ui` → `components/Ui` aliases in Vite and TypeScript |
| Resource-limit errors or request timeout | Measure on Workers Paid, inspect CPU/memory/startup, reduce batches, and address the frontend timeout if needed |

## Official references checked

- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Runtime secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Current Worker limits: https://developers.cloudflare.com/workers/platform/limits/
