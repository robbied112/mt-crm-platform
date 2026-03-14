/**
 * Toast notification system
 * Extracted from index.html showToast().
 */

const TOAST_COLORS = {
  info: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
};

/**
 * Show a brief toast notification at the bottom of the screen.
 * @param {string} message - The text to display
 * @param {'info'|'success'|'warning'|'error'} type - Toast color variant
 */
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
    "padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;" +
    "z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15);" +
    "transition:opacity 0.3s;background:" +
    (TOAST_COLORS[type] || TOAST_COLORS.info);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
