const { createHash } = require("node:crypto");
const { generateWorkbook } = require("./workbooks");

function normalizeExcelFilename(value) {
  const name = typeof value === "string" ? value.trim() : "";
  const stem = name.replace(/\.xlsx$/i, "");
  const filename = /\.xlsx$/i.test(name) ? name : `${name}.xlsx`;
  if (
    !stem ||
    /[^\x20-\x7E]|[<>:"/\\|?*]/.test(name) ||
    /^[. ]|[. ]$/.test(stem) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ||
    /\.(xlsx|xls|xlsm|csv|exe)$/i.test(stem) ||
    filename.length > 200
  ) {
    const error = new Error(
      "Enter an Excel filename (up to 200 characters including .xlsx). Use English letters, numbers, spaces, hyphens, underscores, dots or parentheses; do not use paths or special filename characters.",
    );
    error.status = 422;
    throw error;
  }
  return filename;
}

function exportFilename(template, account, id, requestedFilename) {
  if (template.marketplace !== "flipkart")
    return `${account.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${template.category}_${template.version}_${id.slice(0, 8)}.xlsx`;
  try {
    return normalizeExcelFilename(requestedFilename);
  } catch (error) {
    error.message = `${account.name}: ${error.message}`;
    throw error;
  }
}

async function materializeExport(record) {
  try {
    const bytes = await generateWorkbook(
      record.template_key,
      record.snapshot.rows,
    );
    return {
      ...record,
      file_base64: bytes.toString("base64"),
      checksum: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      status: "completed",
    };
  } catch (error) {
    console.error("Account workbook generation failed", {
      exportId: record.id,
      message: error.message,
    });
    return {
      ...record,
      snapshot: {
        ...record.snapshot,
        failure:
          "Workbook generation failed. Retry this account from listing history.",
      },
      file_base64: null,
      checksum: "",
      size: 0,
      status: "failed",
    };
  }
}

module.exports = { materializeExport, exportFilename, normalizeExcelFilename };
