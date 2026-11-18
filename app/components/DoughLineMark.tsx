import { useId } from "react";

// Line-drawn AlreaDough mascot: a round, plump dough with a small butter card (heart) tucked into its smile.
// Strokes use currentColor, so the parent's `color` sets it. The card is clipped at the fold so it sits behind the lip.
export default function DoughLineMark({ className }: { className?: string }) {
  const clip = `dough-fold-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <clipPath id={clip}><path d="M0 0H64V41H46C42 44.4 37 45.9 31.5 45.9C26.5 45.9 22 44.2 18 41.5H0Z" /></clipPath>
      </defs>
      <path d="M32 7C49 7 58 10.5 58.5 25C59 33 59 40 58 46C56.5 55.5 48 59 32 59C16 59 7.5 55.5 6 46C5 40 5 33 5.5 25C6 10.5 15 7 32 7Z" strokeWidth="4.2" />
      <circle cx="21" cy="29" r="3.1" fill="currentColor" stroke="none" />
      <circle cx="43" cy="29" r="3.1" fill="currentColor" stroke="none" />
      <path d="M30 33.5H34" strokeWidth="3" />
      <g clipPath={`url(#${clip})`}>
        <g transform="rotate(-6 38 42.5)">
          <rect x="33" y="38.9" width="10" height="9" rx="1.4" strokeWidth="2.3" />
          <path d="M0 2.6C-3.1 .8-3.6-1.1-2.5-1.9C-1.6-2.5-.6-2 0-1.2C.6-2 1.6-2.5 2.5-1.9C3.6-1.1 3.1 .8 0 2.6Z" transform="translate(38 41.8) scale(.72)" strokeWidth="1.94" />
        </g>
      </g>
      <path d="M18 41.5C22 44.2 26.5 45.9 31.5 45.9C37 45.9 42 44.4 46 41" strokeWidth="2.6" />
    </svg>
  );
}
