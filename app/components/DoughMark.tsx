type DoughMarkProps = {
  size?: "mini" | "small" | "brand";
  mood?: "calm" | "thinking" | "happy";
  pocket?: boolean;
};

export function DoughMark({ size = "brand", mood = "calm", pocket = false }: DoughMarkProps) {
  return (
    <span className={`dough-mark dough-mark-${size} dough-mark-${mood}`} aria-hidden="true">
      <i className="dough-eye dough-eye-left" />
      <i className="dough-eye dough-eye-right" />
      <i className="dough-mouth" />
      {pocket && <i className="dough-pocket"><b /></i>}
    </span>
  );
}

export function BrandLockup() {
  return <><DoughMark /><strong>Alrea<span>Dough</span></strong></>;
}
