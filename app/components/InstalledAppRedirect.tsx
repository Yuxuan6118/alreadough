"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

// Older native builds and home-screen shortcuts still launch at the site root.
export default function InstalledAppRedirect() {
  useEffect(() => {
    const ios = navigator as Navigator & { standalone?: boolean };
    const query = new URLSearchParams(window.location.search);
    if (Capacitor.isNativePlatform() || ios.standalone || matchMedia("(display-mode: standalone)").matches || query.has("install") || query.has("vv")) {
      window.location.replace(`/app${window.location.search}${window.location.hash}`);
    }
  }, []);

  return null;
}
