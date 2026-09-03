"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Capacitor } from "@capacitor/core";
import Image from "next/image";

type Props = {
  lang: "zh" | "en";
  compact?: boolean;
  onTouch?: () => void;
};

export default function LivingDough({ lang, compact = false, onTouch }: Props) {
  const reduceMotion = useReducedMotion();
  const [response, setResponse] = useState(0);

  const touch = async () => {
    setResponse((value) => value + 1);
    onTouch?.();
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    }
  };

  return (
    <button
      type="button"
      className={`living-dough ${compact ? "compact" : ""}`}
      onClick={touch}
      aria-label={lang === "zh" ? "轻触正在醒发的面团" : "Touch the living dough"}
    >
      <span className="dough-stage" aria-hidden="true">
        <motion.span
          key={response}
          className="dough-character-shell"
          initial={reduceMotion ? false : { scaleX: 1, scaleY: 1 }}
          animate={reduceMotion ? undefined : response ? { scaleX: [1, 1.06, 0.97, 1], scaleY: [1, 0.88, 1.05, 1], y: [0, 7, -3, 0] } : { scaleX: [1, 1.012, 1], scaleY: [1, 1.03, 1], y: [0, -2, 0] }}
          transition={response ? { duration: 0.78, ease: [0.16, 1, 0.3, 1] } : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image className="dough-character" src="/mascot/already-dough-v2.png" alt="" width={800} height={629} sizes={compact ? "132px" : "360px"}/>
        </motion.span>
        <span className="proof-specks"><i/><i/><i/></span>
        <motion.span
          key={`ripple-${response}`}
          className="dough-ripple"
          initial={reduceMotion || !response ? false : { opacity: 0.52, scale: 0.2 }}
          animate={reduceMotion || !response ? undefined : { opacity: 0, scale: 1.35 }}
          transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      <span className="dough-caption">
        <strong>{lang === "zh" ? "它已经在醒发" : "Already rising"}</strong>
        <small>{lang === "zh" ? "轻轻碰一下" : "A little touch"}</small>
      </span>
    </button>
  );
}
