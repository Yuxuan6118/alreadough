import { useId, type ReactNode } from "react";

// My space index icons, drawn as the dough mascot (picked by the founder 2026-11-18:
// 1D 2C 3B 4D 5B 6A-as-a-computer 7A 8A-with-a-bigger-dough 9A).
// Same language as NavIcons: plump dough outline, dot eyes, no mouth, round caps, currentColor strokes.

type Props = { size?: number };

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const CLOUD = "M7 18.5C4.2 18.5 2.8 16.6 2.8 14.6C2.8 12.6 4.3 11.1 6.2 11C6.5 7.9 8.9 5.8 11.8 5.8C14.4 5.8 16.5 7.4 17.2 9.8C19.6 10 21.2 11.9 21.2 14.2C21.2 16.6 19.4 18.5 16.8 18.5Z";
const SW = 1.6;

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function useMaskId(name: string) {
  return `space-${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function Eyes({ a, b, y, r = 1.1 }: { a: number; b: number; y: number; r?: number }) {
  return <><circle cx={a} cy={y} r={r} fill="currentColor" stroke="none" /><circle cx={b} cy={y} r={r} fill="currentColor" stroke="none" /></>;
}

/** A dough placed with translate/scale; line weight stays 1.6, eyes shrink gently with it. */
function Dough({ tx, ty, s }: { tx: number; ty: number; s: number }) {
  const r = (1.15 * Math.pow(s, 0.3)) / s;
  return (
    <g transform={`translate(${tx} ${ty}) scale(${s})`} strokeWidth={SW / s}>
      <path d={BODY} />
      <circle cx="8.6" cy="11" r={r} fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="11" r={r} fill="currentColor" stroke="none" />
    </g>
  );
}

function Mask({ id, children }: { id: string; children: ReactNode }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
      <rect x="-4" y="-4" width="32" height="32" fill="white" stroke="none" />
      {children}
    </mask>
  );
}

/** Five-point star with rounded corners. */
function roundStar(cx: number, cy: number, R: number, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    pts.push([cx + d * Math.cos(a), cy + d * Math.sin(a)]);
  }
  let d = "";
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const k = i % 2 ? 1 : 2;
    const toward = (q: [number, number]) => {
      const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      return `${(p[0] + (dx / len) * k).toFixed(2)} ${(p[1] + (dy / len) * k).toFixed(2)}`;
    };
    d += `${i ? "L" : "M"}${toward(pts[(i + 9) % 10])}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${toward(pts[(i + 1) % 10])}`;
  }
  return `${d}Z`;
}
const STAR = roundStar(12, 13, 9.8, 4.9);

/** 我的愿望: a star-shaped dough. */
export function WishesIcon({ size }: Props) {
  return <Svg size={size}><path d={STAR} /><Eyes a={10} b={14.2} y={13.4} r={1.05} /></Svg>;
}

/** 关于我: a name card printed with a dough. */
export function AboutIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.6" />
      <Dough tx={3.5} ty={7.1} s={0.37} />
      <path d="M13.4 10.4H18.4M13.4 13.8H16.6" />
    </Svg>
  );
}

/** 记忆库: a stack of photos, the top one a dough. */
export function LibraryIcon({ size }: Props) {
  const m = useMaskId("library");
  return (
    <Svg size={size}>
      <defs><Mask id={m}><rect x="6.6" y="7" width="13.6" height="13.6" rx="2.2" fill="black" stroke="black" strokeWidth="3" /></Mask></defs>
      <rect x="3.6" y="3.4" width="13.6" height="13.6" rx="2.2" transform="rotate(-8 10.4 10.2)" mask={`url(#${m})`} />
      <rect x="6.6" y="7" width="13.6" height="13.6" rx="2.2" />
      <Dough tx={7.4} ty={7.6} s={0.5} />
    </Svg>
  );
}

/** 背景与念头: a thinking cloud with dough eyes. */
export function ThoughtsIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <g transform="translate(0 -1.2)"><path d={CLOUD} /><Eyes a={9.6} b={14.4} y={13.4} /></g>
      <circle cx="6.2" cy="20.2" r="1" />
    </Svg>
  );
}

/** 会员与用量: a crown with dough eyes. */
export function MembershipIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M4.3 17.4L3.2 7.6L8.2 11L12 4.4L15.8 11L20.8 7.6L19.7 17.4Z" />
      <path d="M4.6 20.6H19.4" />
      <Eyes a={9.3} b={14.7} y={14} />
    </Svg>
  );
}

/** 下载桌宠: the dough itself is a computer — a wide dough-shaped screen on a stand. */
export function PetIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M12 3C18.6 3 20.8 4.1 21 7.8C21.2 10 21.2 11.6 20.9 13.2C20.4 15.4 18 16 12 16C6 16 3.6 15.4 3.1 13.2C2.8 11.6 2.8 10 3 7.8C3.2 4.1 5.4 3 12 3Z" />
      <Eyes a={8.8} b={15.2} y={9.4} />
      <path d="M12 16V19.6M8.4 20.6H15.6" />
    </Svg>
  );
}

/** 外观与语言: a dough with its right half tinted (light / dark). */
export function LookIcon({ size }: Props) {
  const c = useMaskId("look");
  return (
    <Svg size={size}>
      <defs><clipPath id={c}><rect x="12" y="0" width="12" height="24" /></clipPath></defs>
      <path d={BODY} fill="currentColor" fillOpacity={0.3} stroke="none" clipPath={`url(#${c})`} />
      <path d={BODY} />
      <Eyes a={8.6} b={15.4} y={11} />
    </Svg>
  );
}

/** 同步与数据: a big dough in front of a small cloud. */
export function SyncIcon({ size }: Props) {
  const m = useMaskId("sync");
  const dough = { tx: -1, ty: 6.2, s: 0.74 };
  return (
    <Svg size={size}>
      <defs>
        <Mask id={m}>
          <g transform={`translate(${dough.tx} ${dough.ty}) scale(${dough.s})`}><path d={BODY} fill="black" stroke="black" strokeWidth={3.2 / dough.s} /></g>
        </Mask>
      </defs>
      <g mask={`url(#${m})`}><path d={CLOUD} transform="translate(10.6 -0.4) scale(0.56)" strokeWidth={SW / 0.56} /></g>
      <Dough {...dough} />
    </Svg>
  );
}

/** 帮助与条款: a question mark whose dot is the dough. */
export function HelpIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <Dough tx={4.8} ty={8.6} s={0.6} />
      <path d="M8.6 5.4C8.6 3.3 10.1 1.9 12.1 1.9C14.1 1.9 15.5 3.2 15.5 4.9C15.5 6.8 12.8 7.1 12.4 8.4" />
    </Svg>
  );
}
