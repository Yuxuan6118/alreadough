"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export default function NativeShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add("native-app");
    Promise.allSettled([
      StatusBar.setStyle({ style: Style.Dark }),
      SplashScreen.hide({ fadeOutDuration: 280 }),
    ]);
    return () => document.documentElement.classList.remove("native-app");
  }, []);

  return null;
}
