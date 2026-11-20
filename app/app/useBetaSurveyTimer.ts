import { useEffect, useRef } from "react";
import { readStored, writeStored } from "@/lib/safe-storage";

/**
 * The one anonymous beta survey: after ten minutes of active use (the page visible), at most once a day, until
 * she has answered it. `onDue` opens it.
 */
export function useBetaSurveyTimer(hydrated: boolean, onDue: () => void) {
  const onDueRef = useRef(onDue);
  useEffect(() => { onDueRef.current = onDue; });

  useEffect(() => {
    if (!hydrated || readStored("already-beta-survey-complete-v1") === "yes") return;
    let accumulated = Number(readStored("already-active-use-ms-v1") || 0);
    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") accumulated += Math.max(0, Math.min(6000, now - lastTick));
      lastTick = now;
      writeStored("already-active-use-ms-v1", String(accumulated));
      // The stamp is written when the survey opens (not only when it is dismissed), so a reload cannot bring it back the same day.
      const lastShownAt = Number(readStored("already-beta-survey-dismissed-v1") || 0);
      if (accumulated >= 600_000 && (!lastShownAt || now - lastShownAt >= 86_400_000)) {
        writeStored("already-beta-survey-dismissed-v1", String(now));
        onDueRef.current();
      }
    };
    const resetTick = () => { lastTick = Date.now(); };
    document.addEventListener("visibilitychange", resetTick);
    const timer = window.setInterval(tick, 5000);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resetTick); };
  }, [hydrated]);
}
