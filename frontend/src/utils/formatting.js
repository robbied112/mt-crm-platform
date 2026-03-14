/**
 * Formatting & display utilities
 * Extracted from index.html inline scripts.
 */

/**
 * XSS protection: escape user-provided strings before inserting into HTML.
 */
export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safe string for onclick="fn('...')" — escapes both HTML entities and JS single quotes.
 */
export function escAttr(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format currency value with $ prefix and US locale.
 */
export function formatCurrency(value) {
  return "$" + Number(value).toLocaleString("en-US");
}

/**
 * Generate an empty-state HTML placeholder.
 */
export function emptyState(icon, title, subtitle) {
  return (
    '<div style="text-align:center;padding:60px 20px;color:#64748b;">' +
    '<div style="font-size:48px;margin-bottom:16px;">' +
    icon +
    "</div>" +
    '<div style="font-size:18px;font-weight:600;color:#334155;margin-bottom:8px;">' +
    esc(title) +
    "</div>" +
    '<div style="font-size:14px;">' +
    esc(subtitle) +
    "</div></div>"
  );
}
