import { createContext, useContext, useId, type ReactNode } from "react";

// Sidebar / bottom-bar icons in the AlreaDough line-mark style (approved 2026-11-18).
// Drop-in for the Phosphor icons in navItems: same `size` + `weight` props, weight="fill" = selected.
// Strokes are currentColor; the selected fill comes from --nav-icon-fill. Overlaps are cut with masks,
// so the icons need no background colour and work on any surface (light or dark).

type Props = { size?: number; weight?: string };

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const FILL = "var(--nav-icon-fill, #e7c4c8)";

// Every icon is scaled into the same optical size and centred: equal visible area
// (sqrt(w*h) = 16 units), with the longest side capped at 18.5. `box` is the icon's measured
// geometry bounding box [x, y, w, h] in its own 24-unit drawing. Strokes are compensated so every
// icon renders with the same 1.6 line weight after scaling.
const AREA = 16;
const MAX_SIDE = 18.5;
const ScaleContext = createContext(1);
/** Stroke width that renders as `n` units after the icon's fit scaling. */
function useSw() {
  const k = useContext(ScaleContext);
  return (n: number) => n / k;
}

// [x, y, w, h, boost?]: boost enlarges one icon on purpose (founder asked for a bigger Dreamscape).
type Box = [number, number, number, number, number?];
function fitScale([, , w, h, boost = 1]: Box) {
  return Math.min(AREA / Math.sqrt(w * h), MAX_SIDE / Math.max(w, h)) * boost;
}

function Frame({ size = 20, box, children }: { size?: number; box: Box; children: ReactNode }) {
  const [x, y, w, h] = box;
  const k = fitScale(box);
  const tx = 12 - (x + w / 2) * k;
  const ty = 12 - (y + h / 2) * k;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={`translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${k.toFixed(4)})`} strokeWidth={1.6 / k}>
        <ScaleContext.Provider value={k}>{children}</ScaleContext.Provider>
      </g>
    </svg>
  );
}

// The icon name is part of the id, so even if two React roots ever produce the same useId,
// a reference can only land on a mask of the same icon (identical geometry), never another icon's.
function useMaskId(name: string) {
  return `nav-${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** A plain dough (body + two dot eyes) placed with translate/scale, stroke kept at 1.6. */
function Dough({ tx, ty, s, fill, rotate }: { tx: number; ty: number; s: number; fill: string; rotate?: string }) {
  const sw = useSw();
  const r = 1.1 / Math.sqrt(s);
  return (
    <g transform={`${rotate ?? ""} translate(${tx} ${ty}) scale(${s})`} strokeWidth={sw(1.6) / s}>
      <path d={BODY} fill={fill} />
      <circle cx="8.6" cy="11" r={r} fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="11" r={r} fill="currentColor" stroke="none" />
    </g>
  );
}

const HEART_BUBBLE = "M12 19.2L8.9 17.2L5 20.4L6.2 15.5C4.4 13.6 3.5 11.6 3.5 9.2C3.5 6.3 5.6 4.2 8.2 4.2C9.9 4.2 11.2 5.1 12 6.4C12.8 5.1 14.1 4.2 15.8 4.2C18.4 4.2 20.5 6.3 20.5 9.2C20.5 13.2 17.4 16.2 12 19.2Z";

const HISTORY_BOX: Box = [3.5, 4.2, 17, 16.2];
/** Conversation history: a heart-shaped speech bubble with two dot eyes. */
export function HistoryIcon({ size, weight }: Props) {
  const active = weight === "fill";
  return (
    <Frame size={size} box={HISTORY_BOX}>
      <path d={HEART_BUBBLE} fill={active ? FILL : "none"} />
      <circle cx="9.3" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

const COMPANION_BOX: Box = [1.14, 6.59, 20, 14.05];
/** Companion: a big dough with a small one leaning in. */
export function CompanionIcon({ size, weight }: Props) {
  const active = weight === "fill";
  const sw = (n: number) => n / fitScale(COMPANION_BOX);
  const m = useMaskId("companion");
  const small = { tx: 10.8, ty: 9.6, s: 0.5, rotate: "rotate(-10 15.5 20)" };
  return (
    <Frame size={size} box={COMPANION_BOX}>
      <mask id={m} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <g transform={`${small.rotate} translate(${small.tx} ${small.ty}) scale(${small.s})`}>
          <path d={BODY} fill="black" stroke="black" strokeWidth={sw(2.4) / small.s} />
        </g>
      </mask>
      <g mask={`url(#${m})`}><Dough tx={-1.2} ty={4} s={0.74} fill={active ? FILL : "none"} /></g>
      <Dough {...small} fill={active ? FILL : "none"} />
    </Frame>
  );
}

const STORIES_BOX: Box = [3.5, 4.98, 17, 14.32];
/** Stories: an open book with a heart on the right page. */
export function StoriesIcon({ size, weight }: Props) {
  const active = weight === "fill";
  const sw = (n: number) => n / fitScale(STORIES_BOX);
  return (
    <Frame size={size} box={STORIES_BOX}>
      <path d="M12 6.5C10 5 7 4.7 3.5 5.2V18C7 17.5 10 17.8 12 19.3C14 17.8 17 17.5 20.5 18V5.2C17 4.7 14 5 12 6.5Z" fill={active ? FILL : "none"} />
      <path d="M12 6.5V19.3M6 9.3H9.3M6 12.3H9.3" />
      <path d="M16.2 13.4C14.5 12.3 14.2 11.1 15 10.6C15.5 10.3 15.9 10.6 16.2 11C16.5 10.6 16.9 10.3 17.4 10.6C18.2 11.1 17.9 12.3 16.2 13.4Z" strokeWidth={sw(1.3)} />
    </Frame>
  );
}

const REVISE_BOX: Box = [3.18, 2.6, 17.63, 19.3];
/** Revise: two reverse arrows tracing the dough's outline, with its eyes. */
export function ReviseIcon({ size, weight }: Props) {
  const active = weight === "fill";
  return (
    <Frame size={size} box={REVISE_BOX}>
      {active && <path d={BODY} fill={FILL} stroke="none" />}
      <path d="M3.3 14.5C3.1 12.8 3.2 11.4 3.3 10C3.5 5 6 3.5 12 3.5C15.2 3.5 17.4 3.9 18.7 5M18.7 5L18.3 2.6M18.7 5L16.3 5" />
      <path d="M20.7 10C20.9 11.7 20.8 13.1 20.7 14.5C20.5 19.5 18 21 12 21C8.8 21 6.6 20.6 5.3 19.5M5.3 19.5L5.7 21.9M5.3 19.5L7.7 19.5" />
      <circle cx="8.6" cy="12.3" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="12.3" r="1.15" fill="currentColor" stroke="none" />
    </Frame>
  );
}

const VISION_BOX: Box = [3.5, 5, 17, 14];
/** Vision board: a soft frame with a hill and a heart for the sun. */
export function VisionIcon({ size, weight }: Props) {
  const active = weight === "fill";
  const sw = (n: number) => n / fitScale(VISION_BOX);
  return (
    <Frame size={size} box={VISION_BOX}>
      <path d="M7 5H17C19.2 5 20.5 6.3 20.5 8.5V15.5C20.5 17.7 19.2 19 17 19H7C4.8 19 3.5 17.7 3.5 15.5V8.5C3.5 6.3 4.8 5 7 5Z" fill={active ? FILL : "none"} />
      <path d="M3.8 16.3L8.8 11.8L12.6 15L15.2 12.8L20.2 16.8" />
      <path d="M15.6 10.6C14.1 9.7 13.8 8.6 14.5 8.1C15 7.8 15.4 8.1 15.6 8.5C15.9 8.1 16.3 7.8 16.8 8.1C17.5 8.6 17.2 9.7 15.6 10.6Z" strokeWidth={sw(1.3)} />
    </Frame>
  );
}

const DREAMSCAPE_BOX: Box = [1.3, 1.3, 21.5, 19.2, 1.18];
/** Dreamscape: a sleeping dough wearing headphones, a big z with a small z above-right. */
export function DreamscapeIcon({ size, weight }: Props) {
  const active = weight === "fill";
  const sw = (n: number) => n / fitScale(DREAMSCAPE_BOX);
  const m = useMaskId("dreamscape");
  const cups = <><rect x="1.3" y="12.4" width="3" height="5.6" rx="1.4" /><rect x="16.7" y="12.4" width="3" height="5.6" rx="1.4" /></>;
  return (
    <Frame size={size} box={DREAMSCAPE_BOX}>
      <mask id={m} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <g fill="black" stroke="black" strokeWidth={sw(2.4)}>{cups}</g>
      </mask>
      <g mask={`url(#${m})`}>
        <path d="M10.5 8C15.3 8 17 9.2 17.2 13.2C17.4 16 17.3 17.6 16.8 18.6C16.2 20 14.3 20.5 10.5 20.5C6.7 20.5 4.8 20 4.2 18.6C3.7 17.6 3.6 16 3.8 13.2C4 9.2 5.7 8 10.5 8Z" fill={active ? FILL : "none"} />
        <path d="M6.8 14.2Q7.8 15.3 8.8 14.2M12.2 14.2Q13.2 15.3 14.2 14.2" />
        <path d="M2.7 14.6C2.7 9 6.1 5.4 10.5 5.4C14.9 5.4 18.3 9 18.3 14.6" />
      </g>
      <g fill={active ? FILL : "none"}>{cups}</g>
      <path d="M17.9 5H20.9L17.9 8.2H20.9" strokeWidth={sw(1.4)} />
      <path d="M21 1.3H22.8L21 3.3H22.8" strokeWidth={sw(1.1)} />
    </Frame>
  );
}

const PERSONA_BOX: Box = [3.2, 3.2, 17.6, 17.8];
const HEART_DOUGH = "M13.4 4.5C14.2 3.7 15.3 3.2 16.5 3.2C18.7 3.2 20.1 4.9 20.1 7.3C20.1 10.7 16.9 13.7 12 16.7C7.1 13.7 3.9 10.7 3.9 7.3C3.9 4.9 5.3 3.2 7.5 3.2C8.7 3.2 9.8 3.7 10.6 4.5C11.2 5.1 11.6 5.4 12 5.4C12.4 5.4 12.8 5.1 13.4 4.5Z";
const INFINITY = "M16.7 18.3C16.7 18.3 16.2 19.2 15.7 19.4C15.3 19.6 14.6 19.6 14.2 19.5C13.7 19.4 13.3 19.2 12.9 19.0C12.6 18.8 12.3 18.5 12.0 18.3C11.6 18.0 11.4 17.8 11.0 17.6C10.6 17.4 10.2 17.1 9.7 17.0C9.3 17.0 8.6 16.9 8.2 17.1C7.8 17.3 7.3 17.9 7.3 18.3C7.3 18.6 7.8 19.2 8.2 19.4C8.6 19.6 9.3 19.6 9.7 19.5C10.2 19.4 10.6 19.2 11.0 19.0C11.4 18.8 11.6 18.5 12.0 18.3C12.3 18.0 12.6 17.8 12.9 17.6C13.3 17.4 13.7 17.1 14.2 17.0C14.6 17.0 15.3 16.9 15.7 17.1C16.2 17.3 16.7 17.9 16.7 18.3Z";
/** TA: a love letter — a heart-shaped dough peeks out of the envelope, sealed with a long, flat infinity. */
export function PersonaIcon({ size, weight }: Props) {
  const active = weight === "fill";
  const sw = (n: number) => n / fitScale(PERSONA_BOX);
  const m = useMaskId("persona");
  return (
    <Frame size={size} box={PERSONA_BOX}>
      <mask id={m} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <rect x="2" y="11.4" width="20" height="12" fill="black" stroke="none" />
      </mask>
      <g mask={`url(#${m})`}>
        <path d={HEART_DOUGH} fill={active ? FILL : "none"} />
        <circle cx="9.3" cy="8.9" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="14.7" cy="8.9" r="1.05" fill="currentColor" stroke="none" />
      </g>
      <rect x="3.2" y="11.4" width="17.6" height="9.6" rx="2" />
      <path d="M3.6 12.2L12 15.6L20.4 12.2" />
      <path d={INFINITY} strokeWidth={sw(1.1)} />
    </Frame>
  );
}
