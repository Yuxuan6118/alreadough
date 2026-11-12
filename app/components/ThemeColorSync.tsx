"use client";

import { useEffect } from "react";

/**
 * The browser's top bar (status bar strip and address bar on phones) takes its colour from <meta name="theme-color">.
 * The built-in tags follow the phone's system setting, but the app has its own day/night choice, so every page
 * (not only the home screen) keeps one tag in step with html[data-theme], whichever way the theme changes.
 * It runs after hydration, so replacing the server's tags cannot cause a mismatch.
 */
const LIGHT = "#f4efea";
const DARK = "#211d1d";

export default function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-app-theme]');
      if (!meta) {
        document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove());
        meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.setAttribute("data-app-theme", "yes");
        document.head.appendChild(meta);
      }
      meta.content = root.dataset.theme === "dark" ? DARK : LIGHT;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
