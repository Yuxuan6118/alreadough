"use client";

import { useEffect, useState } from "react";

/**
 * Diagnostic only. It renders nothing unless the address has ?vv=1, so normal visitors never see it.
 * It prints the numbers that decide where a `position: fixed` bottom bar lands on a phone, so a
 * screenshot from a real device shows exactly what that browser reports.
 */
export default function ViewportDebug() {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("vv")) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const read = () => {
      const vv = window.visualViewport;
      const nav = document.querySelector(".bottom-nav")?.getBoundingClientRect();
      const composer = document.querySelector(".composer")?.getBoundingClientRect();
      const doc = document.documentElement;
      const kb = getComputedStyle(doc).getPropertyValue("--kb-offset").trim() || "unset";
      setLines([
        `inner ${window.innerWidth}x${window.innerHeight}`,
        `client ${doc.clientWidth}x${doc.clientHeight}`,
        vv ? `visual ${Math.round(vv.width)}x${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} scale ${vv.scale}` : "visual n/a",
        `safe-bottom ${Math.round(probe.getBoundingClientRect().height)}  kb-offset ${kb}  kb-open ${doc.classList.contains("kb-open")}`,
        `focus ${document.activeElement?.tagName || "none"}  vv-top ${getComputedStyle(doc).getPropertyValue("--vv-top").trim() || "unset"}  vv-height ${getComputedStyle(doc).getPropertyValue("--vv-height").trim() || "unset"}`,
        (() => { const shell = document.querySelector(".app-shell")?.getBoundingClientRect(); const stage = document.querySelector(".app-stage"); return shell ? `shell top ${Math.round(shell.top)} bottom ${Math.round(shell.bottom)}  stage scroll ${Math.round(stage?.scrollTop || 0)}` : "shell none"; })(),
        `scrollY ${Math.round(window.scrollY)} / doc ${doc.scrollHeight}`,
        nav ? `nav top ${Math.round(nav.top)} bottom ${Math.round(nav.bottom)} h ${Math.round(nav.height)}` : "nav none",
        composer ? `composer bottom ${Math.round(composer.bottom)}` : "composer none",
        `standalone ${String((navigator as unknown as { standalone?: boolean }).standalone)}  ${navigator.userAgent.replace(/Mozilla\/5.0 \(|\) AppleWebKit.*/g, "").slice(0, 60)}`,
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
    };
  }, []);

  if (!lines) return null;
  return <pre style={{ position: "fixed", zIndex: 99999, top: "env(safe-area-inset-top)", left: 4, right: 4, margin: 0, padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,.78)", color: "#9fffb0", font: "11px/1.45 ui-monospace,Menlo,monospace", whiteSpace: "pre-wrap", pointerEvents: "none" }}>{lines.join("\n")}</pre>;
}
