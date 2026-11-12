"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Capacitor } from "@capacitor/core";
import Image from "next/image";

// Two-finger pinch stretches or squeezes the dough while the fingers are down, and when they lift it springs back
// to its normal size with a little wobble, like real dough. Nothing is remembered.
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.55;
// past the limits it only gives a quarter of the way, like dough that will not stretch any further
const rubber = (value: number) => (value > MAX_SCALE ? MAX_SCALE + (value - MAX_SCALE) * 0.25 : value < MIN_SCALE ? MIN_SCALE - (MIN_SCALE - value) * 0.25 : value);

type Props = {
  lang: "zh" | "en";
  compact?: boolean;
  onTouch?: () => void;
};

export default function LivingDough({ lang, compact = false, onTouch }: Props) {
  const reduceMotion = useReducedMotion();
  const [response, setResponse] = useState(0);
  const didDrag = useRef(false);
  // The breathing loop and the tap squish both run on the same element. They used to be swapped by changing the
  // element's key, which destroyed and rebuilt the dough (and its picture) on every tap: on a phone that showed as the
  // dough blinking out and back in, and the breathing never came back afterwards.
  const [shellRef, animateShell] = useAnimate<HTMLSpanElement>();
  const idleLoop = useRef<{ stop: () => void } | null>(null);
  const startIdle = () => {
    if (reduceMotion || !shellRef.current) return;
    idleLoop.current = animateShell(shellRef.current, { scaleX: [1, 1.035, 1], scaleY: [1, 1.055, 1], y: [0, -4, 0] }, { duration: 5.4, times: [0, 0.42, 1], ease: ["easeOut", "easeInOut"], repeat: Infinity });
  };
  const playResponse = async () => {
    if (reduceMotion || !shellRef.current) return;
    idleLoop.current?.stop();
    await animateShell(shellRef.current, { scaleX: [1, 1.05, 0.98, 1], scaleY: [1, 0.91, 1.035, 1], y: [0, 5, -2, 0] }, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    startIdle();
  };
  useEffect(() => {
    startIdle();
    return () => idleLoop.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start the loop once, when the dough appears
  }, []);
  const pinch = useMotionValue(1);
  const pinchSpring = useSpring(pinch, { stiffness: 230, damping: 11, mass: 0.9 });
  const [pinching, setPinching] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({ distance: 1, scale: 1 });
  const pinchingRef = useRef(false);
  const didPinch = useRef(false);
  const stageRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer = 0, base = 1, active = false;
    const follow = (next: number) => pinch.set(rubber(next));
    const release = () => { active = false; pinch.set(1); };   // the spring does the bounce back
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;   // a trackpad pinch arrives as ctrl + wheel
      event.preventDefault();
      if (!active) { active = true; pinch.jump?.(1); }
      follow(pinch.get() * Math.exp(-event.deltaY * 0.012));
      window.clearTimeout(timer);
      timer = window.setTimeout(release, 140);
    };
    const onGestureStart = (event: Event) => { event.preventDefault(); base = pinch.get(); };
    const onGestureChange = (event: Event) => { event.preventDefault(); follow(base * ((event as Event & { scale: number }).scale || 1)); };
    const onGestureEnd = (event: Event) => { event.preventDefault(); release(); };
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("gesturestart", onGestureStart);
    stage.addEventListener("gesturechange", onGestureChange);
    stage.addEventListener("gestureend", onGestureEnd);
    return () => {
      window.clearTimeout(timer);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("gesturestart", onGestureStart);
      stage.removeEventListener("gesturechange", onGestureChange);
      stage.removeEventListener("gestureend", onGestureEnd);
    };
  }, [pinch]);
  const twoFingers = () => { const [a, b] = [...pointers.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) || 1 : 0; };
  const onPinchDown = (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch") return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      pinchStart.current = { distance: twoFingers(), scale: pinch.get() };
      pinchingRef.current = true; didPinch.current = true; didDrag.current = false;
      setPinching(true);
    }
  };
  const onPinchMove = (event: ReactPointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchingRef.current && pointers.current.size === 2) pinch.set(rubber(pinchStart.current.scale * (twoFingers() / pinchStart.current.distance)));
  };
  const onPinchUp = (event: ReactPointerEvent) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pinchingRef.current && pointers.current.size < 2) {
      pinchingRef.current = false;
      setPinching(false);
      pinch.set(1);   // let go: the spring carries it back to its own size, overshooting a little on the way
    }
  };
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const stretchX = useTransform(() => 1 + Math.min(Math.abs(dragX.get()), 76) / 150 - Math.min(Math.abs(dragY.get()), 76) / 430);
  const stretchY = useTransform(() => 1 + Math.min(Math.abs(dragY.get()), 76) / 150 - Math.min(Math.abs(dragX.get()), 76) / 430);
  const tilt = useTransform(() => dragX.get() / 22);

  // The corner pet sits close to the viewport edge, so cap how far it can be
  // pulled toward it — otherwise a rightward drag slides the dough off-screen.
  const dragConstraints = compact
    ? { left: -64, right: 30, top: -70, bottom: 40 }
    : { left: -76, right: 76, top: -76, bottom: 76 };

  const touch = async () => {
    if (didPinch.current) {   // lifting the fingers after a pinch is not a tap
      didPinch.current = false;
      return;
    }
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setResponse((value) => value + 1);
    void playResponse();
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
      <motion.span ref={stageRef} className="dough-stage" aria-hidden="true" style={{ scale: reduceMotion ? pinch : pinchSpring, transformOrigin: "50% 100%" }} onPointerDown={onPinchDown} onPointerMove={onPinchMove} onPointerUp={onPinchUp} onPointerCancel={onPinchUp}>
        <motion.span
          className="dough-drag-shell"
          tabIndex={-1}
          drag={reduceMotion || pinching ? false : true}
          dragConstraints={dragConstraints}
          dragElastic={0.22}
          dragMomentum={false}
          dragSnapToOrigin
          style={reduceMotion ? undefined : { x: dragX, y: dragY, scaleX: stretchX, scaleY: stretchY, rotate: tilt }}
          onPointerDown={() => { didDrag.current = false; }}
          onDrag={() => { didDrag.current = true; }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          <span ref={shellRef} className="dough-character-shell">
            <Image className="dough-character" src="/mascot/already-dough-fold-v3.png" alt="" width={1536} height={1024} loading="eager" sizes={compact ? "140px" : "360px"}/>
          </span>
        </motion.span>
        <span className="proof-specks"><i/><i/><i/></span>
        <motion.span
          key={`ripple-${response}`}
          className="dough-ripple"
          initial={reduceMotion || !response ? false : { opacity: 0.52, scale: 0.2 }}
          animate={reduceMotion || !response ? undefined : { opacity: 0, scale: 1.35 }}
          transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
        />
      </motion.span>
      <span className="dough-caption">
        <strong>{lang === "zh" ? "它已经在醒发" : "Already rising"}</strong>
        <small>{lang === "zh" ? "轻轻碰一下" : "A little touch"}</small>
      </span>
    </button>
  );
}
