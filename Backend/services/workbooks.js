const JSZip = require("jszip");
const { createHash } = require("node:crypto");
const registry = require("../../bulk-listing/registry.json");
const templates = require("../../bulk-listing/template-bytes.json");
const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
function safePublicUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(
        u.hostname,
      ) &&
      u.hostname.includes(".") &&
      !u.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}
function validateRows(template, rows) {
  const errors = [];
  if (!rows.length) errors.push({ message: "Add at least one product row." });
  if (rows.length > Math.min(50, template.capacity))
    errors.push({ message: "Each export supports up to 50 product rows." });
  rows.forEach((row, index) => {
    for (const f of template.fields) {
      const v = row[f.id],
        empty = v === undefined || v === null || String(v).trim() === "";
      const label = `Row ${index + 1}: ${f.label}`;
      if (f.required && empty && !f.formula)
        errors.push({
          field: f.id,
          row: index,
          message: `${label} is required.`,
        });
      if (empty) continue;
      if (String(v).length > 32000)
        errors.push({
          field: f.id,
          row: index,
          message: `${label} exceeds the cell limit.`,
        });
      if (f.maxLength && String(v).length > f.maxLength)
        errors.push({
          field: f.id,
          row: index,
          message: `${label} must not exceed ${f.maxLength} characters.`,
        });
      if (
        f.type === "number" &&
        ((f.integer && !Number.isInteger(Number(v))) ||
          (f.minimum !== undefined && Number(v) < f.minimum))
      )
        errors.push({
          field: f.id,
          row: index,
          message: `${label} must be ${f.integer ? "a whole number" : "a number"} of at least ${f.minimum ?? 0}.`,
        });
      if (
        f.options.length &&
        String(v) !== f.default &&
        !(f.multiValue ? String(v).split("::") : [String(v)]).every((value) =>
          f.options.includes(value),
        )
      )
        errors.push({
          field: f.id,
          row: index,
          message: `${label} must use a template dropdown value.`,
        });
      if (f.type === "number" && (!Number.isFinite(Number(v)) || Number(v) < 0))
        errors.push({
          field: f.id,
          row: index,
          message: `${label} must be a non-negative number.`,
        });
      if (
        f.type === "number" &&
        /inventory|quantity|number of/i.test(f.label) &&
        !Number.isInteger(Number(v))
      )
        errors.push({
          field: f.id,
          row: index,
          message: `${label} must be a whole number.`,
        });
      if (
        f.type === "number" &&
        /price|mrp|discount/i.test(f.label) &&
        !/^\d+(\.\d{1,2})?$/.test(String(v))
      )
        errors.push({
          field: f.id,
          row: index,
          message: `${label} supports at most two decimal places.`,
        });
      if (f.type === "url" && !safePublicUrl(String(v)))
        errors.push({
          field: f.id,
          row: index,
          message: `${label} requires a public HTTPS image URL.`,
        });
    }
    if (template.marketplace === "flipkart") {
      const selling = template.fields.find((f) =>
        /^Your selling price/i.test(f.label),
      );
      const retail = template.fields.find((f) => /^MRP\b/i.test(f.label));
      if (selling && retail && Number(row[selling.id]) > Number(row[retail.id]))
        errors.push({
          row: index,
          field: selling.id,
          message: `Row ${index + 1}: Selling price must not exceed MRP.`,
        });
    }
    const price = template.fields.find((f) => /^meesho price$/i.test(f.label)),
      mrp = template.fields.find((f) => /^mrp$/i.test(f.label));
    if (price && mrp && Number(row[price.id]) >= Number(row[mrp.id]))
      errors.push({
        row: index,
        field: price.id,
        message: `Row ${index + 1}: Meesho price must be lower than MRP.`,
      });
  });
  return errors;
}
const INVALID_XML_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const unescapeXml = (value) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const columnNumber = (label) =>
  [...label].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0);
const columnLabel = (n) => {
  let label = "";
  for (; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
};
const splitRef = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { col: columnNumber(m[1]), row: Number(m[2]) };
};
const attr = (attrs, name) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];

// Shifts relative A1 references inside a shared formula when its master cell moves.
function shiftFormula(formula, dRow, dCol) {
  return formula
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(
            /(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g,
            (_, cAbs, col, rAbs, row) =>
              `${cAbs}${cAbs ? col : columnLabel(columnNumber(col) + dCol)}${rAbs}${rAbs ? row : Number(row) + dRow}`,
          ),
    )
    .join("");
}

async function loadSharedStrings(zip) {
  const path = "xl/sharedStrings.xml";
  const file = zip.file(path);
  if (!file) return null;
  const xml = await file.async("string");
  const items = xml.match(/<si\b[\s\S]*?<\/si>|<si\s*\/>/g) || [];
  const lookup = new Map();
  items.forEach((si, index) => {
    const plain =
      /^<si>\s*<t(?:\s+xml:space="preserve")?>([\s\S]*?)<\/t>\s*<\/si>$/.exec(
        si,
      );
    if (plain) {
      const text = unescapeXml(plain[1]);
      if (!lookup.has(text)) lookup.set(text, index);
    }
  });
  const added = [];
  let references = 0;
  return {
    path,
    index(text) {
      references++;
      if (lookup.has(text)) return lookup.get(text);
      const index = items.length + added.length;
      added.push(`<si><t xml:space="preserve">${escapeXml(text)}</t></si>`);
      lookup.set(text, index);
      return index;
    },
    serialize() {
      if (!added.length && !references) return xml;
      const count = Number(attr(xml.match(/<sst\b[^>]*>/)[0], "count") || 0);
      return xml
        .replace(/<sst\b[^>]*>/, (open) =>
          open
            .replace(/\scount="\d+"/, ` count="${count + references}"`)
            .replace(
              /\suniqueCount="\d+"/,
              ` uniqueCount="${items.length + added.length}"`,
            ),
        )
        .replace(/<\/sst>\s*$/, `${added.join("")}</sst>`);
    },
  };
}

// Excel reports "We found a problem with some content" when calcChain points at
// cells that no longer hold formulas, so let Excel rebuild it on open.
async function prepareRecalculation(zip) {
  const write = (name, content) =>
    zip.file(name, content, { createFolders: false });
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    const rels = "xl/_rels/workbook.xml.rels";
    write(
      rels,
      (await zip.file(rels).async("string")).replace(
        /<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/>/g,
        "",
      ),
    );
    const types = "[Content_Types].xml";
    write(
      types,
      (await zip.file(types).async("string")).replace(
        /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
        "",
      ),
    );
  }
  const book = "xl/workbook.xml";
  let workbook = await zip.file(book).async("string");
  workbook = /<calcPr\b/.test(workbook)
    ? workbook.replace(
        /<calcPr\b([^>]*?)\s*(\/?)>/,
        (_, a, close) =>
          `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${close ? "/" : ""}>`,
      )
    : workbook.replace(
        /(<\/sheets>(?:\s*<functionGroups\b[\s\S]*?(?:<\/functionGroups>|\/>))?(?:\s*<externalReferences\b[\s\S]*?<\/externalReferences>)?(?:\s*<definedNames\b[\s\S]*?<\/definedNames>)?)/,
        `$1<calcPr fullCalcOnLoad="1"/>`,
      );
  write(book, workbook);
}

function parseCells(body) {
  const cells = [];
  const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(body))) {
    const ref = attr(m[1], "r");
    const inner = m[2] || "";
    const f = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(inner);
    cells.push({
      ref,
      ...splitRef(ref),
      attrs: m[1],
      xml: m[0],
      formula: f
        ? {
            shared: attr(f[1], "t") === "shared",
            si: attr(f[1], "si"),
            ref: attr(f[1], "ref"),
            text: f[2] || "",
          }
        : null,
      hasValue: /<(v|is)\b[^>]*>[\s\S]*?<\/\1>/.test(inner),
    });
  }
  return cells;
}

// Writes values into the existing worksheet cells in place: styles, formulas,
// validations, and every other part of the template remain untouched.
function fillWorksheet(xml, template, rows, strings) {
  const start = xml.indexOf("<sheetData"),
    end = xml.lastIndexOf("</sheetData>");
  const open = xml.slice(start, xml.indexOf(">", start) + 1);
  if (open.endsWith("/>")) throw new Error("Template worksheet has no rows");
  const inner = xml.slice(start + open.length, end);
  const sheetRows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let m;
  while ((m = rowRe.exec(inner)))
    sheetRows.push({
      r: Number(attr(m[1], "r")),
      attrs: m[1],
      xml: m[0],
      cells: parseCells(m[2] || ""),
    });

  const writes = new Map();
  const lastRow = Math.min(
    template.dataEnd,
    template.dataStart + template.capacity - 1,
  );
  for (let r = template.dataStart; r <= lastRow; r++) {
    const values = rows[r - template.dataStart];
    const rowWrites = new Map();
    for (const f of template.fields) {
      const v = values?.[f.id];
      rowWrites.set(
        f.column,
        v === undefined || v === null
          ? ""
          : String(v).replace(INVALID_XML_CHARS, ""),
      );
    }
    writes.set(r, rowWrites);
  }
  const overwrites = (cell) =>
    !!writes.get(cell.row)?.get(columnLabel(cell.col));

  const masters = new Map(),
    children = new Map();
  for (const row of sheetRows)
    for (const cell of row.cells)
      if (cell.formula?.shared) {
        if (cell.formula.ref) masters.set(cell.formula.si, cell);
        else {
          if (!children.has(cell.formula.si)) children.set(cell.formula.si, []);
          children.get(cell.formula.si).push(cell);
        }
      }
  const promoted = new Map();
  for (const [si, master] of masters) {
    if (!overwrites(master)) continue;
    const heir = (children.get(si) || []).find((c) => !overwrites(c));
    if (!heir) continue;
    const endRef = master.formula.ref.split(":")[1] || master.formula.ref;
    promoted.set(
      heir.ref,
      `<f t="shared" ref="${heir.ref}:${endRef}" si="${si}">${shiftFormula(
        master.formula.text,
        heir.row - master.row,
        heir.col - master.col,
      )}</f>`,
    );
  }

  const valueCell = (ref, style, field, value) => {
    const s = style !== undefined ? ` s="${style}"` : "";
    if (
      field.type === "number" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value))
    )
      return `<c r="${ref}"${s}><v>${Number(value)}</v></c>`;
    if (strings)
      return `<c r="${ref}"${s} t="s"><v>${strings.index(value)}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  };
  const fieldsByColumn = new Map(template.fields.map((f) => [f.column, f]));

  const renderRow = (row) => {
    const rowWrites = writes.get(row.r);
    const touched =
      rowWrites || [...row.cells].some((c) => promoted.has(c.ref));
    if (!touched) return row.xml;
    const out = [];
    const seen = new Set();
    for (const cell of row.cells) {
      const column = columnLabel(cell.col);
      seen.add(column);
      const value = rowWrites?.get(column);
      const style = attr(cell.attrs, "s");
      if (value) {
        out.push({
          col: cell.col,
          xml: valueCell(cell.ref, style, fieldsByColumn.get(column), value),
        });
      } else if (promoted.has(cell.ref)) {
        out.push({
          col: cell.col,
          xml: cell.xml.replace(
            /<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/,
            promoted.get(cell.ref),
          ),
        });
      } else if (value === "" && !cell.formula && cell.hasValue) {
        out.push({
          col: cell.col,
          xml: `<c r="${cell.ref}"${style !== undefined ? ` s="${style}"` : ""}/>`,
        });
      } else out.push({ col: cell.col, xml: cell.xml });
    }
    if (rowWrites)
      for (const [column, value] of rowWrites)
        if (value && !seen.has(column))
          out.push({
            col: columnNumber(column),
            xml: valueCell(
              `${column}${row.r}`,
              undefined,
              fieldsByColumn.get(column),
              value,
            ),
          });
    out.sort((a, b) => a.col - b.col);
    return `<row${row.attrs}>${out.map((c) => c.xml).join("")}</row>`;
  };

  const existing = new Set(sheetRows.map((r) => r.r));
  for (const [r, rowWrites] of writes)
    if (!existing.has(r) && [...rowWrites.values()].some(Boolean))
      sheetRows.push({ r, attrs: ` r="${r}"`, xml: "", cells: [] });
  sheetRows.sort((a, b) => a.r - b.r);

  return (
    xml.slice(0, start + open.length) +
    sheetRows.map(renderRow).join("") +
    xml.slice(end)
  );
}

async function generateWorkbook(key, rows) {
  const template = registry.find((t) => t.key === key && t.status === "ready");
  if (!template)
    throw Object.assign(new Error("This template is not ready for export."), {
      status: 422,
    });
  const errors = validateRows(template, rows);
  if (errors.length)
    throw Object.assign(new Error("Listing validation failed."), {
      status: 422,
      details: errors,
    });
  const original = Buffer.from(templates[key], "base64");
  if (
    createHash("sha256").update(original).digest("hex") !==
    template.templateHash
  )
    throw new Error("Template integrity check failed");
  const zip = await JSZip.loadAsync(original);
  const sheetXml = await zip.file(template.worksheetPath).async("string");
  const strings = await loadSharedStrings(zip);
  const xml = fillWorksheet(sheetXml, template, rows, strings);
  zip.file(template.worksheetPath, xml, { createFolders: false });
  if (strings)
    zip.file(strings.path, strings.serialize(), { createFolders: false });
  await prepareRecalculation(zip);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
module.exports = {
  registry,
  validateRows,
  generateWorkbook,
  safePublicUrl,
  escapeXml,
};
