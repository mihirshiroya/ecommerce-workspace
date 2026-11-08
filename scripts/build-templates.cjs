const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const XLSX = require("xlsx"),
  JSZip = require("../Backend/node_modules/jszip");
const { XMLParser } = require("../Backend/node_modules/fast-xml-parser");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  removeNSPrefix: true,
});
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
(async () => {
  const entries = [],
    bytes = {};
  for (const file of fs
    .readdirSync("data")
    .filter((f) => /^template-for-.+-(meesho|flipkart)-v\d+-.*\.xlsx$/.test(f))
    .sort()) {
    const match = file.match(/^template-for-(.+)-(meesho|flipkart)-(v\d+)-/),
      category = match[1],
      marketplace = match[2],
      version = match[3],
      key = `${marketplace}:${category}:${version}`;
    const flipkart = marketplace === "flipkart";
    const buffer = fs.readFileSync(path.join("data", file)),
      hash = crypto.createHash("sha256").update(buffer).digest("hex");
    if (bytes[key]) {
      if (entries.find((e) => e.key === key)?.templateHash === hash) continue;
      throw new Error(`Conflicting template files for ${key}: ${file}`);
    }
    const wb = XLSX.read(buffer, { cellStyles: true, cellFormula: true }),
      sheetName = flipkart
        ? {
            earring: "earring",
            mangalsutra: "mangalsutra_tanmaniya",
            pendant: "pendant_locket",
            "toe-ring": "ring",
          }[category]
        : wb.SheetNames.find((n) => n.includes("Fill this")),
      sheet = wb.Sheets[sheetName],
      idx = wb.SheetNames.indexOf(sheetName) + 1,
      worksheetPath = `xl/worksheets/sheet${idx}.xml`;
    const zip = await JSZip.loadAsync(buffer),
      xml = await zip.file(worksheetPath).async("string"),
      tree = parser.parse(xml).worksheet;
    const validations = [
        ...array(tree.dataValidations?.dataValidation),
        ...array(tree.extLst?.ext)
          .flatMap((e) => array(e.dataValidations?.dataValidation))
          .map((v) => ({
            ...v,
            "@sqref": v.sqref,
            formula1: v.formula1?.f || v.formula1,
          })),
      ],
      names = wb.Workbook?.Names || [];
    function options(formula) {
      if (!formula) return [];
      formula = String(formula).replace(/^=/, "");
      if (/^"/.test(formula)) return formula.replace(/^"|"$/g, "").split(",");
      const named = names.find((n) => n.Name === formula);
      if (named) formula = named.Ref;
      const m = formula.match(
        /^'?(.+?)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/,
      );
      if (!m) return [];
      const target = wb.Sheets[m[1].replace(/''/g, "'")];
      if (!target) return [];
      const vals = [];
      for (let r = Number(m[3]); r <= Number(m[5]); r++)
        for (
          let c = XLSX.utils.decode_col(m[2]);
          c <= XLSX.utils.decode_col(m[4]);
          c++
        ) {
          const v = target[XLSX.utils.encode_cell({ r: r - 1, c })]?.v;
          if (v !== undefined && String(v).trim()) vals.push(String(v).trim());
        }
      return [...new Set(vals)];
    }
    const styles = flipkart
      ? parser.parse(await zip.file("xl/styles.xml").async("string")).styleSheet
      : null;
    const headerCells = array(array(tree.sheetData.row)[0]?.c);
    const indexSheet = wb.Sheets.Index;
    const fields = [];
    for (let c = 3; c <= XLSX.utils.decode_range(sheet["!ref"]).e.c; c++) {
      if (flipkart && c !== 3 && c < 6) continue;
      const column = XLSX.utils.encode_col(c),
        text = String(sheet[column + (flipkart ? "1" : "3")]?.v || "").trim(),
        parts = text.split(/\n\s*\n/),
        label = parts.shift()?.trim();
      if (!label) continue;
      const format = String(sheet[column + "2"]?.v || "");
      const multiValue = flipkart && /^multi\s*-/i.test(format);
      const style =
        styles &&
        array(styles.cellXfs.xf)[
          Number(
            headerCells.find((cell) => cell["@r"] === column + "1")?.["@s"],
          )
        ];
      const color =
        style &&
        array(styles.fills.fill)[Number(style["@fillId"])]?.patternFill
          ?.fgColor?.["@indexed"];
      const applies = (v) =>
        String(v["@sqref"] || "")
          .split(/\s+/)
          .some((ref) => {
            try {
              const range = XLSX.utils.decode_range(ref.replace(/\$/g, ""));
              return c >= range.s.c && c <= range.e.c && range.e.r >= 4;
            } catch {
              return false;
            }
          });
      const applicable = validations.filter(applies);
      const validation =
        applicable.find((v) => v["@type"] === "list") || applicable[0];
      const lengthValidation = applicable.find(
        (v) => v["@type"] === "textLength",
      );
      let choices =
        validation?.["@type"] === "list" ? options(validation.formula1) : [];
      if (
        flipkart &&
        !choices.length &&
        /Allowed Values/i.test(format) &&
        indexSheet
      ) {
        const range = XLSX.utils.decode_range(indexSheet["!ref"]);
        for (let i = 3; i <= range.e.c; i++) {
          if (
            String(
              indexSheet[XLSX.utils.encode_cell({ r: 1, c: i })]?.v || "",
            ).trim() !== label
          )
            continue;
          for (let r = 2; r <= range.e.r; r++) {
            const value = indexSheet[XLSX.utils.encode_cell({ r, c: i })]?.v;
            if (value !== undefined && String(value).trim())
              choices.push(String(value).trim());
          }
          break;
        }
        choices = [...new Set(choices)];
        if (!choices.length)
          throw new Error(`Missing allowed values: ${key} ${column}`);
      }
      const numeric = flipkart
        ? /Single\s*-\s*(Positive_integer|Non_negative_integer|Number|Decimal)/i.test(
            format,
          ) || ["whole", "decimal"].includes(validation?.["@type"])
        : /price|^mrp$|weight|length|width|height|discount|inventory|quantity|net quantity|number of/i.test(
            label,
          );
      if (/^seller sku id$/i.test(label)) choices = [];
      const lastDataRow = flipkart
        ? XLSX.utils.decode_range(sheet["!ref"]).e.r
        : 303;
      let formula = false;
      for (let r = 4; r <= lastDataRow && !formula; r++)
        if (sheet[XLSX.utils.encode_cell({ r, c })]?.f) formula = true;
      const sample = sheet[column + "5"];
      const sampleText =
        sample && !sample.f && sample.v !== undefined
          ? String(sample.v).trim()
          : "";
      const dynamic = /^dynamic\b/i.test(sampleText);
      const normalize = (value) =>
        choices.find((o) => o === value) ||
        choices.find((o) => o.toLowerCase() === value.toLowerCase()) ||
        value;
      const defaultValue =
        dynamic || !sampleText
          ? ""
          : choices.length
            ? (multiValue ? sampleText.split("::") : [sampleText])
                .map((v) => normalize(v.trim()))
                .join("::")
            : sampleText;
      const type =
        choices.length && !multiValue
          ? "select"
          : numeric
            ? "number"
            : /image.*url|^url$/i.test(flipkart ? format : "") ||
                /image|url|link/i.test(label)
              ? "url"
              : "text";
      fields.push({
        id: column.toLowerCase(),
        column,
        index: c,
        label,
        description: flipkart
          ? [
              String(sheet[column + "4"]?.v || "").trim(),
              color === "17"
                ? "Conditionally mandatory: consult the template guidance for your product."
                : "",
              multiValue
                ? "Separate multiple values with :: (double colons)."
                : "",
            ]
              .filter(Boolean)
              .join("\n\n")
          : parts.join("\n\n").trim(),
        required: flipkart
          ? color === "12"
          : /Compulsory/i.test(sheet[column + "2"]?.v || ""),
        ...(flipkart
          ? {
              multiValue,
              conditional: color === "17",
              integer:
                validation?.["@type"] === "whole" || /integer/i.test(format),
              minimum: /Positive_integer/i.test(format)
                ? 1
                : numeric
                  ? 0
                  : undefined,
              maxLength: lengthValidation
                ? Number(lengthValidation.formula1)
                : undefined,
            }
          : {}),
        type,
        options: choices,
        default: defaultValue,
        dynamic,
        formula,
        group: /price|mrp|gst|hsn|discount/i.test(label)
          ? "Pricing & tax"
          : /image|url/i.test(label)
            ? "Product images"
            : /manufacturer|packer|importer|country/i.test(label)
              ? "Compliance"
              : "Product details",
        validation: validation
          ? {
              type: validation["@type"],
              formula1: validation.formula1,
              formula2: validation.formula2,
            }
          : null,
      });
    }
    const entry = {
      key,
      marketplace,
      category,
      version,
      schemaVersion: 1,
      templateHash: hash,
      status: "ready",
      ...(flipkart
        ? {
            warnings: [
              ...(category === "toe-ring"
                ? [
                    "This supplied workbook uses Flipkart’s ring worksheet and has no MRP, selling-price, or stock columns. The export preserves that catalogue-only structure.",
                  ]
                : []),
              "Purple fields are conditionally mandatory. Review the original template guidance for your product; category-specific conditional rules and marketplace acceptance are not certified.",
            ],
          }
        : {}),
      sheetName,
      worksheetPath,
      dataStart: 5,
      dataEnd: flipkart ? XLSX.utils.decode_range(sheet["!ref"]).e.r + 1 : 304,
      capacity: flipkart ? XLSX.utils.decode_range(sheet["!ref"]).e.r - 3 : 300,
      fields,
      sheetNames: wb.SheetNames,
      sourceFile: file,
    };
    entries.push(entry);
    bytes[key] = buffer.toString("base64");
  }
  for (const category of ["earring", "pendant", "mangalsutra", "toe-ring"])
    if (!entries.some((entry) => entry.key === `flipkart:${category}:v1`))
      entries.push({
        key: `flipkart:${category}:v1`,
        marketplace: "flipkart",
        category,
        version: "v1",
        status: "blocked",
        reason: "Awaiting the approved replacement XLSX template.",
        fields: [],
      });
  const out = "bulk-listing";
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "registry.json"),
    JSON.stringify(entries, null, 2),
  );
  fs.writeFileSync(
    path.join(out, "template-bytes.json"),
    JSON.stringify(bytes),
  );
  console.log(
    entries.map((e) => ({
      key: e.key,
      status: e.status,
      fields: e.fields.length,
      dropdowns: e.fields.filter((f) => f.options?.length).length,
      required: e.fields.filter((f) => f.required).length,
    })),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
