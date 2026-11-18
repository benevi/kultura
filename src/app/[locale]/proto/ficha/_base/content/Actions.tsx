"use client";

// Prototipo fase 8.3 — acciones de la ficha, de maqueta: no guardan nada.
// Sin estilo propio: cada dirección las viste por sus clases
// (`kp-actions`, `kp-action`, `data-primary`, `aria-pressed`).

import { useState } from "react";
import type { Labels } from "../labels";

export function Actions({ labels, className = "" }: { labels: Labels; className?: string }) {
  const [inLibrary, setInLibrary] = useState(false);
  return (
    <div className={`kp-actions ${className}`}>
      <button
        type="button"
        className="kp-action"
        data-primary=""
        aria-pressed={inLibrary}
        onClick={() => setInLibrary((v) => !v)}
      >
        {inLibrary ? labels.inLibrary : labels.addToLibrary}
      </button>
      <button type="button" className="kp-action">
        {labels.addToList}
      </button>
      <button type="button" className="kp-action">
        {labels.recommend}
      </button>
    </div>
  );
}
