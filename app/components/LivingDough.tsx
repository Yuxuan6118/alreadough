"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
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
  const didDrag = useRef(false);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const stretchX = useTransform(() => 1 + Math.min(Math.abs(dragX.get()), 76) / 150 - Math.min(Math.abs(dragY.get()), 76) / 430);
  const stretchY = useTransform(() => 1 + Math.min(Math.abs(dragY.get()), 76) / 150 - Math.min(Math.abs(dragX.get()), 76) / 430);
  const tilt = useTransform(() => dragX.get() / 22);

  const touch = async () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
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
          className="dough-drag-shell"
          drag={reduceMotion ? false : true}
          dragConstraints={{ left: -76, right: 76, top: -76, bottom: 76 }}
          dragElastic={0.3}
          dragMomentum={false}
          dragSnapToOrigin
          style={reduceMotion ? undefined : { x: dragX, y: dragY, scaleX: stretchX, scaleY: stretchY, rotate: tilt }}
          onPointerDown={() => { didDrag.current = false; }}
          onDrag={() => { didDrag.current = true; }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          <motion.span
            key={response}
            className="dough-character-shell"
            initial={reduceMotion ? false : { scaleX: 1, scaleY: 1 }}
            animate={reduceMotion ? undefined : response ? { scaleX: [1, 1.05, 0.98, 1], scaleY: [1, 0.91, 1.035, 1], y: [0, 5, -2, 0] } : { scaleX: [1, 1.012, 1], scaleY: [1, 1.025, 1], y: [0, -2, 0] }}
            transition={response ? { duration: 0.7, ease: [0.16, 1, 0.3, 1] } : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image className="dough-character" src="/mascot/already-dough-fold-v3.png" alt="" width={1536} height={1024} sizes={compact ? "132px" : "360px"}/>
            {response > 0 && <motion.span key={`expression-${response}`} className="dough-expression" initial={{ opacity: 0, scale: .78 }} animate={{ opacity: [0, 1, 1, 0], scale: [.78, 1.05, 1, .9] }} transition={{ duration: 1.15, times: [0, .18, .66, 1] }}><i/><i/><b/></motion.span>}
          </motion.span>
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
