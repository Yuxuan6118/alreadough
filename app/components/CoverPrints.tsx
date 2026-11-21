import { useId, type CSSProperties, type ReactNode } from "react";

// Built-in story covers ("面团封面"): white line prints on a soft colour, like a phone's own wallpapers.
// A story keeps one as `print:<id>` in cover.image; no cover at all shows the first one (dough on rose).
// Drawing language follows SpaceIcons: plump outline, dot eyes, nose dash, no mouth, round caps.
// Colours come from CSS (.cover-print), so dark mode follows on its own.

export const PRINT_COVER_PREFIX = "print:";
export const isPrintCover = (image?: string) => Boolean(image?.startsWith(PRINT_COVER_PREFIX));

const TONES = {
  rose: "#dfc3c5", apricot: "#e9c8b4", cream: "#e3cf9f", matcha: "#c2cba6", sage: "#bfcdb8",
  lake: "#b5cbd1", mist: "#c0c8db", lavender: "#ccc0d9", cocoa: "#c6ab9b", night: "#474c64",
} as const;
type Tone = keyof typeof TONES;
const TONE_NAMES: Record<Tone, [string, string]> = {
  rose: ["玫瑰", "Rose"], apricot: ["杏桃", "Apricot"], cream: ["奶油", "Cream"], matcha: ["抹茶", "Matcha"], sage: ["鼠尾草", "Sage"],
  lake: ["湖蓝", "Lake"], mist: ["雾蓝", "Mist"], lavender: ["薰衣草", "Lavender"], cocoa: ["可可", "Cocoa"], night: ["夜色", "Night"],
};

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const HEART = "M0 2.6C-3.1 .8-3.6-1.1-2.5-1.9C-1.6-2.5-.6-2 0-1.2C.6-2 1.6-2.5 2.5-1.9C3.6-1.1 3.1 .8 0 2.6Z";
const CLOUD = "M7 18.5C4.2 18.5 2.8 16.6 2.8 14.6C2.8 12.6 4.3 11.1 6.2 11C6.5 7.9 8.9 5.8 11.8 5.8C14.4 5.8 16.5 7.4 17.2 9.8C19.6 10 21.2 11.9 21.2 14.2C21.2 16.6 19.4 18.5 16.8 18.5Z";
const MOON = "M1.5 -6.84A7 7 0 1 0 1.5 6.84A8 8 0 0 1 1.5 -6.84Z";
const DOME = "M5.2 18.8C3.9 18.8 3.3 17.9 3.5 16.7C4.2 11.2 7.6 6.6 12 6.6C16.4 6.6 19.8 11.2 20.5 16.7C20.7 17.9 20.1 18.8 18.8 18.8Z";
const LINE = 1.6;

const BAGEL_SEEDS = [-70, -20, 30, 85, 140, 200, 250].map((deg) => {
  const a = (deg * Math.PI) / 180, x = 12 + 5.6 * Math.cos(a), y = 12.25 + 5.6 * Math.sin(a), tx = -Math.sin(a) * 0.6, ty = Math.cos(a) * 0.6;
  return `M${(x - tx).toFixed(2)} ${(y - ty).toFixed(2)}L${(x + tx).toFixed(2)} ${(y + ty).toFixed(2)}`;
}).join("");

function Eyes({ a, b, y, r = 1.15 }: { a: number; b: number; y: number; r?: number }) {
  return <><circle cx={a} cy={y} r={r} className="k" /><circle cx={b} cy={y} r={r} className="k" /></>;
}
const face = <><Eyes a={8.6} b={15.4} y={11.4} r={1.25} /><path d="M11.1 13.9H12.9" /></>;

// Each shape sits in a 24 box around (12, 12). `sw` is the line width in that box, for parts drawn at another scale.
const SHAPES = {
  dough: () => <><path d={BODY} />{face}</>,
  /** filled with the ground colour, so lines under it (gingham) stop at its edge */
  doughCut: () => <><path d={BODY} className="o" />{face}</>,
  doughSolid: () => <><path d={BODY} className="k" /><circle cx={8.6} cy={11.4} r={1.4} className="ok" /><circle cx={15.4} cy={11.4} r={1.4} className="ok" /><path d="M11.1 14.1H12.9" className="on" strokeWidth={1.5} /></>,
  doughCard: () => <><path d={BODY} />{face}<g transform="translate(15.6 19.2) rotate(-8)"><rect x={-4.3} y={-3.7} width={8.6} height={7.6} rx={1.3} className="o" /><path d={HEART} transform="scale(.78)" className="k" /></g></>,
  heart: (sw: number) => <path d={HEART} transform="translate(12 12.3) scale(2.6)" strokeWidth={sw / 2.6} />,
  card: (sw: number) => <><rect x={4} y={5} width={16} height={14.5} rx={2.2} /><path d={HEART} transform="translate(12 12.3) scale(1.2)" strokeWidth={sw / 1.2} /></>,
  butter: () => <><path d="M2.6 12.4L7 9H21.4L17 12.4Z" /><path d="M2.6 12.4H17V17.6H2.6Z" /><path d="M17 12.4L21.4 9V14.2L17 17.6" /><path d="M6.6 12.4V17.6M6.6 12.4L11 9" /><path d={HEART} transform="translate(14 10.7) scale(.6 .42)" className="k" /></>,
  cloud: () => <path d={CLOUD} />,
  cloudFace: () => <><path d={CLOUD} /><Eyes a={9.6} b={14.4} y={13.4} /></>,
  envelope: () => <><rect x={3} y={6} width={18} height={13} rx={1.8} /><path d="M3.9 7.2L12 13.4L20.1 7.2" /></>,
  moon: (sw: number) => <path d={MOON} transform="translate(12 12) scale(1.2)" strokeWidth={sw / 1.2} />,
  dot: () => <circle cx={12} cy={12} r={3.4} className="k" />,
  baozi: () => <><path d="M4.2 18.6C3.2 18.6 2.7 17.8 3 16.9C4 12.2 7.4 7.8 12 7.6C16.6 7.8 20 12.2 21 16.9C21.3 17.8 20.8 18.6 19.8 18.6Z" /><path d="M12 7.8C10.6 8.9 9.7 10.2 9.3 11.6M12 7.8C13.4 8.9 14.3 10.2 14.7 11.6M12 7.8V10.8M10.9 7.3C11.3 6.3 12.7 6.3 13.1 7.3" /><Eyes a={9.5} b={14.5} y={14.8} /></>,
  /** a heart stamped on top, like the red dot on a celebration bun */
  mantou: () => <><path d={DOME} /><path d={HEART} transform="translate(12 9.7) scale(.56)" className="k" /><Eyes a={9.4} b={14.6} y={13.6} /><path d="M11.1 15.9H12.9" /></>,
  huajuan: () => <><path d={DOME} /><path d="M12.4 13.6C11.2 13.8 10.5 12.8 10.9 11.9C11.4 10.8 13.2 10.7 14 11.8C15 13.1 14.4 15.2 12.5 15.9C10.2 16.7 7.8 15.3 7.6 12.8M16.6 16.2C17.6 14.4 17.6 12 16.4 10.2" /></>,
  jiaozi: () => <><path d="M3 12.6C4.6 12.4 5.4 10.4 7 10.2C8 8.6 9.8 7.6 12 7.6C14.2 7.6 16 8.6 17 10.2C18.6 10.4 19.4 12.4 21 12.6C20.6 17 16.8 19.4 12 19.4C7.2 19.4 3.4 17 3 12.6Z" /><path d="M7 10.2L7.7 11.6M9.6 8.4L10 9.9M12 7.6V9.3M14.4 8.4L14 9.9M17 10.2L16.3 11.6" /><Eyes a={9.5} b={14.5} y={14.4} /></>,
  steamer: () => <><path d="M2.8 10C3.6 7 7.4 5.4 12 5.4C16.6 5.4 20.4 7 21.2 10Z" /><path d="M10.8 5.4V4.4H13.2V5.4" /><path d="M3.6 10H20.4V17.6C20.4 18.9 19.4 19.8 18 19.8H6C4.6 19.8 3.6 18.9 3.6 17.6Z" /><path d="M3.6 13.8H20.4M7.8 13.8V19.8M12 13.8V19.8M16.2 13.8V19.8" /></>,
  croissant: () => <><path d="M3.2 16.4C2.4 11 6.8 6.8 12 6.8C17.2 6.8 21.6 11 20.8 16.4C20.5 17.6 19.3 17.8 18.6 16.9L16.4 14.2C15.4 15.6 13.8 16.4 12 16.4C10.2 16.4 8.6 15.6 7.6 14.2L5.4 16.9C4.7 17.8 3.5 17.6 3.2 16.4Z" /><path d="M7.6 14.2C7.4 11.4 8.2 8.8 9.6 7.3M16.4 14.2C16.6 11.4 15.8 8.8 14.4 7.3M4.4 11.4L6.9 12.6M19.6 11.4L17.1 12.6" /></>,
  bagel: () => <><circle cx={12} cy={12.25} r={8.6} /><circle cx={12} cy={12.25} r={2.6} /><path d={BAGEL_SEEDS} /></>,
  toast: () => <><path d="M6 20.2V11.8C4.1 11.3 3.3 9.9 3.6 8.4C4.2 5.6 7.6 4.2 12 4.2C16.4 4.2 19.8 5.6 20.4 8.4C20.7 9.9 19.9 11.3 18 11.8V20.2C18 20.6 17.6 21 17.2 21H6.8C6.4 21 6 20.6 6 20.2Z" /><Eyes a={9.5} b={14.5} y={13.4} r={1.2} /><path d="M11.1 15.9H12.9" /></>,
  baguette: () => <g transform="rotate(-38 12 12.25)"><rect x={1.4} y={9} width={21.2} height={6.6} rx={3.3} /><path d="M6.4 10.7L8.2 13.9M10.6 10.7L12.4 13.9M14.8 10.7L16.6 13.9" /></g>,
  pretzel: () => <><path d="M12 19.2C6.4 19.2 2.8 16.4 2.8 12C2.8 8 5.4 5.2 8.6 5.2C10.3 5.2 11.4 6 12 7.2C12.6 6 13.7 5.2 15.4 5.2C18.6 5.2 21.2 8 21.2 12C21.2 16.4 17.6 19.2 12 19.2Z" /><path d="M11 6.5C11.4 9.2 13.2 12.4 16.8 16.6M13 6.5C12.6 9.2 10.8 12.4 7.2 16.6" /><circle cx={6.4} cy={10} r={0.75} className="k" /><circle cx={17.6} cy={10} r={0.75} className="k" /><circle cx={12} cy={17.2} r={0.75} className="k" /></>,
} satisfies Record<string, (sw: number) => ReactNode>;
type Shape = keyof typeof SHAPES;
type Slot = readonly [x: number, y: number, scale: number, turn: number];

function put(shape: Shape, [x, y, s, r]: Slot, key: string | number) {
  const sw = LINE / s;
  return <g key={key} transform={`translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-12 -12)`} strokeWidth={sw}>{SHAPES[shape](sw)}</g>;
}

type Layer = { w: number; h: number; angle: number; lines: boolean; content: ReactNode };
const layer = (w: number, h: number, angle: number, content: ReactNode, lines = true): Layer => ({ w, h, angle, lines, content });

// The scattered print: four big shapes at different sizes, three small ones, two dots, the tile turned -22°.
const BIG: Slot[] = [[26, 26, 1.6, -4], [76, 20, 1, 10], [68, 70, 1.45, 6], [20, 78, 1.05, -12]];
const SMALL: Slot[] = [[50, 48, 0.58, -8], [92, 48, 0.4, 10], [44, 94, 0.42, -4]];
const DOTS = [[52, 10, 1.5], [96, 92, 1.4]];
const scatter = (big: [Shape, Shape, Shape, Shape], small: Shape = "heart") => [layer(100, 100, -22, <>
  {big.map((shape, i) => put(shape, BIG[i], i))}
  {SMALL.map((slot, i) => put(small, slot, `s${i}`))}
  {DOTS.map(([x, y, r], i) => <circle key={`d${i}`} cx={x} cy={y} r={r} className="k" />)}
</>)];

const polkaGrid = (draw: (x: number, y: number, index: number) => ReactNode) =>
  Array.from({ length: 16 }, (_, k) => draw((Math.floor(k / 4) % 2 ? 18 : 6) + 24 * (k % 4), 12 + 24 * Math.floor(k / 4), k));

const hangingCard = (x: number, y: number, r: number) => <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
  <path d="M0 0V2.4" /><rect x={-6.6} y={2.4} width={13.2} height={11.6} rx={1.6} /><path d={HEART} transform="translate(0 8.3) scale(.95)" className="k" />
</g>;

type Print = { id: string; tone: Tone; name: [string, string]; layers: Layer[] };
const DOUGH_ALL: [Shape, Shape, Shape, Shape] = ["dough", "dough", "dough", "dough"];

export const COVER_PRINTS: Print[] = [
  // the dough print in every colour; the first one is what a story without a cover shows
  ...(Object.keys(TONES) as Tone[]).map((tone): Print => ({ id: `dough-${tone}`, tone, name: [`面团 · ${TONE_NAMES[tone][0]}`, `Dough · ${TONE_NAMES[tone][1]}`], layers: scatter(DOUGH_ALL) })),
  { id: "gingham", tone: "rose", name: ["野餐格纹", "Picnic check"], layers: [
    layer(24, 24, 0, <><rect width={12} height={24} className="band" /><rect width={24} height={12} className="band" /></>, false),
    layer(192, 192, 0, <>
      {([[34, 36, 1.45, -6], [134, 58, 1.3, 8], [62, 134, 1.35, 5], [154, 158, 1.4, -9]] as Slot[]).map((slot, i) => put("doughCut", slot, i))}
      {([[98, 98, 0.5, 8], [178, 98, 0.42, -10], [20, 178, 0.45, 6]] as Slot[]).map((slot, i) => put("heart", slot, `h${i}`))}
    </>),
  ] },
  { id: "windowpane", tone: "mist", name: ["细格纹", "Windowpane"], layers: [
    layer(32, 32, 0, <><rect width={1.2} height={32} className="band-line" /><rect width={32} height={1.2} className="band-line" /></>, false),
    layer(96, 96, 0, <>{([[16.6, 16.6, 1.05, -4], [80.6, 48.6, 1.05, 6], [48.6, 80.6, 1.05, -8]] as Slot[]).map((slot, i) => put("doughCut", slot, i))}</>),
  ] },
  { id: "polka-dough", tone: "matcha", name: ["波点藏面团", "Dots with a dough"], layers: [
    layer(96, 96, 0, <>{polkaGrid((x, y, k) => k === 5 || k === 14 ? put("doughSolid", [x, y, 0.8, k === 5 ? -8 : 10], k) : <circle key={k} cx={x} cy={y} r={3.2} className="k" />)}</>),
  ] },
  { id: "dough-polka", tone: "lavender", name: ["面团波点", "Dough dots"], layers: [
    layer(96, 96, 0, <>{polkaGrid((x, y, k) => put("doughSolid", [x, y, 0.62, k % 3 ? 0 : -8], k))}</>),
  ] },
  { id: "dough-card", tone: "cream", name: ["面团抱小卡", "Dough with a card"], layers: scatter(["doughCard", "card", "doughCard", "card"]) },
  { id: "card-line", tone: "apricot", name: ["小卡晾绳", "Cards on a line"], layers: [
    layer(120, 84, -8, <g strokeWidth={1.6}>
      <path d="M0 18C30 30 90 30 120 18" strokeWidth={1.2} />{hangingCard(21, 23.8, 6)}{hangingCard(60, 27, -5)}{hangingCard(99, 23.8, 7)}
      <path d="M0 60C30 72 90 72 120 60" strokeWidth={1.2} />{hangingCard(41, 68.2, -6)}{hangingCard(79, 68.2, 5)}
    </g>),
  ] },
  { id: "cards", tone: "rose", name: ["小卡散落", "Scattered cards"], layers: scatter(["card", "card", "card", "dough"]) },
  { id: "butter", tone: "lake", name: ["黄油块", "Butter"], layers: scatter(["butter", "butter", "dough", "butter"]) },
  { id: "baozi", tone: "apricot", name: ["包子", "Baozi"], layers: scatter(["baozi", "baozi", "baozi", "baozi"]) },
  { id: "mantou", tone: "cream", name: ["馒头", "Mantou"], layers: scatter(["mantou", "mantou", "mantou", "mantou"]) },
  { id: "jiaozi", tone: "sage", name: ["饺子", "Dumplings"], layers: scatter(["jiaozi", "jiaozi", "jiaozi", "jiaozi"]) },
  { id: "huajuan", tone: "cocoa", name: ["花卷", "Flower rolls"], layers: scatter(["huajuan", "huajuan", "huajuan", "dough"]) },
  { id: "dim-sum", tone: "rose", name: ["点心铺", "Dim sum"], layers: scatter(["baozi", "mantou", "steamer", "jiaozi"]) },
  { id: "croissant", tone: "mist", name: ["可颂", "Croissants"], layers: scatter(["croissant", "croissant", "croissant", "dough"]) },
  { id: "bagel", tone: "cocoa", name: ["贝果", "Bagels"], layers: scatter(["bagel", "bagel", "bagel", "dough"]) },
  { id: "toast", tone: "apricot", name: ["吐司", "Toast"], layers: scatter(["toast", "toast", "toast", "toast"]) },
  { id: "baguette", tone: "matcha", name: ["法棍", "Baguettes"], layers: scatter(["baguette", "baguette", "baguette", "dough"]) },
  { id: "pretzel", tone: "lavender", name: ["椒盐卷饼", "Pretzels"], layers: scatter(["pretzel", "pretzel", "pretzel", "dough"]) },
  { id: "bakery", tone: "cream", name: ["面包店", "Bakery"], layers: scatter(["croissant", "bagel", "toast", "baguette"]) },
  { id: "hearts", tone: "apricot", name: ["爱心", "Hearts"], layers: scatter(["heart", "heart", "heart", "dough"]) },
  { id: "clouds", tone: "lake", name: ["云朵", "Clouds"], layers: scatter(["cloud", "cloudFace", "cloud", "cloud"]) },
  { id: "letters", tone: "lavender", name: ["信封", "Letters"], layers: scatter(["envelope", "envelope", "envelope", "dough"]) },
  { id: "moons", tone: "night", name: ["月亮", "Moons"], layers: scatter(["moon", "moon", "moon", "dough"], "dot") },
];

/** The plain dough (dot eyes, nose dash), for the "面团封面" tab. */
export function DoughIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={BODY} /><circle cx={8.6} cy={11.4} r={1.3} fill="currentColor" stroke="none" /><circle cx={15.4} cy={11.4} r={1.3} fill="currentColor" stroke="none" /><path d="M11.1 14H12.9" strokeWidth={1.4} />
  </svg>;
}

/** One built-in cover, filling its (positioned) parent. Unknown or missing id: the dough on rose. */
export default function CoverPrint({ id }: { id?: string }) {
  const print = COVER_PRINTS.find((item) => item.id === id) ?? COVER_PRINTS[0];
  const uid = `cover-print-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={`cover-print${print.tone === "night" ? " is-night" : ""}`} style={{ "--print-bg": TONES[print.tone] } as CSSProperties} aria-hidden="true">
      <svg>
        <defs>
          {print.layers.map((item, i) => <pattern key={i} id={`${uid}-${i}`} width={item.w} height={item.h} patternUnits="userSpaceOnUse" patternTransform={`rotate(${item.angle})`}>
            {item.lines ? <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{item.content}</g> : item.content}
          </pattern>)}
        </defs>
        {print.layers.map((_, i) => <rect key={i} width="100%" height="100%" fill={`url(#${uid}-${i})`} />)}
      </svg>
    </span>
  );
}
