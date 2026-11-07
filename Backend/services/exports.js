const { createHash } = require("node:crypto");
const { generateWorkbook } = require("./workbooks");

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

module.exports = { materializeExport };
