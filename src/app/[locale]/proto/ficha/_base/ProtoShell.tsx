"use client";

// Prototipo fase 8.3 — contenedor `.kp` del prototipo: tema (claro/oscuro) y
// movimiento (sí/no) por atributo, elegibles y recordados. Sin atributo manda
// el sistema (`prefers-color-scheme`, `prefers-reduced-motion`): el HTML del
// servidor ya sale bien antes de que cargue este script.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DIRS, WORKS, fichaPath } from "./works";
import type { DirId } from "./types";

type Theme = "light" | "dark";
type Motion = "on" | "off";

interface ProtoState {
  /** `null` hasta leer la preferencia (primer pintado). */
  theme: Theme | null;
  /** `true` si hay que quitar el movimiento (interruptor o sistema). */
  reducedMotion: boolean;
}

const ProtoContext = createContext<ProtoState>({ theme: null, reducedMotion: false });

/** Para los componentes cliente de cada dirección. */
export const useProto = () => useContext(ProtoContext);

const THEME_KEY = "kp-theme";
const MOTION_KEY = "kp-motion";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: la elección vale hasta recargar.
  }
}

interface ShellProps {
  locale: string;
  /** Dirección y obra actuales (en el índice no hay). */
  current?: { dir: DirId; type: string; id: string };
  /** Clases de fuentes de la dirección (variables CSS de `next/font`). */
  fontClassName?: string;
  children: ReactNode;
}

export function ProtoShell({ locale, current, fontClassName = "", children }: ShellProps) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    const savedTheme = read(THEME_KEY);
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : darkQuery.matches ? "dark" : "light");
    const savedMotion = read(MOTION_KEY);
    if (savedMotion === "on" || savedMotion === "off") setMotion(savedMotion);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(motionQuery.matches);
    const onMotion = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    motionQuery.addEventListener("change", onMotion);
    return () => motionQuery.removeEventListener("change", onMotion);
  }, []);

  const reducedMotion = motion ? motion === "off" : systemReduced;

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      write(THEME_KEY, next);
      return next;
    });
  }, []);
  const toggleMotion = useCallback(() => {
    const next: Motion = reducedMotion ? "on" : "off";
    write(MOTION_KEY, next);
    setMotion(next);
  }, [reducedMotion]);

  const es = locale !== "en";
  const work = current ? WORKS.find((w) => w.type === current.type && w.id === current.id) : undefined;

  return (
    <ProtoContext.Provider value={{ theme, reducedMotion }}>
      <div
        className={`kp ${current ? `kp-${current.dir}` : "kp-index"} ${fontClassName}`}
        data-theme={theme ?? undefined}
        data-motion={motion ?? undefined}
      >
        <header className="kp-bar">
          <a className="kp-bar-home" href={`/${locale}/proto/ficha`}>
            {es ? "Índice" : "Index"}
          </a>
          {current && (
            <nav className="kp-bar-group" aria-label={es ? "Dirección" : "Direction"}>
              {DIRS.map((d) => (
                <a
                  key={d.id}
                  href={fichaPath(locale, d.id, current)}
                  aria-current={d.id === current.dir ? "page" : undefined}
                  title={d.name}
                >
                  {d.id.toUpperCase()}
                </a>
              ))}
            </nav>
          )}
          {current && (
            <label className="kp-bar-work">
              <span className="kp-sr">{es ? "Obra" : "Title"}</span>
              <select
                value={work?.slug ?? ""}
                onChange={(e) => {
                  const next = WORKS.find((w) => w.slug === e.target.value);
                  if (next) window.location.assign(fichaPath(locale, current.dir, next));
                }}
              >
                {!work && <option value="">—</option>}
                {WORKS.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="kp-bar-switches">
            <button type="button" onClick={toggleTheme} aria-pressed={theme === "dark"}>
              {es ? "Oscuro" : "Dark"}
            </button>
            <button type="button" onClick={toggleMotion} aria-pressed={!reducedMotion}>
              {es ? "Movimiento" : "Motion"}
            </button>
          </div>
        </header>
        {children}
      </div>
    </ProtoContext.Provider>
  );
}
