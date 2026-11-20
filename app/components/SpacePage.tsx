"use client";

import type { ReactNode } from "react";
import SpaceNav, { type SpaceGroup } from "./SpaceNav";
import "./space-page.css";

type Props = {
  className?: string;
  title: string;
  intro: string;
  groups: SpaceGroup[];
  active: string;
  onSelect: (id: string) => void;
  children: ReactNode;
};

/**
 * A practice page (转念, 愿景) laid out like My space: the grouped list on the left,
 * the chosen part on the right. On a phone the list becomes a row of pills above the part,
 * so the page opens straight onto something to do instead of an extra list screen.
 */
export default function SpacePage({ className, title, intro, groups, active, onSelect, children }: Props) {
  const rows = groups.flatMap((group) => group.rows);
  const current = rows.find((row) => row.id === active);
  return (
    <section className={`full-view space-page${className ? ` ${className}` : ""}`}>
      <div className="space-layout has-detail">
        <SpaceNav title={title} intro={intro} groups={groups} active={active} onSelect={onSelect} />
        <div className="space-detail">
          <header className="space-page-phone-head">
            <h1>{title}</h1>
            <p>{intro}</p>
          </header>
          <div className="wish-pills space-page-pills" role="group" aria-label={title}>
            {rows.map((row) => (
              <button type="button" key={row.id} className={row.id === active ? "selected" : ""} aria-pressed={row.id === active} onClick={() => onSelect(row.id)}>
                {row.label}{row.value ? <small>{row.value}</small> : null}
              </button>
            ))}
          </div>
          {current && <header className="space-detail-head"><h2>{current.label}</h2></header>}
          {children}
        </div>
      </div>
    </section>
  );
}
