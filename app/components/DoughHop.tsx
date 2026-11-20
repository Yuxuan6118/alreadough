import DoughLineMark from "./DoughLineMark";
import "./dough-hop.css";

/**
 * The line-drawn dough hopping in place above a soft shadow: the loading mark used everywhere.
 * xs sits inside a button or a chat bubble, sm next to a line of text, md in a card, lg for a long wait.
 * Colour comes from `color` on the parent (currentColor).
 */
export type DoughHopSize = "xs" | "sm" | "md" | "lg";

export default function DoughHop({ size = "md", className }: { size?: DoughHopSize; className?: string }) {
  return <span className={`dough-hop dough-hop-${size}${className ? ` ${className}` : ""}`} aria-hidden="true"><DoughLineMark/><i/></span>;
}
