"use client";

import { useEffect, useState } from "react";
import styles from "./product.module.css";

// The module list beside the feature cards: the one whose card is in the middle of the screen is highlighted.
export default function ModuleIndex({ items, label }: { items: { id: string; name: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const cards = items.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => Boolean(node));
    // a thin band across the middle of the viewport: whichever card crosses it is the current one
    const observer = new IntersectionObserver((entries) => {
      const hit = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: "-45% 0px -54% 0px" });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.index} aria-label={label}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined} onClick={() => setActive(item.id)}>
          {item.name}
        </a>
      ))}
    </nav>
  );
}
