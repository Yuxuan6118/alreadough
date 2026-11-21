"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import DoughLineMark from "./DoughLineMark";
import { readStored, writeStored } from "@/lib/safe-storage";
import "./space.css";
import "./welcome-gift.css";

// Over the sign-in page, once per browser: the first sign-in starts 7 days of Dough Atelier (the welcome week in
// lib/membership.ts). Not in the iPhone app.
const SEEN_KEY = "already-welcome-gift-v1";
const SHOW_AFTER_MS = 600;

// The desk pet's party burst (three quick taps): its 14 confetti directions (.pet-celebration, PetPreview SPOTS,
// desktop-pet confettiSpots) plus a ring of 18. CSS pixels, y down.
const CONFETTI: [number, number, number][] = [
  [-62, -68, -24], [-28, -86, 18], [10, -82, 42], [48, -64, 72], [70, -28, 94], [62, 22, 116], [28, 54, 148],
  [-14, 58, 184], [-52, 38, 214], [-72, 4, 244], [-76, -34, 282], [78, 8, 312], [34, -52, 338], [-36, -50, 8],
  ...Array.from({ length: 18 }, (_, index): [number, number, number] => {
    const angle = (index / 18) * Math.PI * 2;
    const reach = 70 + ((index * 37 + 50) % 36);
    return [Math.round(Math.cos(angle) * reach), Math.round(Math.sin(angle) * reach), (index * 67) % 360];
  }),
];

export default function WelcomeGift({ lang, onSignIn }: { lang: "zh" | "en"; onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  const signInButton = useRef<HTMLButtonElement>(null);
  const zh = lang === "zh";

  useEffect(() => {
    if (Capacitor.isNativePlatform() || readStored(SEEN_KEY)) return;
    const timer = window.setTimeout(() => { writeStored(SEEN_KEY, "1"); setOpen(true); }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    signInButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="confirm-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="confirm-dialog welcome-gift" role="dialog" aria-modal="true" aria-labelledby="welcome-gift-title" aria-describedby="welcome-gift-body">
        <span className="welcome-gift-mark">
          <DoughLineMark />
          <span className="welcome-gift-confetti" aria-hidden="true">
            {CONFETTI.map(([x, y, r], index) => <i key={index} style={{ "--x": `${x}px`, "--y": `${y}px`, "--r": `${r}deg` } as CSSProperties} />)}
          </span>
        </span>
        <h2 id="welcome-gift-title">{zh ? "登录就送 7 天丰盛工坊" : "Sign in for 7 free days of Dough Atelier"}</h2>
        <p id="welcome-gift-body">{zh ? "第一次登录自动开通，到期回到免费方案，不会扣款。" : "It starts on your first sign-in. Afterwards you are back on the free plan, with no charge."}</p>
        <div className="confirm-actions">
          <button type="button" ref={signInButton} className="confirm-ok" onClick={() => { setOpen(false); onSignIn(); }}>{zh ? "去登录" : "Sign in"}</button>
        </div>
      </div>
    </div>
  );
}
