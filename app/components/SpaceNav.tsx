"use client";

import { CaretRight } from "@phosphor-icons/react";
import "./space.css";

export type SpaceRow = { id: string; label: string; value?: string };
export type SpaceGroup = { title: string; rows: SpaceRow[] };

type Props = {
  title: string;
  intro: string;
  groups: SpaceGroup[];
  active: string | null;
  onSelect: (id: string) => void;
};

/** The list of everything personal, in three groups. One list, one place. */
export default function SpaceNav({ title, intro, groups, active, onSelect }: Props) {
  return (
    <nav className="space-list" aria-label={title}>
      <header>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id}>
                <button type="button" className={active === row.id ? "active" : ""} aria-current={active === row.id ? "page" : undefined} onClick={() => onSelect(row.id)}>
                  <span>{row.label}</span>
                  {row.value && <small>{row.value}</small>}
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
