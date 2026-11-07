const router = require("express").Router();
const { z } = require("zod");
const {
  eq,
  and,
  or,
  ilike,
  desc,
  count,
  inArray,
  sql,
} = require("drizzle-orm");
const { randomUUID, createHash } = require("node:crypto");
const { db } = require("../db");
const {
  accounts,
  skus,
  mappings,
  drafts,
  exportsTable,
  activity,
} = require("../db/schema");
const { authenticate } = require("../middleware/auth");
const {
  registry,
  validateRows,
  safePublicUrl,
} = require("../services/workbooks");
const { materializeExport } = require("../services/exports");
router.get("/templates", (_, res) =>
  res.json({ success: true, data: registry }),
);
router.use(authenticate);
const uuid = z.string().uuid(),
  text = z.string().trim().max(2000),
  short = z.string().trim().max(160),
  code = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform((v) => v.toUpperCase());
const category = z.enum([
  "earring",
  "pendant",
  "ring",
  "mangalsutra",
  "toe-ring",
]);
const accountSchema = z.object({
  marketplace: z.enum(["meesho", "flipkart", "amazon"]),
  name: short.min(1),
  seller_id: short.default(""),
  business_name: short.default(""),
  contact_email: z.union([z.email(), z.literal("")]).default(""),
  address: text.default(""),
  notes: text.default(""),
  status: z.enum(["active", "inactive"]).default("active"),
});
const imageSchema = z
  .string()
  .max(2048)
  .refine(
    safePublicUrl,
    "Use a public HTTPS URL, not a local or private address.",
  );
const skuSchema = z.object({
  sku: code,
  name: short.min(1),
  category,
  description: z.string().trim().max(10000).default(""),
  notes: text.default(""),
  attributes: z
    .record(
      z.string().max(100),
      z.union([z.string().max(32000), z.number(), z.boolean()]),
    )
    .default({}),
  images: z.array(imageSchema).max(8).default([]),
});
const mappingSchema = z.object({
  global_sku_id: uuid,
  account_id: uuid,
  account_sku: code,
  marketplace_ref: short.default(""),
  notes: text.default(""),
});
const fieldValues = z.record(
  z.string().max(100),
  z.union([z.string().max(32000), z.number(), z.boolean()]),
);
const draftData = z.object({
  accountIds: z.array(uuid).min(1).max(5),
  products: z
    .array(
      z.object({
        id: uuid,
        globalSkuId: uuid,
        values: fieldValues,
        overrides: z
          .record(
            z.string().uuid(),
            z.object({ mappingId: uuid.optional(), values: fieldValues }),
          )
          .default({}),
      }),
    )
    .min(1)
    .max(50),
});
const draftSchema = z.object({
  name: short.min(1),
  template_key: short.min(1),
  data: draftData,
  revision: z.number().int().positive().optional(),
});
const owned = (table, user, id) =>
  and(eq(table.user_id, user), eq(table.id, uuid.parse(id)));
const fail = (status, message, details) => {
  throw Object.assign(new Error(message), { status, details });
};
async function getOwned(table, user, id) {
  const [row] = await db
    .select()
    .from(table)
    .where(owned(table, user, id));
  if (!row) fail(404, "This record is not available in your workspace.");
  return row;
}
async function log(user, action, type, id, summary, executor = db) {
  await executor.insert(activity).values({
    user_id: user,
    action,
    entity_type: type,
    entity_id: id,
    summary,
  });
}
const send = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
function filters(req, table, cols) {
  const q = z
    .string()
    .max(120)
    .parse(String(req.query.q || ""));
  return and(
    eq(table.user_id, req.user.id),
    q ? or(...cols.map((c) => ilike(c, `%${q}%`))) : undefined,
  );
}
router.get("/dashboard", async (req, res) => {
  const u = req.user.id;
  const [a, s, d, e, recent, latest] = await Promise.all([
    db.select({ total: count() }).from(accounts).where(eq(accounts.user_id, u)),
    db.select({ total: count() }).from(skus).where(eq(skus.user_id, u)),
    db
      .select({ total: count() })
      .from(drafts)
      .where(and(eq(drafts.user_id, u), eq(drafts.status, "draft"))),
    db
      .select({ total: count() })
      .from(exportsTable)
      .where(eq(exportsTable.user_id, u)),
    db
      .select()
      .from(activity)
      .where(eq(activity.user_id, u))
      .orderBy(desc(activity.created_at))
      .limit(6),
    db
      .select()
      .from(drafts)
      .where(eq(drafts.user_id, u))
      .orderBy(desc(drafts.updated_at))
      .limit(5),
  ]);
  send(res, {
    accounts: a[0].total,
    skus: s[0].total,
    drafts: d[0].total,
    exports: e[0].total,
    activity: recent,
    recentDrafts: latest,
  });
});
router.get("/accounts", async (req, res) => {
  const where = filters(req, accounts, [
    accounts.name,
    accounts.seller_id,
    accounts.business_name,
  ]);
  const conditions = and(
    where,
    req.query.marketplace
      ? eq(
          accounts.marketplace,
          z.enum(["meesho", "flipkart", "amazon"]).parse(req.query.marketplace),
        )
      : undefined,
    req.query.status
      ? eq(
          accounts.status,
          z.enum(["active", "inactive"]).parse(req.query.status),
        )
      : undefined,
  );
  send(
    res,
    await db
      .select()
      .from(accounts)
      .where(conditions)
      .orderBy(desc(accounts.updated_at))
      .limit(200),
  );
});
router.post("/accounts", async (req, res) => {
  const data = accountSchema.parse(req.body);
  const [row] = await db
    .insert(accounts)
    .values({ ...data, user_id: req.user.id })
    .returning();
  await log(
    req.user.id,
    "created",
    "account",
    row.id,
    `Added ${row.name} on ${row.marketplace}`,
  );
  send(res, row, 201);
});
router.put("/accounts/:id", async (req, res) => {
  const data = accountSchema.parse(req.body);
  const before = await getOwned(accounts, req.user.id, req.params.id);
  if (before.marketplace !== data.marketplace) {
    const refs = await db
      .select({ id: mappings.id })
      .from(mappings)
      .where(
        and(
          eq(mappings.user_id, req.user.id),
          eq(mappings.account_id, before.id),
        ),
      )
      .limit(1);
    if (refs.length)
      fail(
        409,
        "Remove existing SKU mappings before changing the marketplace.",
      );
  }
  const [row] = await db
    .update(accounts)
    .set({ ...data, updated_at: new Date() })
    .where(owned(accounts, req.user.id, req.params.id))
    .returning();
  await log(req.user.id, "updated", "account", row.id, `Updated ${row.name}`);
  send(res, row);
});
router.delete("/accounts/:id", async (req, res) => {
  const row = await getOwned(accounts, req.user.id, req.params.id);
  const refs = await db
    .select({ id: drafts.id })
    .from(drafts)
    .where(
      and(
        eq(drafts.user_id, req.user.id),
        sql`${drafts.data}->'accountIds' @> ${JSON.stringify([row.id])}::jsonb`,
      ),
    )
    .limit(1);
  if (refs.length)
    fail(409, "This account is used by a draft. Deactivate it instead.");
  await db.delete(accounts).where(owned(accounts, req.user.id, row.id));
  await log(req.user.id, "deleted", "account", row.id, `Deleted ${row.name}`);
  send(res, { id: row.id });
});
router.get("/skus", async (req, res) => {
  send(
    res,
    await db
      .select()
      .from(skus)
      .where(
        and(
          filters(req, skus, [skus.name, skus.sku]),
          req.query.category
            ? eq(skus.category, category.parse(req.query.category))
            : undefined,
        ),
      )
      .orderBy(desc(skus.updated_at))
      .limit(200),
  );
});
router.post("/skus", async (req, res) => {
  const data = skuSchema.parse(req.body);
  const [row] = await db
    .insert(skus)
    .values({ ...data, user_id: req.user.id })
    .returning();
  await log(
    req.user.id,
    "created",
    "sku",
    row.id,
    `Created global SKU ${row.sku}`,
  );
  send(res, row, 201);
});
router.put("/skus/:id", async (req, res) => {
  const data = skuSchema.parse(req.body);
  const [row] = await db
    .update(skus)
    .set({ ...data, updated_at: new Date() })
    .where(owned(skus, req.user.id, req.params.id))
    .returning();
  if (!row) fail(404, "SKU not found.");
  await log(req.user.id, "updated", "sku", row.id, `Updated ${row.sku}`);
  send(res, row);
});
router.delete("/skus/:id", async (req, res) => {
  const row = await getOwned(skus, req.user.id, req.params.id);
  const refs = await db
    .select({ id: drafts.id })
    .from(drafts)
    .where(
      and(
        eq(drafts.user_id, req.user.id),
        sql`${drafts.data}->'products' @> ${JSON.stringify([{ globalSkuId: row.id }])}::jsonb`,
      ),
    )
    .limit(1);
  if (refs.length)
    fail(
      409,
      "This SKU is referenced by a draft. Remove it from drafts first.",
    );
  await db.delete(skus).where(owned(skus, req.user.id, row.id));
  await log(req.user.id, "deleted", "sku", row.id, `Deleted ${row.sku}`);
  send(res, { id: row.id });
});
router.get("/mappings", async (req, res) => {
  send(
    res,
    await db
      .select()
      .from(mappings)
      .where(
        and(
          eq(mappings.user_id, req.user.id),
          req.query.sku
            ? eq(mappings.global_sku_id, uuid.parse(req.query.sku))
            : undefined,
          req.query.account
            ? eq(mappings.account_id, uuid.parse(req.query.account))
            : undefined,
        ),
      )
      .orderBy(desc(mappings.created_at))
      .limit(1000),
  );
});
router.post("/mappings", async (req, res) => {
  const data = mappingSchema.parse(req.body);
  await getOwned(skus, req.user.id, data.global_sku_id);
  const account = await getOwned(accounts, req.user.id, data.account_id);
  if (account.status !== "active")
    fail(422, "Activate this seller account before adding mappings.");
  const [row] = await db
    .insert(mappings)
    .values({ ...data, user_id: req.user.id })
    .returning();
  await log(
    req.user.id,
    "created",
    "mapping",
    row.id,
    `Added account SKU ${row.account_sku} for ${account.name}`,
  );
  send(res, row, 201);
});
router.put("/mappings/:id", async (req, res) => {
  const previous = await getOwned(mappings, req.user.id, req.params.id);
  const data = mappingSchema.parse(req.body);
  if (
    data.account_id !== previous.account_id ||
    data.global_sku_id !== previous.global_sku_id
  )
    fail(
      422,
      "A mapping's account and global SKU cannot be changed. Create another mapping instead.",
    );
  await getOwned(skus, req.user.id, data.global_sku_id);
  const account = await getOwned(accounts, req.user.id, data.account_id);
  if (account.status !== "active")
    fail(422, "Activate this account before editing its mappings.");
  const [row] = await db
    .update(mappings)
    .set(data)
    .where(owned(mappings, req.user.id, previous.id))
    .returning();
  await log(
    req.user.id,
    "updated",
    "mapping",
    row.id,
    `Updated account SKU ${row.account_sku}`,
  );
  send(res, row);
});
router.delete("/mappings/:id", async (req, res) => {
  const row = await getOwned(mappings, req.user.id, req.params.id);
  await db.delete(mappings).where(owned(mappings, req.user.id, row.id));
  await log(
    req.user.id,
    "deleted",
    "mapping",
    row.id,
    `Removed account SKU ${row.account_sku}`,
  );
  send(res, { id: row.id });
});
async function resolve(user, payload) {
  const template = registry.find((t) => t.key === payload.template_key);
  if (!template || template.status !== "ready")
    fail(422, "A validated XLSX template is required.");
  const data = draftData.parse(payload.data);
  const selected = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.user_id, user), inArray(accounts.id, data.accountIds)),
    );
  if (
    selected.length !== new Set(data.accountIds).size ||
    new Set(data.accountIds).size !== data.accountIds.length
  )
    fail(422, "One or more seller accounts are invalid.");
  if (
    selected.some(
      (a) => a.status !== "active" || a.marketplace !== template.marketplace,
    )
  )
    fail(422, "Select active accounts for the template marketplace.");
  const ids = [...new Set(data.products.map((p) => p.globalSkuId))];
  const catalog = await db
    .select()
    .from(skus)
    .where(and(eq(skus.user_id, user), inArray(skus.id, ids)));
  if (
    catalog.length !== ids.length ||
    catalog.some((s) => s.category !== template.category)
  )
    fail(
      422,
      "Select products owned by your workspace in the matching category.",
    );
  if (new Set(data.products.map((p) => p.id)).size !== data.products.length)
    fail(422, "Product entry identifiers must be unique.");
  const mapIds = data.products.flatMap((p) =>
    Object.values(p.overrides)
      .map((o) => o.mappingId)
      .filter(Boolean),
  );
  const mapRows = mapIds.length
    ? await db
        .select()
        .from(mappings)
        .where(and(eq(mappings.user_id, user), inArray(mappings.id, mapIds)))
    : [];
  const allowed = new Set(template.fields.map((f) => f.id));
  for (const p of data.products) {
    if (Object.keys(p.values).some((k) => !allowed.has(k)))
      fail(422, "Unknown listing field.");
    for (const [accountId, o] of Object.entries(p.overrides)) {
      if (
        !data.accountIds.includes(accountId) ||
        Object.keys(o.values).some((k) => !allowed.has(k))
      )
        fail(422, "Invalid account override.");
      if (
        o.mappingId &&
        !mapRows.some(
          (m) =>
            m.id === o.mappingId &&
            m.account_id === accountId &&
            m.global_sku_id === p.globalSkuId,
        )
      )
        fail(
          422,
          "SKU mapping must belong to this account and global product.",
        );
    }
  }
  const files = selected.map((account) => ({
    account,
    rows: data.products.map((p) => {
      const product = catalog.find((s) => s.id === p.globalSkuId);
      const values = { ...product.attributes };
      for (const field of template.fields) {
        if (/^product name$/i.test(field.label))
          values[field.id] = product.name;
        else if (/supplier.*sku|sku.*id|^sku$/i.test(field.label))
          values[field.id] = product.sku;
        else if (/description/i.test(field.label))
          values[field.id] = product.description;
        else if (/image/i.test(field.label)) {
          const n = /^Other Image URL/i.test(field.label)
            ? Number(field.label.match(/\d+/)?.[0] || 1)
            : Number(field.label.match(/\d+/)?.[0] || 1) - 1;
          values[field.id] = product.images[n] || "";
        }
      }
      const override = p.overrides[account.id];
      Object.assign(
        values,
        p.values,
        Object.fromEntries(
          Object.entries(override?.values || {}).filter(
            ([, value]) => value !== "",
          ),
        ),
      );
      if (override?.mappingId) {
        const m = mapRows.find((m) => m.id === override.mappingId);
        for (const f of template.fields)
          if (/supplier.*sku|sku.*id|^sku$/i.test(f.label))
            values[f.id] = m.account_sku;
      }
      return values;
    }),
  }));
  return { template, data, files };
}
router.get("/drafts", async (req, res) =>
  send(
    res,
    await db
      .select()
      .from(drafts)
      .where(eq(drafts.user_id, req.user.id))
      .orderBy(desc(drafts.updated_at))
      .limit(100),
  ),
);
router.get("/drafts/:id", async (req, res) =>
  send(res, await getOwned(drafts, req.user.id, req.params.id)),
);
router.post("/drafts", async (req, res) => {
  const payload = draftSchema.parse(req.body);
  await resolve(req.user.id, payload);
  const [row] = await db
    .insert(drafts)
    .values({
      user_id: req.user.id,
      name: payload.name,
      template_key: payload.template_key,
      data: payload.data,
    })
    .returning();
  await log(req.user.id, "saved", "draft", row.id, `Saved draft ${row.name}`);
  send(res, row, 201);
});
router.put("/drafts/:id", async (req, res) => {
  const payload = draftSchema.parse(req.body);
  if (!payload.revision) fail(400, "Draft revision is required.");
  await getOwned(drafts, req.user.id, req.params.id);
  await resolve(req.user.id, payload);
  const [row] = await db
    .update(drafts)
    .set({
      name: payload.name,
      template_key: payload.template_key,
      data: payload.data,
      revision: sql`${drafts.revision}+1`,
      updated_at: new Date(),
      status: "draft",
    })
    .where(
      and(
        owned(drafts, req.user.id, req.params.id),
        eq(drafts.revision, payload.revision),
      ),
    )
    .returning();
  if (!row)
    fail(409, "This draft changed in another tab. Reload it before saving.");
  send(res, row);
});
router.delete("/drafts/:id", async (req, res) => {
  const row = await getOwned(drafts, req.user.id, req.params.id);
  await db.delete(drafts).where(owned(drafts, req.user.id, row.id));
  send(res, { id: row.id });
});
router.post("/validate", async (req, res) => {
  const payload = draftSchema.parse(req.body),
    result = await resolve(req.user.id, payload);
  send(res, {
    accounts: result.files.map((f) => ({
      account: f.account.name,
      accountId: f.account.id,
      rows: f.rows.length,
      errors: validateRows(result.template, f.rows),
    })),
  });
});
router.post("/history/:id/retry", async (req, res) => {
  const previous = await getOwned(exportsTable, req.user.id, req.params.id);
  if (previous.status !== "failed")
    fail(409, "Only failed exports can be retried.");
  const account = await getOwned(accounts, req.user.id, previous.account_id);
  if (account.status !== "active")
    fail(422, "Activate this seller account before retrying.");
  const template = registry.find(
    (t) =>
      t.key === previous.template_key &&
      t.templateHash === previous.template_hash,
  );
  if (!template)
    fail(
      409,
      "The original template version is unavailable. Create a new listing instead.",
    );
  const { failure, ...snapshot } = previous.snapshot;
  const id = randomUUID();
  const row = await materializeExport({
    id,
    user_id: req.user.id,
    draft_id: previous.draft_id,
    account_id: previous.account_id,
    batch_id: previous.batch_id,
    filename: previous.filename.replace(
      /_[a-f0-9]{8}\.xlsx$/,
      `_${id.slice(0, 8)}.xlsx`,
    ),
    template_key: previous.template_key,
    template_hash: previous.template_hash,
    snapshot: { ...snapshot, retryOf: previous.id },
    row_count: previous.row_count,
  });
  const [created] = await db.insert(exportsTable).values(row).returning();
  await log(
    req.user.id,
    "retried",
    "export",
    id,
    `Retried workbook for ${account.name}: ${created.status}`,
  );
  const { file_base64, snapshot: savedSnapshot, ...safe } = created;
  send(res, { ...safe, failure: savedSnapshot.failure }, 201);
});
router.post("/drafts/:id/export", async (req, res) => {
  const draft = await getOwned(drafts, req.user.id, req.params.id);
  if (req.body.revision !== draft.revision)
    fail(409, "Save your latest changes before export.");
  const result = await resolve(req.user.id, draft);
  const allErrors = result.files.flatMap((f) =>
    validateRows(result.template, f.rows).map((e) => ({
      ...e,
      account: f.account.name,
    })),
  );
  if (allErrors.length)
    fail(422, "Fix the listing validation errors before export.", allErrors);
  const batchId = randomUUID();
  const output = [];
  for (const f of result.files) {
    const id = randomUUID();
    output.push(
      await materializeExport({
        id,
        user_id: req.user.id,
        draft_id: draft.id,
        account_id: f.account.id,
        batch_id: batchId,
        filename: `${f.account.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${result.template.category}_${result.template.version}_${id.slice(0, 8)}.xlsx`,
        template_key: draft.template_key,
        template_hash: result.template.templateHash,
        snapshot: {
          draftRevision: draft.revision,
          account: f.account,
          rows: f.rows,
        },
        row_count: f.rows.length,
      }),
    );
  }
  await db.transaction(async (tx) => {
    await tx.insert(exportsTable).values(output);
    await tx
      .update(drafts)
      .set({
        status: output.every((e) => e.status === "completed")
          ? "exported"
          : "draft",
      })
      .where(owned(drafts, req.user.id, draft.id));
    await log(
      req.user.id,
      "exported",
      "batch",
      batchId,
      `Generated ${output.filter((e) => e.status === "completed").length} of ${output.length} account workbooks from ${draft.name}`,
      tx,
    );
  });
  send(
    res,
    output.map(({ file_base64, snapshot, ...e }) => ({
      ...e,
      failure: snapshot.failure,
    })),

    201,
  );
});
router.get("/history", async (req, res) =>
  send(
    res,
    await db
      .select({
        id: exportsTable.id,
        draft_id: exportsTable.draft_id,
        account_id: exportsTable.account_id,
        batch_id: exportsTable.batch_id,
        filename: exportsTable.filename,
        template_key: exportsTable.template_key,
        row_count: exportsTable.row_count,
        size: exportsTable.size,
        status: exportsTable.status,
        checksum: exportsTable.checksum,
        failure: sql`${exportsTable.snapshot}->>'failure'`,
        created_at: exportsTable.created_at,
      })
      .from(exportsTable)
      .where(eq(exportsTable.user_id, req.user.id))
      .orderBy(desc(exportsTable.created_at))
      .limit(200),
  ),
);
router.get("/history/:id/download", async (req, res) => {
  const item = await getOwned(exportsTable, req.user.id, req.params.id);
  if (item.status !== "completed")
    fail(409, "This export failed. Retry it from listing history.");
  if (!item.file_base64)
    fail(
      409,
      "This older export has no database file. Re-export its draft to create a downloadable workbook.",
    );
  const bytes = Buffer.from(item.file_base64, "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== item.checksum)
    fail(409, "Export checksum verification failed.");
  res.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.set("Content-Disposition", `attachment; filename="${item.filename}"`);
  res.send(bytes);
});
module.exports = router;
