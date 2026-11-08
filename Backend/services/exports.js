const { createHash, randomInt } = require("node:crypto");
const { generateWorkbook } = require("./workbooks");

function exportFilename(template, account, id, now = new Date()) {
  if (template.marketplace !== "flipkart")
    return `${account.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${template.category}_${template.version}_${id.slice(0, 8)}.xlsx`;

  const sellerId = String(account.seller_id || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(sellerId)) {
    const error = new Error(
      `Set a valid seller ID for ${account.name} before exporting to Flipkart. Use only letters, numbers, underscores or hyphens.`,
    );
    error.status = 422;
    throw error;
  }
  const slug = {
    mangalsutra: "mangalsutra-tanmaniya",
    pendant: "pendant-locket",
  }[template.category] || template.category;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const requestId = Array.from({ length: 11 }, () =>
    alphabet[randomInt(alphabet.length)],
  ).join("");
  return `C_${slug}_${sellerId}_${parts.day}${parts.month}-${parts.hour}${parts.minute}FK_REQ${requestId}.xlsx`;
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

module.exports = { materializeExport, exportFilename };
