"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a dialog mounted for a moment after it is closed, so it can play its exit.
 * `closing` is true during that moment; put a `closing` class on the dialog then.
 */
export function usePresence(open: boolean, exitMs = 180) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return;
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : exitMs;
    const timer = window.setTimeout(() => setMounted(false), wait);
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs]);
  return { mounted: open || mounted, closing: !open && mounted };
}
