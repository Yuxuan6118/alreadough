import { useId } from "react";

// The dough as a sheet of script paper: its top-right corner is folded down. Dot eyes and a short nose dash, no mouth.
// Used on the "重新写一版" button. Strokes use currentColor.
export default function DoughPageIcon({ size = 16, className }: { size?: number; className?: string }) {
  const mask = `dough-page-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
          <rect x="-2" y="-2" width="28" height="28" fill="#fff" />
          <path d="M14.6 2.7L14.6 -2L26 -2L26 9.9L21.9 9.9Z" fill="#000" />
        </mask>
      </defs>
      <path mask={`url(#${mask})`} d="M12 2.6C18.4 2.6 21.75 3.9 21.9 9.4C22.1 12.4 22.1 15 21.75 17.25C21.2 20.8 18 22.1 12 22.1C6 22.1 2.8 20.8 2.25 17.25C1.9 15 1.9 12.4 2.1 9.4C2.25 3.9 5.6 2.6 12 2.6Z" />
      <path d="M14.6 2.7L21.9 9.9" />
      <path d="M14.6 2.9V8.2C14.6 9.2 15.3 9.9 16.3 9.9H21.7" />
      <circle cx="8" cy="13.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="13.6" r="1.05" fill="currentColor" stroke="none" />
      <path d="M11.1 15H12.3" strokeWidth="1.15" />
    </svg>
  );
}
