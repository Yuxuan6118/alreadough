"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const REBOUND_MS = 1020;
const SETTLE_MS = 740;

function DoughMark({ reduced }: { reduced: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = stage.current;
    const source = mark.current;
    const surface = canvas.current;
    if (reduced || !container || !source || !surface) return;
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let cancelled = false;
    const paint = (start: number) => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(width * density);
      surface.height = Math.round(height * density);
      const size = 128 * density;
      const maxStretch = Math.min(2.65, (width - 8) / 128);
      const columns = 72;
      const tick = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= REBOUND_MS + SETTLE_MS) {
          delete container.dataset.deforming;
          return;
        }
        const pull = Math.min(1, elapsed / REBOUND_MS);
        const tension = pull * pull * (3 - 2 * pull);
        const release = Math.max(0, elapsed - REBOUND_MS) / 1000;
        const stretch = elapsed < REBOUND_MS
          ? 0.96 + (maxStretch - 0.96) * tension
          : 1 + (maxStretch - 1) * Math.exp(-7.8 * release)
            * (Math.cos(19 * release) + (7.8 / 19) * Math.sin(19 * release));
        ctx.clearRect(0, 0, surface.width, surface.height);
        const center = surface.width / 2;
        const left = center - size * stretch / 2;
        for (let column = 0; column < columns; column++) {
          const u = (column + 0.5) / columns;
          const middle = 4 * u * (1 - u);
          const strain = stretch - 1;
          // The middle thins and sags under tension while the ends retain their mass.
          const thickness = size / Math.sqrt(stretch) * (1 - 0.19 * middle * Math.max(0, strain));
          const sag = size * strain * (0.13 * middle + 0.035 * (u - 0.5));
          const x = Math.round(left + column * size * stretch / columns);
          const nextX = Math.round(left + (column + 1) * size * stretch / columns);
          ctx.drawImage(source, column * source.naturalWidth / columns, 0,
            source.naturalWidth / columns, source.naturalHeight,
            x, surface.height / 2 - thickness / 2 + sag, nextX - x, thickness);
        }
        container.dataset.deforming = "true";
        frame = requestAnimationFrame(tick);
      };
      tick(start);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void source.decode().then(() => {
      if (!cancelled) frame = requestAnimationFrame(paint);
    }).catch(() => { /* The static mark remains visible. */ });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      delete container.dataset.deforming;
    };
  }, [reduced]);

  return <div ref={stage} className="opening-dough-stage" aria-hidden="true">
    <img ref={mark} src="/brand/already-dough-mark.png" alt="" />
    {!reduced && <canvas ref={canvas} />}
  </div>;
}

export default function OpeningDough() {
  const reduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDismissed(true), reduceMotion ? 700 : 2330);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return <AnimatePresence>{!dismissed && <motion.div className="opening-dough" role="status" aria-label="Opening AlreaDough" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
    <button type="button" onClick={() => setDismissed(true)} aria-label="Skip opening animation">Skip</button>
    <DoughMark reduced={!!reduceMotion} />
    <motion.strong initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 1.43, duration: reduceMotion ? 0 : 0.28 }}>Alrea<span>Dough</span></motion.strong>
  </motion.div>}</AnimatePresence>;
}
