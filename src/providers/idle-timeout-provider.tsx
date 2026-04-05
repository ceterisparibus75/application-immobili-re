"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_MS = 60 * 1000; // Avertissement 1 minute avant

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const logout = useCallback(() => {
    setShowWarning(false);
    signOut({ callbackUrl: "/login?reason=idle" });
  }, []);

  const resetTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
  }, [logout]);

  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetTimers();
    }
  }, [showWarning, resetTimers]);

  useEffect(() => {
    resetTimers();

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [handleActivity, resetTimers]);

  function handleStayConnected() {
    setShowWarning(false);
    resetTimers();
  }

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Session inactive</h2>
            <p className="text-sm text-muted-foreground">
              Vous allez être déconnecté dans moins d&apos;une minute pour des raisons de sécurité.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStayConnected}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Rester connecté
              </button>
              <button
                onClick={logout}
                className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
