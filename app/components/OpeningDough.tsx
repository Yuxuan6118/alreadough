"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function OpeningDough() {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const visible = pathname === "/" && !dismissed;

  useEffect(() => {
    if (pathname !== "/") return;
    const timer = window.setTimeout(() => setDismissed(true), reduceMotion ? 800 : 3100);
    return () => window.clearTimeout(timer);
  }, [pathname, reduceMotion]);

  return <AnimatePresence>{visible && <motion.div className="opening-dough" role="status" aria-label="Opening AlreaDough" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
    <button type="button" onClick={() => setDismissed(true)} aria-label="Skip opening animation">Skip</button>
    <div className="opening-dough-stage" aria-hidden="true">
      {!reduceMotion && <motion.div className="dough-stretch" initial={{ scaleX: 0.45, scaleY: 1.1, opacity: 0 }} animate={{ scaleX: [0.45, 3.8, 1.3, 0.7], scaleY: [1.1, 0.16, 0.5, 0.9], opacity: [0, 1, 1, 0] }} transition={{ duration: 2, times: [0, 0.42, 0.74, 1], ease: [0.16, 1, 0.3, 1] }}>
        {Array.from({ length: 7 }, (_, index) => <i key={index}/>) }
      </motion.div>}
      <motion.img src="/brand/already-dough-mark.png" alt="" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.45, y: 10 }} animate={{ opacity: [0, 0, 1], scale: reduceMotion ? 1 : [0.45, 0.45, 1.06, 1], y: [10, 10, -3, 0] }} transition={{ duration: reduceMotion ? 0.3 : 2.55, times: reduceMotion ? undefined : [0, 0.62, 0.86, 1], ease: "easeOut" }}/>
    </div>
    <motion.strong initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 2.05, duration: 0.45 }}>Alrea<span>Dough</span></motion.strong>
  </motion.div>}</AnimatePresence>;
}
