import { useId, type ReactNode } from "react";

// 帮助与条款 page icons, drawn as the dough mascot (picked by the founder 2026-11-20:
// report C with a bigger flag, safety C as the shield itself, privacy A, terms D, copyright C,
// pricing = cushion-cut ring P3 with a bigger stone).
// Same language as SpaceIcons: plump dough outline, dot eyes, no mouth, round caps, currentColor strokes.

type Props = { size?: number };

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const SW = 1.6;

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function useMaskId(name: string) {
  return `help-${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
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

/** 举报内容或反馈问题: a flag planted on top of the dough. */
export function ReportIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <Dough tx={1.6} ty={6} s={0.74} />
      <path d="M10.5 8.6V1.6" />
      <path d="M10.5 1.8L18.6 4.7L10.5 7.6" />
    </Svg>
  );
}

/** AI 与安全说明: the shield itself is the dough — a shield with dot eyes. */
export function SafetyIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M12 2.2L20.2 5V11.2C20.2 16 16.8 19.8 12 21.8C7.2 19.8 3.8 16 3.8 11.2V5Z" />
      <Eyes a={8.4} b={15.6} y={11} r={1.2} />
    </Svg>
  );
}

/** 隐私说明: a padlock whose body is the dough. */
export function PrivacyIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M7.8 9.6V7.8C7.8 5.3 9.7 3.2 12 3.2C14.3 3.2 16.2 5.3 16.2 7.8V9.6" />
      <Dough tx={3.6} ty={6.6} s={0.7} />
    </Svg>
  );
}

/** 测试版条款: a test flask with the dough's eyes in the liquid. */
export function TermsIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M9.4 2.8H14.6" />
      <path d="M10.4 2.8V8.6L4.8 18.2C4 19.7 5 21.2 6.6 21.2H17.4C19 21.2 20 19.7 19.2 18.2L13.6 8.6V2.8" />
      <path d="M7.2 14.2C9 13.4 10.6 13.4 12 14.2C13.4 15 15 15 16.8 14.2" />
      <Eyes a={10.2} b={13.8} y={17.4} r={1} />
    </Svg>
  );
}

const TAG = "M17.6 11.2A5 5 0 1 0 17.6 21.2A5 5 0 1 0 17.6 11.2Z";
/** 素材与版权: a dough with a small © tag hanging beside it. */
export function CopyrightIcon({ size }: Props) {
  const m = useMaskId("copyright");
  return (
    <Svg size={size}>
      <defs>
        <mask id={m} maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
          <rect x="-4" y="-4" width="32" height="32" fill="white" stroke="none" />
          <path d={TAG} fill="black" stroke="black" strokeWidth="3.2" />
        </mask>
      </defs>
      <g mask={`url(#${m})`}><Dough tx={-1.4} ty={-0.8} s={0.88} /></g>
      <path d={TAG} />
      <path d="M19 14.8C18.6 14.4 18.1 14.2 17.5 14.2C16.4 14.2 15.6 15.1 15.6 16.2C15.6 17.3 16.4 18.2 17.5 18.2C18.1 18.2 18.6 18 19 17.6" />
    </Svg>
  );
}

/** 会员与价格: a cushion-cut solitaire ring — the big stone is the dough, on a thin band, with a small sparkle. */
export function PricingIcon({ size }: Props) {
  const m = useMaskId("pricing");
  const stone = { tx: 4.08, ty: 0, s: 0.66 };
  return (
    <Svg size={size}>
      <defs>
        <mask id={m} maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
          <rect x="-4" y="-4" width="32" height="32" fill="white" stroke="none" />
          <path d={BODY} transform={`translate(${stone.tx} ${stone.ty}) scale(${stone.s})`} fill="black" stroke="black" strokeWidth={3 / stone.s} />
        </mask>
      </defs>
      <ellipse cx="12" cy="17" rx="6.4" ry="3.4" strokeWidth="1.4" mask={`url(#${m})`} />
      <Dough {...stone} />
      <path d="M20.2 1.4V4.6M18.6 3H21.8" strokeWidth="1.3" />
    </Svg>
  );
}
