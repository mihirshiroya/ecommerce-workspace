const test = require("node:test"),
  assert = require("node:assert/strict"),
  { randomBytes, randomUUID, createHash } = require("node:crypto");
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString("hex");
const app = require("../Backend/app"),
  { createConnection, scope } = require("../Backend/db"),
  { registry } = require("../Backend/services/workbooks");
const rollback = Symbol("rollback-test-records");
test(
  "real Neon transaction: local auth, ownership, mappings, draft conflicts, per-account export, download isolation, and revocation",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const connection = createConnection(process.env.DATABASE_URL);
    try {
      await connection.db
        .transaction(async (tx) => {
          let server;
          await new Promise((resolve) => {
            server = require("node:http")
              .createServer((req, res) =>
                scope.run({ db: tx }, () => app(req, res)),
              )
              .listen(0, "127.0.0.1", resolve);
          });
          const base = `http://127.0.0.1:${server.address().port}`;
          async function call(path, { method = "GET", data, token } = {}) {
            return tx
              .transaction(async () => {
                const response = await fetch(base + "/api" + path, {
                  method,
                  headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "ListingStudio",
                    ...(token ? { Authorization: "Bearer " + token } : {}),
                  },
                  ...(data ? { body: JSON.stringify(data) } : {}),
                });
                const body = await response.json();
                const result = { response, body, status: response.status };
                if (response.status >= 400) throw result;
                return result;
              })
              .catch((error) => {
                if (error.response) return error;
                throw error;
              });
          }
          try {
            const suffix = randomUUID();
            const signup = async (label) =>
              call("/auth/register", {
                method: "POST",
                data: {
                  email: `v0-rollback-${label}-${suffix}@example.com`,
                  password: "TestOnly-Strong-123!",
                  firstName: "Test",
                  lastName: "Seller",
                },
              });
            const one = await signup("a"),
              two = await signup("b");
            assert.equal(one.status, 201);
            assert.equal(two.status, 201);
            const login = await call("/auth/login", {
              method: "POST",
              data: {
                email: `v0-rollback-b-${suffix}@example.com`,
                password: "TestOnly-Strong-123!",
              },
            });
            assert.equal(login.status, 200);
            assert.equal(login.body.data.user.id, two.body.data.user.id);
            const a = one.body.data.tokens.accessToken,
              b = two.body.data.tokens.accessToken;
            assert.ok(
              one.response.headers
                .getSetCookie()
                .every((c) => /HttpOnly/i.test(c) && /Secure/i.test(c)),
            );
            assert.equal(
              (await call("/auth/profile", { token: a })).status,
              200,
            );
            assert.equal((await call("/users", { token: a })).status, 403);
            const acc = async (name) =>
              call("/workspace/accounts", {
                method: "POST",
                token: a,
                data: { name, marketplace: "meesho", status: "active" },
              });
            const aa = await acc("Rollback account A"),
              ab = await acc("Rollback account B");
            assert.equal(aa.status, 201);
            assert.equal(ab.status, 201);
            const accountA = aa.body.data,
              accountB = ab.body.data;
            const created = await call("/workspace/skus", {
              method: "POST",
              token: a,
              data: {
                sku: "  test-global-001  ",
                name: "Transactional earring",
                category: "earring",
                images: ["https://images.example.com/earring.jpg"],
              },
            });
            assert.equal(created.status, 201);
            const sku = created.body.data;
            assert.equal(sku.sku, "TEST-GLOBAL-001");
            assert.equal(
              (
                await call("/workspace/skus", {
                  method: "POST",
                  token: a,
                  data: {
                    sku: "TEST-GLOBAL-001",
                    name: "Duplicate",
                    category: "earring",
                  },
                })
              ).status,
              409,
            );
            assert.equal(
              (await call("/workspace/skus", { token: b })).body.data.length,
              0,
            );
            assert.deepEqual(sku.images, [
              "https://images.example.com/earring.jpg",
            ]);
            const updatedImages = [
              "https://images.example.com/primary.jpg",
              "https://images.example.com/secondary.jpg",
            ];
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id, {
                  method: "PUT",
                  token: a,
                  data: { ...sku, images: updatedImages },
                })
              ).status,
              200,
            );
            const catalog = await call("/workspace/skus", { token: a });
            assert.deepEqual(
              catalog.body.data.find((item) => item.id === sku.id).images,
              updatedImages,
            );
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id, {
                  method: "PUT",
                  token: a,
                  data: { ...sku, images: ["http://localhost/private.png"] },
                })
              ).status,
              400,
            );
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id, {
                  method: "PUT",
                  token: a,
                  data: { ...sku, images: Array(9).fill(updatedImages[0]) },
                })
              ).status,
              400,
            );
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id, {
                  method: "PUT",
                  token: b,
                  data: { ...sku, images: [] },
                })
              ).status,
              404,
            );
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id + "/images", {
                  method: "POST",
                  token: a,
                  data: {},
                })
              ).status,
              404,
            );
            const map = await call("/workspace/mappings", {
              method: "POST",
              token: a,
              data: {
                global_sku_id: sku.id,
                account_id: accountA.id,
                account_sku: "ACCOUNT-A-001",
              },
            });
            assert.equal(map.status, 201);
            const mappingUpdate = {
              global_sku_id: sku.id,
              account_id: accountA.id,
              account_sku: "ACCOUNT-A-002",
              notes: "Updated alternate SKU",
            };
            assert.equal(
              (
                await call("/workspace/mappings/" + map.body.data.id, {
                  method: "PUT",
                  token: a,
                  data: mappingUpdate,
                })
              ).status,
              200,
            );
            assert.equal(
              (
                await call("/workspace/mappings/" + map.body.data.id, {
                  method: "PUT",
                  token: b,
                  data: mappingUpdate,
                })
              ).status,
              404,
            );
            assert.equal(
              (
                await call("/workspace/mappings/" + map.body.data.id, {
                  method: "PUT",
                  token: a,
                  data: { ...mappingUpdate, account_id: accountB.id },
                })
              ).status,
              422,
            );
            assert.equal(
              (
                await call("/workspace/mappings", {
                  method: "POST",
                  token: b,
                  data: {
                    global_sku_id: sku.id,
                    account_id: accountA.id,
                    account_sku: "FOREIGN",
                  },
                })
              ).status,
              404,
            );
            assert.equal(
              (
                await call("/workspace/accounts/" + accountA.id, {
                  method: "DELETE",
                  token: b,
                })
              ).status,
              404,
            );
            const template = registry.find(
                (t) => t.key === "meesho:earring:v1",
              ),
              values = {};
            for (const f of template.fields) {
              if (!f.required) continue;
              values[f.id] = f.options.length
                ? f.options[0]
                : f.type === "number"
                  ? "1"
                  : f.type === "url"
                    ? "https://images.example.com/earring.jpg"
                    : "Transactional product";
              if (/^meesho price$/i.test(f.label)) values[f.id] = "100";
              if (/^mrp$/i.test(f.label)) values[f.id] = "999";
            }
            const titleField = template.fields.find((f) =>
              /^product name$/i.test(f.label),
            );
            values[titleField.id] = "Common product title";
            const product = {
              id: randomUUID(),
              globalSkuId: sku.id,
              values,
              overrides: {
                [accountA.id]: {
                  mappingId: map.body.data.id,
                  values: { [titleField.id]: "Account A product title" },
                },
                [accountB.id]: { values: { [titleField.id]: "" } },
              },
            };
            const payload = {
              name: "Rollback export verification",
              template_key: template.key,
              data: {
                accountIds: [accountA.id, accountB.id],
                products: [product],
              },
            };
            const valid = await call("/workspace/validate", {
              method: "POST",
              token: a,
              data: payload,
            });
            assert.equal(valid.status, 200);
            assert.ok(
              valid.body.data.accounts.every((a) => a.errors.length === 0),
            );
            const invalid = structuredClone(payload);
            invalid.data.products[0].overrides[accountB.id].mappingId =
              map.body.data.id;
            assert.equal(
              (
                await call("/workspace/validate", {
                  method: "POST",
                  token: a,
                  data: invalid,
                })
              ).status,
              422,
            );
            const draft = await call("/workspace/drafts", {
              method: "POST",
              token: a,
              data: payload,
            });
            assert.equal(draft.status, 201);
            const saved = draft.body.data;
            assert.equal(
              (await call("/workspace/drafts/" + saved.id, { token: b }))
                .status,
              404,
            );
            const update = await call("/workspace/drafts/" + saved.id, {
              method: "PUT",
              token: a,
              data: { ...payload, revision: 1 },
            });
            assert.equal(update.status, 200);
            assert.equal(update.body.data.revision, 2);
            assert.equal(
              (
                await call("/workspace/drafts/" + saved.id, {
                  method: "PUT",
                  token: a,
                  data: { ...payload, revision: 1 },
                })
              ).status,
              409,
            );
            assert.equal(
              (
                await call("/workspace/accounts/" + accountA.id, {
                  method: "DELETE",
                  token: a,
                })
              ).status,
              409,
            );
            assert.equal(
              (
                await call("/workspace/skus/" + sku.id, {
                  method: "DELETE",
                  token: a,
                })
              ).status,
              409,
            );
            const generated = await call(
              "/workspace/drafts/" + saved.id + "/export",
              { method: "POST", token: a, data: { revision: 2 } },
            );
            assert.equal(generated.status, 201);
            assert.equal(generated.body.data.length, 2);
            assert.ok(
              generated.body.data.every((file) => file.status === "completed"),
            );
            assert.ok(
              generated.body.data.every((file) => !("file_base64" in file)),
            );
            assert.equal(
              (await call("/workspace/history", { token: b })).body.data.length,
              0,
            );
            const XLSX = require("xlsx");
            for (const file of generated.body.data) {
              assert.equal(
                (
                  await call("/workspace/history/" + file.id + "/download", {
                    token: b,
                  })
                ).status,
                404,
              );
              const response = await fetch(
                base + "/api/workspace/history/" + file.id + "/download",
                { headers: { Authorization: "Bearer " + a } },
              );
              assert.equal(response.status, 200);
              const bytes = Buffer.from(await response.arrayBuffer());
              assert.equal(
                createHash("sha256").update(bytes).digest("hex"),
                file.checksum,
              );
              const cell =
                XLSX.read(bytes).Sheets[template.sheetName][
                  titleField.column + "5"
                ];
              assert.equal(
                cell.v,
                file.account_id === accountA.id
                  ? "Account A product title"
                  : "Common product title",
              );
            }
            const failedId = randomUUID();
            await tx
              .insert(require("../Backend/db/schema").exportsTable)
              .values({
                id: failedId,
                user_id: one.body.data.user.id,
                draft_id: saved.id,
                account_id: accountA.id,
                batch_id: generated.body.data[0].batch_id,
                filename: `retry_${failedId.slice(0, 8)}.xlsx`,
                template_key: template.key,
                template_hash: template.templateHash,
                snapshot: {
                  rows: [values],
                  account: accountA,
                  draftRevision: 2,
                  failure: "Workbook generation failed.",
                },
                row_count: 1,
                size: 0,
                status: "failed",
              });
            assert.equal(
              (
                await call("/workspace/history/" + failedId + "/download", {
                  token: a,
                })
              ).status,
              409,
            );
            assert.equal(
              (
                await call("/workspace/history/" + failedId + "/retry", {
                  method: "POST",
                  token: b,
                  data: {},
                })
              ).status,
              404,
            );
            const retried = await call(
              "/workspace/history/" + failedId + "/retry",
              { method: "POST", token: a, data: {} },
            );
            assert.equal(retried.status, 201);
            assert.equal(retried.body.data.status, "completed");
            assert.notEqual(retried.body.data.id, failedId);
            const history = await call("/workspace/history", { token: a });
            assert.equal(
              history.body.data.find((file) => file.id === failedId).status,
              "failed",
            );
            const refreshed = await call("/auth/refresh-token", {
              method: "POST",
              data: { refreshToken: one.body.data.tokens.refreshToken },
            });
            assert.equal(refreshed.status, 200);
            assert.equal(
              (await call("/workspace/dashboard", { token: a })).status,
              401,
            );
            const access = refreshed.body.data.tokens.accessToken;
            assert.equal(
              (await call("/workspace/dashboard", { token: access })).status,
              200,
            );
            assert.equal(
              (
                await call("/auth/logout", {
                  method: "POST",
                  data: {
                    refreshToken: refreshed.body.data.tokens.refreshToken,
                  },
                })
              ).status,
              200,
            );
            assert.equal(
              (await call("/workspace/dashboard", { token: access })).status,
              401,
            );
          } finally {
            await new Promise((resolve) => server.close(resolve));
          }
          throw rollback;
        })
        .catch((error) => {
          if (error !== rollback) throw error;
        });
    } finally {
      await connection.pool.end();
    }
  },
);
