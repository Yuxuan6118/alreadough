"use client";

import { useEffect, useState } from "react";

/**
 * Diagnostic only. It renders nothing unless the address has ?vv=1, or the logo was tapped 5 times in a row
 * (that works inside the iPhone home-screen app, where there is no address bar; tap 5 times again to hide it).
 * It prints the numbers that decide where a `position: fixed` bar lands on a phone and what colour the strip at
 * the very top gets, so a screenshot from a real device shows exactly what that browser reports.
 */
const FLAG = "already-vv";

export default function ViewportDebug() {
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the address and the saved flag */
    let saved = false;
    try { saved = window.localStorage.getItem(FLAG) === "1"; } catch { /* storage can be blocked */ }
    setEnabled(new URLSearchParams(window.location.search).has("vv") || saved);
    /* eslint-enable react-hooks/set-state-in-effect */
    let taps = 0;
    let timer = 0;
    const onTap = (event: Event) => {
      if (!(event.target as Element | null)?.closest?.(".brand, .brand-mark")) return;
      taps += 1;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { taps = 0; }, 2500);
      if (taps >= 5) {
        taps = 0;
        setEnabled((value) => {
          const next = !value;
          try { window.localStorage.setItem(FLAG, next ? "1" : "0"); } catch { /* storage can be blocked */ }
          return next;
        });
      }
    };
    document.addEventListener("click", onTap, true);
    return () => { document.removeEventListener("click", onTap, true); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!enabled) { setLines(null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- hides the panel when switched off
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none";
    const topProbe = document.createElement("div");
    topProbe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    document.body.appendChild(topProbe);
    const read = () => {
      const vv = window.visualViewport;
      const nav = document.querySelector(".bottom-nav")?.getBoundingClientRect();
      const composer = document.querySelector(".composer")?.getBoundingClientRect();
      const doc = document.documentElement;
      const style = getComputedStyle(doc);
      const strip = getComputedStyle(doc, "::before");
      const kb = style.getPropertyValue("--kb-offset").trim() || "unset";
      const metas = [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => `${(meta as HTMLMetaElement).content}${(meta as HTMLMetaElement).media ? `@${(meta as HTMLMetaElement).media}` : ""}`).join(" ") || "none";
      setLines([
        `TOP: safe-top ${Math.round(topProbe.getBoundingClientRect().height)}  html theme ${doc.dataset.theme || "unset"}  sys-dark ${window.matchMedia("(prefers-color-scheme: dark)").matches}`,
        `html bg ${style.backgroundColor}  body bg ${getComputedStyle(document.body).backgroundColor}  color-scheme ${style.colorScheme}`,
        `strip(::before) h ${strip.height} bg ${strip.backgroundColor} pos ${strip.position}`,
        `theme-color ${metas}`,
        `standalone nav ${String((navigator as unknown as { standalone?: boolean }).standalone)}  mq ${window.matchMedia("(display-mode: standalone)").matches}`,
        `inner ${window.innerWidth}x${window.innerHeight}  client ${doc.clientWidth}x${doc.clientHeight}`,
        vv ? `visual ${Math.round(vv.width)}x${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} scale ${vv.scale}` : "visual n/a",
        `safe-bottom ${Math.round(probe.getBoundingClientRect().height)}  kb-offset ${kb}  kb-open ${doc.classList.contains("kb-open")}`,
        `vv-top ${style.getPropertyValue("--vv-top").trim() || "unset"}  vv-height ${style.getPropertyValue("--vv-height").trim() || "unset"}`,
        (() => { const shell = document.querySelector(".app-shell")?.getBoundingClientRect(); const stage = document.querySelector(".app-stage"); return shell ? `shell top ${Math.round(shell.top)} bottom ${Math.round(shell.bottom)}  stage scroll ${Math.round(stage?.scrollTop || 0)}` : "shell none"; })(),
        nav ? `nav top ${Math.round(nav.top)} bottom ${Math.round(nav.bottom)} h ${Math.round(nav.height)}` : "nav none",
        composer ? `composer bottom ${Math.round(composer.bottom)}` : "composer none",
        navigator.userAgent.replace(/Mozilla\/5.0 \(|\) AppleWebKit.*/g, "").slice(0, 60),
      ]);
    };
    read();
    const timer = window.setInterval(read, 400);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    window.visualViewport?.addEventListener("scroll", read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("scroll", read);
      probe.remove();
      topProbe.remove();
    };
  }, [enabled]);

  if (!lines) return null;
  return <pre style={{ position: "fixed", zIndex: 99999, top: "env(safe-area-inset-top)", left: 4, right: 4, margin: 0, padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,.78)", color: "#9fffb0", font: "11px/1.45 ui-monospace,Menlo,monospace", whiteSpace: "pre-wrap", pointerEvents: "none" }}>{lines.join("\n")}</pre>;
}
