"use client";

import { useState } from "react";
import LivingDough from "./LivingDough";

type Props = {
  lang: "zh" | "en";
  checked: boolean;
  streak: number;
  onCheckIn: () => void;
};

export default function DoughPet({ lang, checked, streak, onCheckIn }: Props) {
  const [celebration, setCelebration] = useState(0);
  const celebrate = () => {
    onCheckIn();
    setCelebration((value) => value + 1);
  };

  return (
    <aside className="dough-pet" aria-live="polite">
      <LivingDough lang={lang} compact onTouch={celebrate} />
      <div className="pet-status">
        <strong>{checked ? (lang === "zh" ? "今天已打卡" : "Checked in today") : (lang === "zh" ? "点我打卡" : "Tap to check in")}</strong>
        <small>{lang === "zh" ? `连续 ${streak} 天` : `${streak}-day streak`}</small>
      </div>
      {celebration > 0 && <div className="pet-celebration" key={celebration} aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>}
    </aside>
  );
}
