import { useId } from "react";

// No cover picked: a dense, tilted all-over print of the line-drawn dough.
// Same drawing language as SpaceIcons: plump outline, dot eyes, nose dash, no mouth, round caps.
// Colours come from the theme tokens via CSS (.story-pattern), so dark mode follows on its own.

const BODY = "M12 3.5C18 3.5 20.5 5 20.7 10C20.9 13 20.9 15.5 20.5 17.5C19.9 20.3 17 21 12 21C7 21 4.1 20.3 3.5 17.5C3.1 15.5 3.1 13 3.3 10C3.5 5 6 3.5 12 3.5Z";
const HEART = "M0 2.6C-3.1 .8-3.6-1.1-2.5-1.9C-1.6-2.5-.6-2 0-1.2C.6-2 1.6-2.5 2.5-1.9C3.6-1.1 3.1 .8 0 2.6Z";
const LINE = 1.5;

function Dough({ x, y, s, r = 0 }: { x: number; y: number; s: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r} 12 12) scale(${s})`} strokeWidth={LINE / s}>
      <path d={BODY} className="sp-fill" />
      <circle cx="8.6" cy="11.4" r={1.25} className="sp-ink" stroke="none" />
      <circle cx="15.4" cy="11.4" r={1.25} className="sp-ink" stroke="none" />
      <path d="M11.1 13.9H12.9" />
    </g>
  );
}

function Card({ x, y, s, r }: { x: number; y: number; s: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} strokeWidth={LINE / s}>
      <rect x="-5" y="-4.5" width="10" height="9" rx="1.4" className="sp-butter" />
      <path d={HEART} transform="translate(0 -.3) scale(.72)" className="sp-heart" stroke="none" />
    </g>
  );
}

export default function StoryCoverPattern({ angle = -22 }: { angle?: number }) {
  const id = `story-pattern-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="story-pattern" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={id} width="112" height="112" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <Dough x={4} y={4} s={2} r={-4} />
            <Dough x={66} y={6} s={1.15} r={10} />
            <Dough x={58} y={52} s={1.8} r={6} />
            <Dough x={6} y={66} s={1.25} r={-12} />
            <Card x={52} y={40} s={1.3} r={-14} />
            <Card x={100} y={96} s={1} r={12} />
            <Card x={44} y={100} s={.9} r={-6} />
            <path d={HEART} transform="translate(96 40) scale(1.5)" className="sp-heart" stroke="none" />
            <path d={HEART} transform="translate(30 56) scale(1.1)" className="sp-heart" stroke="none" />
            <circle cx="102" cy="64" r="1.8" className="sp-ink" stroke="none" />
            <circle cx="40" cy="12" r="1.4" className="sp-ink" stroke="none" />
            <circle cx="20" cy="104" r="1.6" className="sp-ink" stroke="none" />
            <path d="M84 24v6M81 27h6" />
            <path d="M20 50v5M17.5 52.5h5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
