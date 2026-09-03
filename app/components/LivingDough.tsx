"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Capacitor } from "@capacitor/core";

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
      <span className="dough-jar" aria-hidden="true">
        <span className="jar-rim" />
        <motion.span
          key={response}
          className="dough-body"
          initial={reduceMotion ? false : { scaleX: 1, scaleY: 1 }}
          animate={reduceMotion ? undefined : response ? { scaleX: [1, 1.05, 0.98, 1], scaleY: [1, 0.91, 1.04, 1] } : { scaleY: [1, 1.018, 1] }}
          transition={response ? { duration: 0.72, ease: [0.16, 1, 0.3, 1] } : { duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <i className="dough-eye left" />
          <i className="dough-eye right" />
          <i className="dough-mouth" />
          <i className="dough-bubble bubble-a" />
          <i className="dough-bubble bubble-b" />
          <i className="dough-bubble bubble-c" />
          <i className="dough-fold" />
        </motion.span>
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
