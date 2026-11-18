"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./product.module.css";

type Item = { id: string; title: string; price: ReactNode; lines: string[] };

// Plan cards on the product page: click (or Enter/Space) to highlight one.
export default function PlanPicker({ items, initial, label }: { items: Item[]; initial: string; label: string }) {
  const [selected, setSelected] = useState(initial);
  function onKey(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(id); }
  }
  return (
    <div className={styles.plans} role="radiogroup" aria-label={label}>
      {items.map((item) => (
        <article
          key={item.id}
          className={styles.plan}
          role="radio"
          tabIndex={0}
          aria-checked={selected === item.id}
          data-selected={selected === item.id ? "true" : undefined}
          onClick={() => setSelected(item.id)}
          onKeyDown={(event) => onKey(event, item.id)}
        >
          <h3>{item.title}</h3>
          <p className={styles.price}>{item.price}</p>
          <ul>{item.lines.map((line) => <li key={line}>{line}</li>)}</ul>
        </article>
      ))}
    </div>
  );
}
