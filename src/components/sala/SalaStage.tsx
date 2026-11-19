import * as React from "react";
import { planSalaTitle, SALA_TITLE_PRESET, salaScripts, type SalaTitlePreset } from "@/lib/design/sala-title";
import { SALA_TITLE_CSS } from "@/lib/design/sala-title-css";
import { resolveSalaFuse, salaFuseBackground, type SalaFuseData } from "@/lib/design/sala-title-fuse";
import { cn } from "@/lib/utils/index";
import { SalaScriptFonts } from "./SalaScriptFonts";
import { SalaTitleText, salaTitleVars } from "./SalaTitle";

/**
 * La sala (fase 8.4): la imagen de una obra a todo el ancho con el rótulo
 * dentro (biblia §1 y §3). Es la pieza de presentación en 2D; el 3D y los
 * mapas de profundidad no son de esta fase.
 *
 * - **El título es el de verdad**: un encabezado con el texto entero, una
 *   sola vez. No hay copia para el efecto.
 * - **Sin datos, el título va entero por delante**, sobre un velo. El velo
 *   por defecto (0,7) da 5:1 o más sobre cualquier imagen: con 0,5 ya son
 *   3:1 aunque la imagen sea blanca. Quien conozca la imagen puede bajarlo
 *   (`veil`), y entonces mide.
 * - **Fundido** (`fuse`): partes de la imagen pasan por delante de las
 *   letras. Entra con las coberturas ya medidas y la figura recortada; el
 *   plan sale de `planTitleFuse` y no se pinta si no cumple (22 %, 3:1, 35 %):
 *   ver `resolveSalaFuse`. Se pinta con el propio texto (`background-clip:
 *   text`), y por eso el encabezado ocupa la sala entera: su fondo casa con
 *   la imagen sin medir nada en el navegador.
 * - **Se apaga solo** con movimiento reducido (del sistema o
 *   `data-sala-motion="reduce"` en un antepasado), con `prefers-contrast:
 *   more`, con colores forzados y donde el navegador no sabe pintarlo. Lo
 *   decide el CSS (`title.css`): el HTML es el mismo.
 * - **La sala no cambia con el tema** (biblia §4): lleva su propio
 *   `data-theme`. `tone="dark"` es tinta clara sobre velo oscuro.
 * - **Sin imagen**, o mientras llega: el campo de color con el título.
 *
 * El alto lo pone quien la usa (`className`: una proporción o un alto).
 * `ref` y las props nativas van a la caja de la sala.
 */
export interface SalaStageFuse {
  /** La figura recortada (lo que pasa por delante), con el mismo encuadre que la imagen. */
  figure: string;
  /** Lo medido con la composición estrecha. Sin ello, la estrecha va sin fundido. */
  narrow?: SalaFuseData | null;
  /** Lo medido con la composición ancha. */
  wide?: SalaFuseData | null;
  /** Ancho entre alto de la sala en cada composición, para el margen de las letras que van por delante. */
  ratio?: { narrow?: number; wide?: number };
}

export interface SalaStageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  titleLang?: string;
  /** El título original, en su escritura, con su idioma. Va debajo, fuera del encabezado. */
  original?: { text: string; lang: string } | null;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  headingId?: string;
  /** La imagen de la obra, que llena la sala: un `<img>` o un `next/image`. Sin ella, el campo de color. */
  image?: React.ReactNode;
  /** Punto de interés de la imagen (`object-position`). */
  focus?: string;
  /** `dark`: tinta clara sobre velo oscuro. `light`: al revés, para imágenes muy claras. */
  tone?: "dark" | "light";
  /** Opacidad del velo, 0–1. Por defecto 0,7. */
  veil?: number;
  fuse?: SalaStageFuse | null;
  preset?: SalaTitlePreset;
  /** Lo que va debajo del título, dentro de la sala. */
  children?: React.ReactNode;
}

/** Velo por defecto: tinta clara a 5:1 o más sobre cualquier imagen. */
export const SALA_STAGE_VEIL = 0.7;

export const SalaStage = React.forwardRef<HTMLDivElement, SalaStageProps>(function SalaStage(
  {
    title,
    titleLang,
    original,
    headingLevel = 1,
    headingId,
    image,
    focus,
    tone = "dark",
    veil = SALA_STAGE_VEIL,
    fuse,
    preset = SALA_TITLE_PRESET.sala,
    className,
    style,
    children,
    ...props
  },
  ref
) {
  const Heading = `h${headingLevel}` as "h1";
  const c = SALA_TITLE_CSS;
  const plan = planSalaTitle(title, preset);
  const otro = original && original.text.trim() !== "" && original.text.trim() !== title.trim() ? original : null;
  const escrituras = salaScripts({ text: title, lang: titleLang }, otro);
  const conImagen = image !== undefined && image !== null && image !== false;

  // El fundido, por composición. Solo con imagen, figura y unas medidas que cumplen.
  const figura = conImagen && fuse?.figure ? fuse.figure : null;
  const estrecho = figura ? resolveSalaFuse(fuse?.narrow, title, fuse?.ratio?.narrow) : null;
  const ancho = figura ? resolveSalaFuse(fuse?.wide, title, fuse?.ratio?.wide) : null;
  const fundido = [estrecho ? "n" : "", ancho ? "w" : ""].filter(Boolean).join(" ");

  const vars = {
    ...salaTitleVars(plan),
    [c.vars.veil]: Math.min(1, Math.max(0, Number.isFinite(veil) ? veil : SALA_STAGE_VEIL)),
    ...(focus ? { [c.vars.focus]: focus } : {}),
    ...(figura && estrecho ? { [c.vars.fuseNarrow]: salaFuseBackground(estrecho, figura, focus) } : {}),
    ...(figura && ancho ? { [c.vars.fuseWide]: salaFuseBackground(ancho, figura, focus) } : {}),
  } as React.CSSProperties;

  return (
    <div
      ref={ref}
      data-sala-stage={conImagen ? "image" : "empty"}
      data-theme={tone}
      data-sala-fuse={fundido || undefined}
      className={cn(
        c.stage,
        "bg-sala-band",
        conImagen ? "text-sala-ink" : "text-sala-band-ink",
        // Con colores forzados el campo de color desaparece: que quede el contorno de la sala.
        "forced-colors:[outline:1px_solid_CanvasText] forced-colors:[outline-offset:-1px]",
        className
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      {conImagen ? <div className={c.stageImage}>{image}</div> : null}
      {conImagen ? <div aria-hidden="true" className={c.stageVeil} /> : null}
      {figura && fundido ? (
        // La figura es un recorte de la misma imagen, ya servido: no pasa por el optimizador.
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden="true" alt="" src={figura} className={c.stageFigure} decoding="async" />
      ) : null}
      <Heading id={headingId} lang={titleLang} className={c.stageHeading}>
        <SalaTitleText title={title} plan={plan} />
      </Heading>
      {otro || children ? (
        <div className={c.stageBelow}>
          {otro ? (
            <p lang={otro.lang} className={cn(c.original, "mt-0")}>
              {otro.text}
            </p>
          ) : null}
          {children}
        </div>
      ) : null}
      {escrituras.length > 0 ? <SalaScriptFonts scripts={escrituras} /> : null}
    </div>
  );
});
