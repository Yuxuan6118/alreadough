"use client";

import { useEffect } from "react";

/**
 * Phones: the page cannot be pinch-zoomed or double-tap-zoomed, like a native app.
 * Three layers, because Safari on iOS ignores the viewport meta's maximum-scale / user-scalable:
 *   1. layout.tsx declares maximum-scale=1 and user-scalable=no (Android Chrome and others honor it);
 *   2. CSS `touch-action: pan-x pan-y` on touch screens (also turns off double-tap zoom);
 *   3. here: Safari's proprietary gesture events and multi-finger moves are cancelled.
 * Desktop browsers are left alone.
 */
export default function NoPinchZoom() {
  useEffect(() => {
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    const stop = (event: Event) => event.preventDefault();
    const stopMultiTouch = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
    const options = { passive: false } as const;
    document.addEventListener("gesturestart", stop, options);
    document.addEventListener("gesturechange", stop, options);
    document.addEventListener("gestureend", stop, options);
    document.addEventListener("touchmove", stopMultiTouch, options);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchmove", stopMultiTouch);
    };
  }, []);
  return null;
}
