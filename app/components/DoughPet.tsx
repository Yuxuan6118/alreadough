"use client";

import { useState } from "react";
import LivingDough from "./LivingDough";

type Props = {
  lang: "zh" | "en";
  checked: boolean;
  streak: number;
  onCheckIn: () => void;
  inline?: boolean;
};

export default function DoughPet({ lang, checked, streak, onCheckIn, inline = false }: Props) {
  const [celebration, setCelebration] = useState(0);
  const celebrate = () => {
    onCheckIn();
    setCelebration((value) => value + 1);
  };

  return (
    <aside className={`dough-pet${inline ? " dough-pet-inline" : ""}`} aria-live="polite">
      <LivingDough lang={lang} compact onTouch={celebrate} />
      <div className="pet-status">
        <strong>{checked ? (lang === "zh" ? "今天已打卡" : "Checked in today") : (lang === "zh" ? "点我打卡" : "Tap to check in")}</strong>
        <small>{lang === "zh" ? `连续 ${streak} 天` : `${streak}-day streak`}</small>
      </div>
      {inline && <small className="pet-hint">{lang === "zh" ? "双指捏一捏面团，松手它会弹回来" : "Pinch the dough with two fingers; let go and it springs back"}</small>}
      {celebration > 0 && <div className="pet-celebration" key={celebration} aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>}
    </aside>
  );
}
