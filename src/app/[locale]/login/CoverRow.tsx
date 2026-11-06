/* eslint-disable @next/next/no-img-element -- `<img>` nativo a propósito: las pinta el HTML desde el primer fotograma y el lienzo de profundidad las sustituye. */
import { forwardRef, type CSSProperties, type RefObject } from "react";
import type { LoginCover } from "@/lib/landing/login-covers";

/** Portada que queda detrás del formulario al cargar (la fila arranca aquí en escritorio). */
const START = 1;

function startK(i: number, n: number): number {
  let k = i - START;
  if (k < -n / 2) k += n;
  if (k >= n / 2) k -= n;
  return k;
}

interface CoverRowProps {
  covers: LoginCover[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/** La fila en HTML: ya colocada por CSS antes de que el motor tome el relevo. */
export const CoverRow = forwardRef<HTMLDivElement, CoverRowProps>(function CoverRow({ covers, canvasRef }, ref) {
  return (
    <div ref={ref} className="kh-row" aria-hidden="true">
      {covers.map((c, i) => {
        const k = startK(i, covers.length);
        return (
          <div key={c.key} className={k < 0 ? "kh-item is-left" : "kh-item"} data-i={i} style={{ "--k": k } as CSSProperties}>
            <div className="kh-flip">
              <div className="kh-face">
                <img
                  src={c.image}
                  alt=""
                  width={c.width}
                  height={c.height}
                  decoding="async"
                  loading={Math.abs(k) <= 2 ? "eager" : "lazy"}
                  draggable={false}
                  style={{ objectPosition: `${c.focus[0] * 100}% ${c.focus[1] * 100}%` }}
                />
              </div>
              <div className="kh-face kh-back" data-t={c.title} data-f={c.label} style={{ background: c.back }} />
            </div>
          </div>
        );
      })}
      <canvas ref={canvasRef} />
    </div>
  );
});
