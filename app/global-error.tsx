"use client";

import { useEffect } from "react";

// Shown when the page crashes while rendering. It names the error so a crash on someone's phone can be diagnosed,
// and reports the message (no user data) to the server log through a request the Worker logs.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const detail = `${error?.name || "Error"}: ${error?.message || "unknown"}`.slice(0, 300);
  useEffect(() => {
    try {
      const stack = String(error?.stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 600);
      fetch(`/api/client-error?m=${encodeURIComponent(detail)}&s=${encodeURIComponent(stack)}&u=${encodeURIComponent(location.pathname)}`, { cache: "no-store" }).catch(() => {});
    } catch {}
  }, [detail, error]);
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#211d1d", color: "#fff8f4", fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 8px" }}>页面没能打开 · This page couldn’t load</h1>
          <p style={{ margin: "0 0 16px", color: "#c1b2ac", fontSize: 14 }}>请重新加载试试。Reload to try again.</p>
          <p style={{ margin: "0 0 20px", color: "#c1b2ac", fontSize: 12, wordBreak: "break-word" }}>{detail}{error?.digest ? ` (${error.digest})` : ""}</p>
          <button onClick={() => { reset(); location.reload(); }} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "#d18b98", color: "#2b2022", fontSize: 15 }}>重新加载 · Reload</button>
        </div>
      </body>
    </html>
  );
}
