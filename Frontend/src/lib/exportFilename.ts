export function filenameError(value: string) {
  const name = value.trim();
  if (!name) return "Enter the Excel filename for this account.";
  const stem = name.replace(/\.xlsx$/i, "");
  const filename = /\.xlsx$/i.test(name) ? name : `${name}.xlsx`;
  if (
    !stem ||
    /[^\x20-\x7E]|[<>:"/\\|?*]/.test(name) ||
    /^[. ]|[. ]$/.test(stem) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ||
    /\.(xlsx|xls|xlsm|csv|exe)$/i.test(stem)
  )
    return "Use an English filename without paths or special filename characters.";
  if (filename.length > 200)
    return "Use at most 200 characters including .xlsx.";
  return "";
}
