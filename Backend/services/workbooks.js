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
  if (!rows.length) errors.push({ message: "Select at least one product." });
  if (rows.length > Math.min(50, template.capacity))
    errors.push({ message: "Each export supports up to 50 product rows." });
  rows.forEach((row, index) => {
    for (const f of template.fields) {
      const v = row[f.id],
        empty = v === undefined || v === null || String(v).trim() === "";
      const label = `Row ${index + 1}: ${f.label}`;
      if (f.required && empty)
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
  let xml = await zip.file(template.worksheetPath).async("string");
  const writable = new Set(template.fields.map((f) => f.column));
  xml = xml.replace(
    /<row\b([^>]*\br="(\d+)"[^>]*)>([\s\S]*?)<\/row>/g,
    (whole, attrs, rowNumber, body) => {
      const r = Number(rowNumber);
      if (r < template.dataStart || r > template.dataEnd) return whole;
      const values = rows[r - template.dataStart] || {};
      const existing = new Map();
      body = body.replace(
        /<c\b([^>]*?\br="([A-Z]+)\d+"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
        (cell, cellAttrs, column, content = "") => {
          if (!writable.has(column) || /<f[\s>]/.test(content)) return cell;
          existing.set(column, cellAttrs);
          return "";
        },
      );
      const newCells = [];
      for (const f of template.fields) {
        const v = values[f.id];
        const old = existing.get(f.column);
        if (v === undefined || v === null || String(v) === "") {
          if (old)
            newCells.push(`<c ${old.replace(/\s+t="[^"]*"/g, "").trim()}/>`);
          continue;
        }
        const a = (old || `r="${f.column}${r}"`)
          .replace(/\s+t="[^"]*"/g, "")
          .trim();
        newCells.push(
          f.type === "number"
            ? `<c ${a} t="n"><v>${Number(v)}</v></c>`
            : `<c ${a} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`,
        );
      }
      const all =
        (body + newCells.join("")).match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ||
        [];
      const colIndex = (c) => {
        const label = c.match(/\br="([A-Z]+)/)?.[1] || "";
        return [...label].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0);
      };
      all.sort((a, b) => colIndex(a) - colIndex(b));
      const other = body.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, "");
      return `<row${attrs}>${all.join("")}${other}</row>`;
    },
  );
  zip.file(template.worksheetPath, xml, { createFolders: false });
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
