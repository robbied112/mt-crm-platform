/**
 * Session timeout management
 * Extracted from index.html session timer logic.
 */

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
let _sessionTimer = null;

/**
 * Reset (or start) the inactivity session timer.
 * When the timer fires, it calls the provided onExpire callback.
 * @param {() => void} onExpire - Called when the session times out
 */
export function resetSessionTimer(onExpire) {
  if (_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(onExpire, SESSION_TIMEOUT_MS);
}

/**
 * Attach activity listeners that reset the session timer on user interaction.
 * @param {() => void} onExpire - Called when the session times out
 * @returns {() => void} cleanup - Call to remove all listeners
 */
export function initSessionWatcher(onExpire) {
  const handler = () => resetSessionTimer(onExpire);
  const events = ["click", "keydown", "scroll", "touchstart"];
  events.forEach((evt) =>
    document.addEventListener(evt, handler, { passive: true })
  );

  // Start the timer immediately
  resetSessionTimer(onExpire);

  // Return cleanup function
  return () => {
    events.forEach((evt) => document.removeEventListener(evt, handler));
    if (_sessionTimer) clearTimeout(_sessionTimer);
  };
}
