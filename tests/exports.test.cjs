const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const { materializeExport, exportFilename } = require("../Backend/services/exports");

test("Flipkart filenames use marketplace slugs, seller ID, IST timestamp and unique request IDs", () => {
  const account = { name: "Seller account", seller_id: "64379028e72c46a6" };
  const now = new Date("2026-11-08T05:27:00Z");
  for (const [category, slug] of Object.entries({
    mangalsutra: "mangalsutra-tanmaniya",
    ring: "ring",
    pendant: "pendant-locket",
    earring: "earring",
    "toe-ring": "toe-ring",
  })) {
    const template = { marketplace: "flipkart", category, version: "v1" };
    const filename = exportFilename(template, account, randomUUID(), now);
    assert.match(filename, new RegExp(`^C_${slug}_64379028e72c46a6_0811-1057FK_REQ[A-Z0-9]{11}\\.xlsx$`));
    assert.notEqual(exportFilename(template, account, randomUUID(), now), filename);
  }
});

test("Flipkart timestamps roll over at midnight in India", () => {
  assert.match(
    exportFilename(
      { marketplace: "flipkart", category: "ring" },
      { name: "Seller", seller_id: "seller123" },
      randomUUID(),
      new Date("2026-11-08T18:30:00Z"),
    ),
    /_0911-0000FK_REQ/,
  );
});

test("Flipkart exports require a safe seller ID rather than silently using account names", () => {
  for (const seller_id of ["", "../seller", 'seller"\r\n'])
    assert.throws(
      () => exportFilename({ marketplace: "flipkart", category: "ring" }, { name: "Seller", seller_id }, randomUUID()),
      { status: 422 },
    );
});

test("Meesho filenames retain their existing format", () => {
  assert.equal(
    exportFilename(
      { marketplace: "meesho", category: "ring", version: "v2" },
      { name: "My Shop", seller_id: "" },
      "12345678-1111-2222-3333-444444444444",
    ),
    "My_Shop_ring_v2_12345678.xlsx",
  );
});
const { registry } = require("../Backend/services/workbooks");

process.env.NODE_ENV = "production";

test("production exports retain exact workbook bytes in database records without external storage", async () => {
  const template = registry.find((item) => item.key === "meesho:earring:v1");
  const row = Object.fromEntries(
    template.fields
      .filter((field) => field.required)
      .map((field) => [
        field.id,
        field.options[0] ||
          (field.type === "number"
            ? "1"
            : field.type === "url"
              ? "https://images.example.com/product.jpg"
              : "Export test"),
      ]),
  );
  for (const field of template.fields) {
    if (/^meesho price$/i.test(field.label)) row[field.id] = "100";
    if (/^mrp$/i.test(field.label)) row[field.id] = "999";
  }
  const record = {
    id: randomUUID(),
    user_id: "export-test",
    template_key: template.key,
    snapshot: { rows: [row] },
  };
  const result = await materializeExport(record);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.snapshot, record.snapshot);
  const bytes = Buffer.from(result.file_base64, "base64");
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.equal(bytes.length, result.size);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    result.checksum,
  );
});

test("workbook generation failures retain their snapshot for account-specific retry", async () => {
  const record = {
    id: randomUUID(),
    template_key: "missing:template:v1",
    snapshot: { rows: [] },
  };
  const result = await materializeExport(record);
  assert.equal(result.status, "failed");
  assert.equal(result.file_base64, null);
  assert.equal(result.size, 0);
  assert.deepEqual(result.snapshot.rows, record.snapshot.rows);
  assert.match(result.snapshot.failure, /Workbook generation failed/);
});
