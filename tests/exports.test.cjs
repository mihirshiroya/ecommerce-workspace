const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const { materializeExport } = require("../Backend/services/exports");
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
