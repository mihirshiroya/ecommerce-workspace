const test = require("node:test"),
  assert = require("node:assert/strict");
const JSZip = require("../Backend/node_modules/jszip"),
  XLSX = require("xlsx");
const {
  registry,
  validateRows,
  generateWorkbook,
  safePublicUrl,
} = require("../Backend/services/workbooks");
const bytes = require("../bulk-listing/template-bytes.json");
function validRow(template) {
  const row = {};
  for (const f of template.fields) {
    if (f.formula) continue;
    row[f.id] = f.options.length
      ? f.options[0]
      : f.type === "number"
        ? "1"
        : f.type === "url"
          ? "https://images.example.com/product.jpg"
          : "Test product";
    if (/^meesho price$/i.test(f.label)) row[f.id] = "100";
    if (/^mrp$/i.test(f.label)) row[f.id] = "999";
  }
  return row;
}
for (const template of registry.filter((t) => t.status === "ready"))
  test(`${template.key}: original ZIP parts, formulas, validation, styles, and selected values survive`, async () => {
    const row = validRow(template);
    assert.equal(validateRows(template, [row]).length, 0);
    const output = await generateWorkbook(template.key, [row]),
      original = await JSZip.loadAsync(
        Buffer.from(bytes[template.key], "base64"),
      ),
      result = await JSZip.loadAsync(output);
    const rewritten = new Set([
      template.worksheetPath,
      "xl/sharedStrings.xml",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "[Content_Types].xml",
    ]);
    assert.deepEqual(
      Object.keys(result.files),
      Object.keys(original.files).filter((n) => n !== "xl/calcChain.xml"),
    );
    for (const name of Object.keys(original.files)) {
      if (
        original.files[name].dir ||
        rewritten.has(name) ||
        name === "xl/calcChain.xml"
      )
        continue;
      assert.ok(
        (await result.file(name).async("nodebuffer")).equals(
          await original.file(name).async("nodebuffer"),
        ),
        `Untouched part changed: ${name}`,
      );
    }
    const before = await original.file(template.worksheetPath).async("string"),
      after = await result.file(template.worksheetPath).async("string");
    for (const tag of [
      "dataValidations",
      "extLst",
      "mergeCells",
      "cols",
      "sheetViews",
      "sheetPr",
      "pageMargins",
    ])
      assert.deepEqual(
        after.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "g")),
        before.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "g")),
        tag,
      );
    assert.deepEqual(
      after.match(/<f[\s>][\s\S]*?<\/f>/g),
      before.match(/<f[\s>][\s\S]*?<\/f>/g),
    );
    for (let r = 1; r <= 4; r++)
      assert.equal(
        after.match(
          new RegExp(`<row[^>]* r="${r}"[^>]*>[\\s\\S]*?</row>`),
        )?.[0],
        before.match(
          new RegExp(`<row[^>]* r="${r}"[^>]*>[\\s\\S]*?</row>`),
        )?.[0],
      );
    const workbook = XLSX.read(output, { cellFormula: true }),
      sheet = workbook.Sheets[template.sheetName];
    assert.deepEqual(workbook.SheetNames, template.sheetNames);
    for (const f of template.fields) {
      if (f.formula) continue;
      assert.equal(
        String(sheet[f.column + "5"]?.v ?? ""),
        String(row[f.id] ?? ""),
        f.label,
      );
      for (let r = 6; r <= template.dataEnd; r++) {
        const cell = sheet[f.column + r];
        if (!cell?.f)
          assert.equal(
            String(cell?.v ?? ""),
            "",
            `Sample remains in ${f.column + r}`,
          );
      }
    }
    assert.ok(
      template.fields.some((f) => f.options.length > 0),
      "Extended dropdowns were extracted",
    );
  });
test("required, dropdown, pricing, image, capacity validation is authoritative", () => {
  const t = registry.find(
    (t) => t.status === "ready" && t.marketplace === "meesho",
  );
  assert.ok(validateRows(t, [{}]).length > 10);
  const row = validRow(t),
    choice = t.fields.find((f) => f.options.length);
  row[choice.id] = "INVALID_CHOICE";
  assert.ok(validateRows(t, [row]).some((e) => e.field === choice.id));
  const p = t.fields.find((f) => /^meesho price$/i.test(f.label));
  row[p.id] = "1000.999";
  assert.ok(validateRows(t, [row]).some((e) => e.field === p.id));
  assert.ok(
    validateRows(
      t,
      Array.from({ length: 51 }, () => validRow(t)),
    ).some((e) => e.message.includes("50")),
  );
});
for (const template of registry.filter(
  (t) => t.marketplace === "flipkart" && t.status === "ready",
)) {
  test(`${template.key}: constraints, multi-values, 50-row placement, and output-only cells`, async () => {
    assert.equal(template.dataStart, 5);
    assert.ok(template.capacity >= 50);
    assert.ok(template.fields.some((f) => f.required));
    assert.ok(
      !template.fields.some((f) =>
        ["A", "B", "C", "E", "F"].includes(f.column),
      ),
    );
    const row = validRow(template);
    const sku = template.fields.find((f) => f.label === "Seller SKU ID");
    assert.ok(
      validateRows(template, [{ ...row, [sku.id]: "x".repeat(65) }]).some(
        (e) => e.field === sku.id,
      ),
    );
    const price = template.fields.find((f) =>
      /^Your selling price/i.test(f.label),
    );
    const mrp = template.fields.find((f) => /^MRP\b/i.test(f.label));
    if (price && mrp) {
      assert.ok(
        validateRows(template, [
          { ...row, [price.id]: "2", [mrp.id]: "1" },
        ]).some((e) => e.field === price.id),
      );
      assert.ok(
        validateRows(template, [{ ...row, [price.id]: "1.5" }]).some(
          (e) => e.field === price.id,
        ),
      );
    } else {
      assert.equal(
        template.category,
        "toe-ring",
        "Only the supplied toe-ring workbook lacks offer price columns",
      );
      const numeric = template.fields.find((f) => f.type === "number");
      assert.ok(
        validateRows(template, [{ ...row, [numeric.id]: "-1" }]).some(
          (e) => e.field === numeric.id,
        ),
      );
    }
    const multi = template.fields.find(
      (f) => f.multiValue && f.options.length > 1,
    );
    assert.ok(multi, "Multi-value dropdowns must be extracted");
    row[multi.id] = multi.options.slice(0, 2).join("::");
    assert.equal(validateRows(template, [row]).length, 0);
    assert.ok(
      validateRows(template, [
        { ...row, [multi.id]: row[multi.id] + "::INVALID" },
      ]).some((e) => e.field === multi.id),
    );
    assert.deepEqual(sku.options, []);
    assert.ok(
      !validateRows(template, [
        { ...row, [sku.id]: "CUSTOM-ACCOUNT-SKU" },
      ]).some((e) => e.field === sku.id),
    );
    const model = template.fields.find((f) => /^Model Number$/i.test(f.label));
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...row,
      [model.id]: `MODEL-${i + 1}`,
    }));
    const text = template.fields.find((f) => /^Description$/i.test(f.label));
    if (text)
      rows[0][text.id] = '=HYPERLINK("https://example.com", "A&B <test>")';
    const output = await generateWorkbook(template.key, rows);
    const workbook = XLSX.read(output, { cellFormula: true }),
      sheet = workbook.Sheets[template.sheetName];
    assert.equal(sheet[model.column + "5"].v, "MODEL-1");
    assert.equal(sheet[model.column + "54"].v, "MODEL-50");
    assert.equal(sheet[sku.column + "5"].v, row[sku.id]);
    assert.equal(sheet[multi.column + "5"].v, row[multi.id]);
    if (text) {
      assert.equal(sheet[text.column + "5"].v, rows[0][text.id]);
      assert.equal(sheet[text.column + "5"].f, undefined);
    }
    const original = await JSZip.loadAsync(
      Buffer.from(bytes[template.key], "base64"),
    );
    const result = await JSZip.loadAsync(output);
    const before = await original.file(template.worksheetPath).async("string"),
      after = await result.file(template.worksheetPath).async("string");
    for (const column of ["A", "B", "C", "E", "F"]) {
      const regex = new RegExp(
        `<c\\b[^>]*?\\br="${column}\\d+"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`,
        "g",
      );
      assert.deepEqual(
        after.match(regex),
        before.match(regex),
        `Output-only column ${column}`,
      );
    }
  });
}
test("all four supplied Flipkart categories are enabled without enabling missing versions", () => {
  assert.deepEqual(
    registry
      .filter((t) => t.marketplace === "flipkart" && t.status === "ready")
      .map((t) => t.category)
      .sort(),
    ["earring", "mangalsutra", "pendant", "toe-ring"],
  );
  assert.equal(
    registry.find((t) => t.key === "flipkart:earring:v2"),
    undefined,
  );
});
test("private image addresses are rejected without fetching", () => {
  for (const url of [
    "http://example.com/p.jpg",
    "https://localhost/p.jpg",
    "https://127.0.0.1/p.jpg",
    "https://10.1.1.1/x",
    "https://169.254.169.254/latest",
    "https://[::1]/x",
    "https://user:pass@example.com/image.jpg",
  ])
    assert.equal(safePublicUrl(url), false, url);
  assert.equal(safePublicUrl("https://images.example.com/product.jpg"), true);
});
test("unsupported legacy and missing templates cannot export", async () => {
  await assert.rejects(
    () => generateWorkbook("flipkart:ring:v1", [{}]),
    /not ready/,
  );
  await assert.rejects(
    () => generateWorkbook("amazon:earring:v1", [{}]),
    /not ready/,
  );
});
test("formula-like values remain literal text and XML characters are escaped", async () => {
  const t = registry.find(
      (t) => t.status === "ready" && t.marketplace === "meesho",
    ),
    row = validRow(t),
    name = t.fields.find((f) => /^product name$/i.test(f.label));
  row[name.id] = '=HYPERLINK("https://example.com", "A&B <test>")';
  const out = await generateWorkbook(t.key, [row]);
  const s = XLSX.read(out).Sheets[t.sheetName];
  assert.equal(s[name.column + "5"].v, row[name.id]);
  assert.equal(s[name.column + "5"].f, undefined);
});

test("template defaults are extracted and dynamic markers are left for each product", () => {
  for (const t of registry.filter((t) => t.status === "ready")) {
    assert.ok(
      t.fields.some((f) => f.default),
      `${t.key} has defaults`,
    );
    for (const f of t.fields) {
      assert.ok(!/^dynamic/i.test(f.default || ""), `${t.key} ${f.label}`);
      if (f.dynamic) assert.equal(f.default, "");
    }
  }
});
test("overwriting a shared-formula master keeps the remaining formulas valid", async () => {
  const t = registry.find((t) => t.key === "meesho:ring:v1");
  const discount = t.fields.find((f) => f.column === "G");
  const rows = [0, 1].map(() => {
    const row = validRow(t);
    row[discount.id] = "5";
    return row;
  });
  const output = await generateWorkbook(t.key, rows);
  const zip = await JSZip.loadAsync(output);
  assert.equal(zip.file("xl/calcChain.xml"), null);
  assert.match(
    await zip.file("xl/workbook.xml").async("string"),
    /fullCalcOnLoad="1"/,
  );
  const xml = await zip.file(t.worksheetPath).async("string");
  for (const row of xml.match(/<row\b[\s\S]*?<\/row>/g)) {
    const refs = [...row.matchAll(/<c r="([A-Z]+\d+)"/g)].map((m) => m[1]);
    assert.equal(new Set(refs).size, refs.length, "duplicate cell");
  }
  const sheet = XLSX.read(output, { cellFormula: true }).Sheets[t.sheetName];
  assert.equal(sheet.G5.v, 5);
  assert.equal(sheet.G6.v, 5);
  assert.equal(sheet.G6.f, undefined);
  assert.match(sheet.G7.f, /F7/);
  assert.match(sheet.T6.f, /M6/);
});
