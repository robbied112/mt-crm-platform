/**
 * Setup Analytics — lightweight event tracking for the Setup Assistant.
 *
 * Fire-and-forget pattern:
 *   - Catches all Firestore errors silently (console.warn only)
 *   - Never blocks UI or surfaces errors to the user
 *   - Call without awaiting in UI code
 *
 * Events logged to: tenants/{tenantId}/analytics/setup/{eventId}
 * No global collections — distributor request names logged in tenant-scoped events.
 */

import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Log a setup event to Firestore.
 * @param {string} tenantId
 * @param {string} eventType - e.g., "setup_started", "guide_viewed", "setup_completed"
 * @param {Object} properties - event-specific data
 */
export function logSetupEvent(tenantId, eventType, properties = {}) {
  if (!tenantId) return;

  try {
    const db = getFirestore();
    const ref = collection(db, "tenants", tenantId, "analytics", "setup", "events");
    addDoc(ref, {
      type: eventType,
      properties,
      timestamp: serverTimestamp(),
    }).catch((err) => {
      console.warn(`[setupAnalytics] Failed to log ${eventType}:`, err.message);
    });
  } catch (err) {
    console.warn(`[setupAnalytics] Error creating event:`, err.message);
  }
}
