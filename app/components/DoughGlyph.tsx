import {
  ArrowsClockwise,
  BookOpenText,
  Brain,
  Check,
  EnvelopeSimple,
  ImagesSquare,
  WarningCircle,
  Waveform,
} from "@phosphor-icons/react";

export type DoughGlyphState = "companion" | "thinking" | "happy" | "error" | "story" | "revision" | "vision" | "sound" | "memory";

const stateIcons = {
  companion: EnvelopeSimple,
  thinking: null,
  happy: Check,
  error: WarningCircle,
  story: BookOpenText,
  revision: ArrowsClockwise,
  vision: ImagesSquare,
  sound: Waveform,
  memory: Brain,
} as const;

export function DoughGlyph({ state = "companion", size = "avatar" }: { state?: DoughGlyphState; size?: "brand" | "avatar" | "page" }) {
  const Icon = stateIcons[state];
  return (
    <span className={`dough-glyph dough-glyph-${size} dough-glyph-${state}`} aria-hidden="true">
      <span className="dough-glyph-face"><i/><i/><b/><em/></span>
      {Icon && <span className="dough-glyph-object"><Icon weight="regular" /></span>}
    </span>
  );
}

export function AlreaDoughBrand() {
  return <><DoughGlyph size="brand"/><strong>Alrea<span>Dough</span></strong></>;
}
