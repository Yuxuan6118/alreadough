"use client";

import { useEffect } from "react";

// Site-wide button feel, mounted once in the root layout. Pure decoration: nothing here changes what a click does.
//   press & spring back  every button shrinks to 0.94 while held and springs back with a little overshoot
//   touch ripple         a ring spreads from the press point to 2.4x the button width, starting at 0.28 opacity
//   like burst           [data-burst] buttons pop their icon to 1.3 and scatter 8 dots when switched on
//   magnetic             [data-magnetic] buttons lean toward a mouse pointer within 120px, then spring home
// The CSS `scale` / `translate` properties are animated (not `transform`), so existing transforms are left alone.

const PRESSABLE = "button, a.primary, a.secondary, a[role='button'], .login-gate-google, .pet-download";
const SKIP = ".living-dough, [data-no-press], [draggable='true'], input, select, textarea";
const SPRING_BACK: Keyframe[] = [{ scale: 0.94 }, { scale: 1.03, offset: 0.45 }, { scale: 0.995, offset: 0.75 }, { scale: 1 }];

function pressTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const element = node.closest<HTMLElement>(PRESSABLE);
  if (!element || element.matches(SKIP) || element.closest(".living-dough")) return null;
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return null;
  const box = element.getBoundingClientRect();
  if (box.width > 520 || box.height > 140) return null;   // big card-like buttons would look like they jump
  return element;
}

function ripple(element: HTMLElement, event: PointerEvent) {
  const style = getComputedStyle(element);
  if (style.display === "contents") return;
  if (style.position === "static") element.style.position = "relative";
  const box = element.getBoundingClientRect();
  const clip = document.createElement("span");
  clip.className = "fx-ripple";
  clip.setAttribute("aria-hidden", "true");
  const ring = document.createElement("i");
  const size = box.width * 2.4;
  ring.style.width = ring.style.height = `${size}px`;
  ring.style.left = `${event.clientX - box.left - size / 2}px`;
  ring.style.top = `${event.clientY - box.top - size / 2}px`;
  clip.appendChild(ring);
  element.appendChild(clip);
  const run = ring.animate([{ opacity: 0.28, scale: 0 }, { opacity: 0, scale: 1 }], { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" });
  run.onfinish = () => clip.remove();
}

function burst(element: HTMLElement) {
  const icon = element.querySelector("svg");
  icon?.animate([{ scale: 1 }, { scale: 1.3, offset: 0.35 }, { scale: 0.92, offset: 0.65 }, { scale: 1 }], { duration: 520, easing: "ease-out" });
  const box = element.getBoundingClientRect();
  const origin = icon?.getBoundingClientRect() ?? box;
  const layer = document.createElement("span");
  layer.className = "fx-burst";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${origin.left + origin.width / 2}px`;
  layer.style.top = `${origin.top + origin.height / 2}px`;
  document.body.appendChild(layer);
  for (let index = 0; index < 8; index += 1) {
    const dot = document.createElement("i");
    layer.appendChild(dot);
    const angle = (index / 8) * Math.PI * 2;
    dot.animate([
      { translate: "0 0", opacity: 1, scale: 1 },
      { translate: `${Math.cos(angle) * 22}px ${Math.sin(angle) * 22}px`, opacity: 0, scale: 0.4 },
    ], { duration: 560, easing: "cubic-bezier(.16,1,.3,1)" });
  }
  window.setTimeout(() => layer.remove(), 620);
}

export default function ButtonFx() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pressed: HTMLElement | null = null;
    let hold: Animation | null = null;

    const down = (event: PointerEvent) => {
      if (reduce.matches || event.button !== 0) return;
      const element = pressTarget(event.target);
      if (!element) return;
      pressed = element;
      hold?.cancel();
      hold = element.animate([{ scale: 1 }, { scale: 0.94 }], { duration: 90, easing: "ease-out", fill: "forwards" });
      ripple(element, event);
    };
    const up = () => {
      if (!pressed) return;
      const element = pressed;
      pressed = null;
      hold?.cancel();
      hold = null;
      element.animate(SPRING_BACK, { duration: 460, easing: "linear" });
    };
    const click = (event: MouseEvent) => {
      if (reduce.matches || !(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>("[data-burst]");
      // burst only when the button is being switched on (it is not selected yet)
      if (element && element.getAttribute("aria-pressed") !== "true" && !element.classList.contains("selected")) burst(element);
    };

    // magnetic buttons: only with a real mouse
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const magnets = new Map<HTMLElement, { x: number; y: number }>();
    const move = (event: PointerEvent) => {
      if (reduce.matches || !fine.matches || event.pointerType !== "mouse") return;
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((element) => {
        const box = element.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const gapX = Math.max(0, Math.abs(dx) - box.width / 2);
        const gapY = Math.max(0, Math.abs(dy) - box.height / 2);
        const inside = Math.hypot(gapX, gapY) < 120;
        const target = inside ? { x: dx * 0.35, y: dy * 0.35 } : { x: 0, y: 0 };
        const last = magnets.get(element) ?? { x: 0, y: 0 };
        if (Math.abs(target.x - last.x) < 0.5 && Math.abs(target.y - last.y) < 0.5) return;
        magnets.set(element, target);
        // leaving: a soft spring home (stiffness 150, damping 15 is a slow, slightly bouncy settle)
        element.animate([{ translate: `${last.x}px ${last.y}px` }, { translate: `${target.x}px ${target.y}px` }], inside
          ? { duration: 160, easing: "ease-out", fill: "forwards" }
          : { duration: 620, easing: "cubic-bezier(.34,1.45,.5,1)", fill: "forwards" });
      });
    };

    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointercancel", up, { passive: true });
    window.addEventListener("blur", up);
    document.addEventListener("click", click, true);
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
      document.removeEventListener("click", click, true);
      document.removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}
