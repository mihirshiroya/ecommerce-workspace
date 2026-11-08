const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const { materializeExport, exportFilename, normalizeExcelFilename } = require("../Backend/services/exports");

test("Flipkart exports use the user's exact filename for every category", () => {
  const account = { name: "Seller account", seller_id: "64379028e72c46a6" };
  for (const category of ["mangalsutra", "ring", "pendant", "earring", "toe-ring"]) {
    const filename = `My ${category} batch (1).xlsx`;
    assert.equal(
      exportFilename({ marketplace: "flipkart", category }, account, randomUUID(), filename),
      filename,
    );
  }
});

test("filenames are trimmed, gain .xlsx when missing, and keep existing extension case", () => {
  assert.equal(normalizeExcelFilename("  My batch  "), "My batch.xlsx");
  assert.equal(normalizeExcelFilename("My batch.XLSX"), "My batch.XLSX");
  assert.equal(normalizeExcelFilename("a".repeat(195)), `${"a".repeat(195)}.xlsx`);
});

test("Flipkart filenames are required and unsafe filenames are rejected", () => {
  for (const name of [undefined, "", "  ", ".xlsx", "../file.xlsx", "folder/file.xlsx", "folder\\file.xlsx", 'file".xlsx', "file\r\n.xlsx", "file?.xlsx", "CON.xlsx", "a".repeat(196), "file.xlsx.xlsx", "file.exe.xlsx", "name..xlsx", "name.xls", "name.csv", "é.xlsx"]) {
    assert.throws(
      () => exportFilename({ marketplace: "flipkart" }, { name: "My account" }, randomUUID(), name),
      { status: 422 },
      String(name),
    );
  }
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
    filename: "My saved workbook.xlsx",
    template_key: template.key,
    snapshot: { rows: [row] },
  };
  const result = await materializeExport(record);
  assert.equal(result.status, "completed");
  assert.equal(result.filename, record.filename);
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
    filename: "My retry filename.xlsx",
    snapshot: { rows: [] },
  };
  const result = await materializeExport(record);
  assert.equal(result.status, "failed");
  assert.equal(result.filename, record.filename);
  assert.equal(result.file_base64, null);
  assert.equal(result.size, 0);
  assert.deepEqual(result.snapshot.rows, record.snapshot.rows);
  assert.match(result.snapshot.failure, /Workbook generation failed/);
});
