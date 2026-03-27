/**
 * BriefingContext — owns briefing state, feedback, and scroll position.
 * Separate from DataContext to keep concerns clean.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";

const BriefingContext = createContext(null);

export function BriefingProvider({ children }) {
  const { tenantId } = useAuth();
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState(null);
  const scrollPositionRef = useRef(0);

  // Subscribe to briefings/latest → then to the actual briefing doc
  useEffect(() => {
    if (!tenantId) {
      setBriefingLoading(false);
      return;
    }

    setBriefingLoading(true);
    setBriefingError(null);

    const latestRef = doc(db, "tenants", tenantId, "briefings", "latest");
    let briefingUnsub = null;

    const latestUnsub = onSnapshot(
      latestRef,
      (snap) => {
        if (!snap.exists() || !snap.data()?.latestId) {
          setBriefing(null);
          setBriefingLoading(false);
          return;
        }

        const latestId = snap.data().latestId;

        // Clean up previous briefing subscription
        if (briefingUnsub) briefingUnsub();

        const briefingRef = doc(db, "tenants", tenantId, "briefings", latestId);
        briefingUnsub = onSnapshot(
          briefingRef,
          (briefingSnap) => {
            if (briefingSnap.exists()) {
              setBriefing({ id: briefingSnap.id, ...briefingSnap.data() });
            } else {
              setBriefing(null);
            }
            setBriefingLoading(false);
          },
          (err) => {
            console.error("[BriefingContext] Briefing doc error:", err.message);
            setBriefingError("Failed to load briefing");
            setBriefingLoading(false);
          }
        );
      },
      (err) => {
        console.error("[BriefingContext] Latest pointer error:", err.message);
        setBriefingError("Failed to load briefing");
        setBriefingLoading(false);
      }
    );

    return () => {
      latestUnsub();
      if (briefingUnsub) briefingUnsub();
    };
  }, [tenantId]);

  const submitFeedback = useCallback(async (type) => {
    if (!tenantId || !briefing?.id) return;
    try {
      const ref = doc(db, "tenants", tenantId, "briefings", briefing.id);
      await updateDoc(ref, {
        feedback: type,
        feedbackAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[BriefingContext] Feedback error:", err.message);
    }
  }, [tenantId, briefing?.id]);

  const saveScrollPosition = useCallback((pos) => {
    scrollPositionRef.current = pos;
  }, []);

  const restoreScrollPosition = useCallback(() => {
    const pos = scrollPositionRef.current;
    scrollPositionRef.current = 0;
    return pos;
  }, []);

  return (
    <BriefingContext.Provider
      value={{
        briefing,
        briefingLoading,
        briefingError,
        submitFeedback,
        saveScrollPosition,
        restoreScrollPosition,
      }}
    >
      {children}
    </BriefingContext.Provider>
  );
}

export function useBriefing() {
  const ctx = useContext(BriefingContext);
  if (!ctx) throw new Error("useBriefing must be used inside BriefingProvider");
  return ctx;
}

export default BriefingProvider;
