"use client";

import { useEffect, useState } from "react";
import { isLocalCover, readLocalCover } from "@/lib/cover-store";
import StoryCoverPattern from "./StoryCoverPattern";

/** A story cover: a web photo, or one she uploaded that lives on this device. No photo (or not on this device): the dough print. */
export default function StoryCoverImage({ image, tone, lazy = false }: { image?: string; tone: string; lazy?: boolean }) {
  const local = isLocalCover(image);
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!local || !image) return;
    let url: string | null = null;
    let live = true;
    readLocalCover(image)
      .then((blob) => { if (!live) return; url = blob ? URL.createObjectURL(blob) : null; setResolved({ key: image, url }); })
      .catch(() => { if (live) setResolved({ key: image, url: null }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [image, local]);

  const src = local ? (resolved && resolved.key === image ? resolved.url : undefined) : image;
  if (src) return <img src={src} alt="" loading={lazy ? "lazy" : undefined} decoding="async" />;
  // still reading the local photo: keep the space quiet instead of flashing the pattern
  if (local && (!resolved || resolved.key !== image)) return <span className={`story-fallback ${tone}`} aria-hidden="true" />;
  return <span className={`story-fallback ${tone}`} aria-hidden="true"><StoryCoverPattern /></span>;
}
