"use client";

import { useEffect } from "react";

/**
 * Phones are portrait only. The home-screen app and the native shells are locked in their own settings;
 * a normal browser tab cannot be locked, so when a phone is turned sideways this flags html.landscape-blocked
 * and the CSS covers the page with a "turn it upright" message.
 *
 * It reads the phone's real orientation (screen.orientation), not the page's width and height, because the
 * on-screen keyboard shrinks the page height and would otherwise look like landscape.
 */
function isPhone() {
  const small = Math.min(window.screen.width, window.screen.height) < 600;
  return small && window.matchMedia("(pointer: coarse)").matches;
}

function isSideways() {
  const type = window.screen.orientation?.type;
  if (type) return type.startsWith("landscape");
  const legacy = (window as Window & { orientation?: number }).orientation;
  return legacy === 90 || legacy === -90;
}

export default function OrientationGuard() {
  useEffect(() => {
    if (!isPhone()) return;
    const root = document.documentElement;
    const sync = () => root.classList.toggle("landscape-blocked", isSideways());
    // Works inside the installed home-screen app; a normal browser tab refuses, and the cover message takes over.
    // Chrome and the Google app on iPhone have no screen.orientation at all, so every step is optional.
    try {
      (window.screen.orientation as (ScreenOrientation & { lock?: (type: string) => Promise<void> }) | undefined)?.lock?.("portrait")?.catch(() => { /* not allowed here */ });
    } catch { /* not supported here */ }
    sync();
    window.addEventListener("orientationchange", sync);
    window.screen.orientation?.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("orientationchange", sync);
      window.screen.orientation?.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      root.classList.remove("landscape-blocked");
    };
  }, []);
  return null;
}
