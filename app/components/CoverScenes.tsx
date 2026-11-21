import { useId, type ReactNode } from "react";

// Landscape covers for "面团封面": whole pictures like a phone's own wallpapers, where the sun, the moon and the clouds are all the dough.
// One drawing in a 1000x560 box, cropped by each frame (preserveAspectRatio slice). Every focal dough sits where the 4:5 library card,
// the wide desktop cover and the phone cover all show it, above the card's title. The colours stay the same in dark mode.

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const HEART = "M0 2.6C-3.1 .8-3.6-1.1-2.5-1.9C-1.6-2.5-.6-2 0-1.2C.6-2 1.6-2.5 2.5-1.9C3.6-1.1 3.1 .8 0 2.6Z";
const SUN = 9.2; // sun and sea-sun dough, about 160 units tall


function Sky({ id, stops }: { id: string; stops: [string, string, string] }) {
  return <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    {stops.map((c, i) => <stop key={i} offset={[0, 0.55, 1][i]} stopColor={c} />)}
  </linearGradient>;
}

function Halo({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  const h = 17.5 * s;
  return <>
    <circle cx={x} cy={y} r={h * 0.95} fill={c} opacity={0.18} />
    <circle cx={x} cy={y} r={h * 0.7} fill={c} opacity={0.22} />
  </>;
}

/** The dough: dot eyes, nose dash, no mouth. */
function Dough({ x, y, s, fill, ink, line = 0 }: { x: number; y: number; s: number; fill: string; ink: string; line?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s}) translate(-12 -12.25)`}>
    <path d={BODY} fill={fill} {...(line ? { stroke: ink, strokeWidth: line / s } : {})} />
    <circle cx={8.6} cy={11.4} r={1.1} fill={ink} />
    <circle cx={15.4} cy={11.4} r={1.1} fill={ink} />
    <path d="M11.1 13.9H12.9" strokeLinecap="round" stroke={ink} strokeWidth={Math.max(0.34, 1.9 / s)} />
  </g>;
}

const lyingBody = (x: number, y: number, w: number, h: number, fill: string) =>
  <path d={BODY} transform={`translate(${x} ${y}) scale(${w / 17.8} ${h / 17.5}) translate(-12 -12.25)`} fill={fill} />;

/** A cloud: a dough lying down with a smaller one tucked behind it; only the front one has eyes. */
function Cloud({ x, y, size, fill, ink, op = 0.9 }: { x: number; y: number; size: number; fill: string; ink?: string; op?: number }) {
  const w = size, h = size * 0.62;
  return <g opacity={op}>
    {lyingBody(x + w * 0.42, y + h * 0.18, w * 0.56, h * 0.56, fill)}
    {lyingBody(x, y, w, h, fill)}
    {ink && <>
      <circle cx={x - w * 0.18} cy={y - h * 0.04} r={h * 0.06} fill={ink} />
      <circle cx={x + w * 0.18} cy={y - h * 0.04} r={h * 0.06} fill={ink} />
    </>}
  </g>;
}

const SkyClouds = ({ fill, ink }: { fill: string; ink: string }) => <>
  <Cloud x={214} y={138} size={150} fill={fill} ink={ink} />
  <Cloud x={796} y={150} size={108} fill={fill} ink={ink} />
  <Cloud x={668} y={208} size={60} fill={fill} ink={ink} op={0.85} />
</>;

const Ground = ({ d, c }: { d: string; c: string }) => <path d={d} fill={c} />;
const Lines = ({ d, c, w, op }: { d: string; c: string; w: number; op: number }) =>
  <path d={d} fill="none" strokeLinecap="round" strokeWidth={w} opacity={op} stroke={c} />;
const waves = (points: [number, number][]) => points.map(([x, y]) => `M${x} ${y}q15 -9 30 0t30 0`).join("");
const reflection = (cx: number, y0: number, w: number) =>
  [0, 1, 2, 3, 4].map((i) => `M${cx - w * (0.5 - i * 0.09)} ${y0 + i * 20 + i * i * 1.5}H${cx + w * (0.5 - i * 0.09)}`).join("");

// fixed starry sky for the night scene, kept clear of the moon
const STARS = (() => {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const x = Math.round(rand() * 1000), y = Math.round(rand() * 340), r = 1 + rand() * 1.6, o = 0.4 + rand() * 0.5;
    if (Math.hypot(x - 560, y - 250) >= 150) stars.push({ x, y, r, o });
  }
  return stars;
})();

type Scene = { id: string; name: [string, string]; draw: (uid: string) => ReactNode };

export const COVER_SCENES: Scene[] = [
  { id: "scene-sunrise", name: ["日出", "Sunrise"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#d8b0b9", "#f0d3cf", "#f7e3d5"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <SkyClouds fill="#fff8f3" ink="#c8939e" />
    <Halo x={500} y={300} s={SUN} c="#fff4ea" /><Dough x={500} y={300} s={SUN} fill="#fff6ef" ink="#a8707b" />
    <Ground d="M0 312C120 282 260 300 380 328C470 348 560 342 660 324C780 302 900 308 1000 330V560H0Z" c="#e8bcbf" />
    <Ground d="M0 392C150 362 300 384 440 410C560 432 700 412 820 392C900 380 960 384 1000 392V560H0Z" c="#d9a3aa" />
    <Ground d="M0 460C180 430 360 456 520 480C680 502 840 462 1000 450V560H0Z" c="#c98d96" />
  </> },
  { id: "scene-sea", name: ["海边", "Seaside"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#b4cbd9", "#dfe8ec", "#f5e9e0"]} /><Sky id={`${uid}-sea`} stops={["#a9c3cf", "#93b3c3", "#7d9fb1"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <SkyClouds fill="#fffaf6" ink="#93aebd" />
    <Halo x={500} y={300} s={SUN} c="#fff6ec" /><Dough x={500} y={300} s={SUN} fill="#fff3e6" ink="#5f7f90" />
    <rect y="338" width="1000" height="222" fill={`url(#${uid}-sea)`} />
    <Lines d={reflection(500, 356, 164)} c="#fffaf6" w={4.5} op={0.8} />
    <Lines d={waves([[120, 446], [780, 452], [300, 492], [650, 512], [880, 530], [170, 536]])} c="#fffaf6" w={2.4} op={0.4} />
  </> },
  { id: "scene-sunset-sea", name: ["晚霞海边", "Sunset sea"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#d9a7b0", "#efc7bd", "#f8dccb"]} /><Sky id={`${uid}-sea`} stops={["#d6a0a5", "#c4909a", "#b2808d"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <SkyClouds fill="#fff1ea" ink="#c98a95" />
    <Halo x={500} y={312} s={SUN} c="#fff0e4" /><Dough x={500} y={312} s={SUN} fill="#fff1e4" ink="#a86f78" />
    <rect y="350" width="1000" height="210" fill={`url(#${uid}-sea)`} />
    <Lines d={reflection(500, 368, 164)} c="#fff3ea" w={4.5} op={0.75} />
    <Lines d={waves([[130, 452], [770, 460], [310, 498], [650, 518], [880, 534]])} c="#fff3ea" w={2.4} op={0.35} />
  </> },
  { id: "scene-clouds", name: ["云上", "Above the clouds"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#c4b6d7", "#e3d7e6", "#f2e6e8"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <Cloud x={214} y={128} size={120} fill="#fbf6fa" ink="#a893bd" op={0.8} />
    <Cloud x={800} y={150} size={90} fill="#fbf6fa" ink="#a893bd" op={0.75} />
    {[[-20, 402, 230], [170, 392, 210], [330, 404, 190], [670, 404, 190], [830, 392, 210], [1020, 402, 230]].map(([x, y, s]) => <Cloud key={`b${x}`} x={x} y={y} size={s} fill="#ebe1ee" op={1} />)}
    <path d={HEART} transform="translate(562 214) rotate(10) scale(4.4)" fill="#fffaf7" />
    <Dough x={500} y={330} s={9.6} fill="#fffaf7" ink="#85709b" />
    {[[60, 474, 240], [250, 466, 220], [440, 484, 230], [630, 470, 220], [810, 476, 240], [1000, 470, 220]].map(([x, y, s]) => <Cloud key={`m${x}`} x={x} y={y} size={s} fill="#f6eff5" op={1} />)}
    {[[0, 544, 250], [190, 538, 230], [380, 550, 250], [570, 542, 230], [760, 548, 250], [950, 540, 230]].map(([x, y, s]) => <Cloud key={`f${x}`} x={x} y={y} size={s} fill="#fffaf7" op={1} />)}
  </> },
  { id: "scene-field", name: ["麦田", "Wheat field"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#ecc68c", "#f4dcb4", "#f8eadb"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <SkyClouds fill="#fff6e8" ink="#c9995c" />
    <Halo x={500} y={256} s={8.6} c="#fff3dc" /><Dough x={500} y={256} s={8.6} fill="#fff3dc" ink="#a8743a" />
    <Ground d="M0 312C160 282 320 298 470 312C620 326 800 298 1000 308V560H0Z" c="#e9c88c" />
    <Ground d="M0 372C200 342 380 362 540 384C700 406 860 364 1000 358V560H0Z" c="#ddb376" />
    <Ground d="M0 440C220 406 420 430 600 458C760 482 900 450 1000 438V560H0Z" c="#cf9f61" />
    <Lines d="M0 480C220 450 420 472 600 500C760 524 900 492 1000 480M0 515C220 486 420 508 600 536C760 560 900 528 1000 516" c="#fff6e6" w={2} op={0.32} />
  </> },
  { id: "scene-night", name: ["夜晚", "Night"], draw: (uid) => <>
    <defs><Sky id={`${uid}-sky`} stops={["#262b44", "#3d4060", "#6a5a78"]} /></defs>
    <rect width="1000" height="560" fill={`url(#${uid}-sky)`} />
    <g fill="#fff4e6">{STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />)}</g>
    <Halo x={560} y={250} s={8} c="#fbeedf" /><Dough x={560} y={250} s={8} fill="#fbeedf" ink="#3d4060" />
    <Cloud x={368} y={316} size={140} fill="#fbeedf" op={0.16} />
    <Cloud x={760} y={330} size={90} fill="#fbeedf" op={0.12} />
    <Ground d="M0 372C180 332 340 352 480 378C620 404 800 352 1000 362V560H0Z" c="#3a3b57" />
    <Ground d="M0 448C200 408 400 428 560 454C720 480 880 438 1000 428V560H0Z" c="#2a2b42" />
  </> },
];

/** One landscape cover, filling its (positioned) parent. */
export function CoverScene({ scene }: { scene: Scene }) {
  const uid = `cover-scene-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="cover-scene" aria-hidden="true">
      <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice">{scene.draw(uid)}</svg>
    </span>
  );
}
