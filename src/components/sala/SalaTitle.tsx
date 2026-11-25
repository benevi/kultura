import * as React from "react";
import { planSalaTitle, SALA_TITLE_PRESET, salaScripts, type SalaTitlePlan, type SalaTitlePreset } from "@/lib/design/sala-title";
import { SALA_TYPE } from "@/lib/design/sala-tokens";

const SALA_TITLE_LINE_HEIGHT = parseFloat(SALA_TYPE.title.lineHeight);
import { SALA_TITLE_CSS } from "@/lib/design/sala-title-css";
import { cn } from "@/lib/utils/index";
import { SalaScriptFonts } from "./SalaScriptFonts";

/**
 * El rótulo de «Sala» (fase 8.4): el título de una obra en Anybody, a la
 * anchura que le toca por su longitud y al mayor cuerpo que cabe en su caja,
 * en una, dos o tres líneas (biblia §3 y §5).
 *
 * - **Todo sale del servidor.** Por dónde se parte, la anchura (eje `wdth`,
 *   50–150 %) y el tamaño se deciden con el texto (`planSalaTitle`): el
 *   servidor sabe lo que mide cada carácter de Anybody. El tamaño va en
 *   unidades del contenedor, así que vale para cualquier ancho sin medir nada
 *   en el navegador; entre la composición estrecha y la ancha elige el CSS
 *   (`src/styles/sala/title.css`, que hay que cargar junto a `tokens.css` y
 *   `fonts.css`). Sin `"use client"`.
 * - **Al llegar la fuente o al hidratar, la caja no cambia.** Las líneas
 *   están decididas antes de pintar y la fuente de respaldo va ajustada para
 *   no medir nunca más que Anybody: mismas líneas y mismo alto. Las palabras
 *   sí se recolocan dentro de su línea, porque el respaldo es más estrecho.
 * - **Texto de verdad, una sola vez.** Un encabezado con el título entero,
 *   que se selecciona, se traduce y se lee una vez. Los saltos de línea son
 *   `<br>`: el lector de pantalla no los nombra.
 * - **Idiomas.** `titleLang` si el título no está en el idioma de la página.
 *   `original` es el título en su escritura, debajo y marcado con su idioma
 *   (biblia §3): con eso sale con su fuente (Noto Sans JP o KR), que se carga
 *   solo entonces. De derecha a izquierda (árabe, hebreo) no está cubierto.
 *
 * `className` y las props nativas van a la caja (el contenedor del que sale
 * el tamaño); `ref`, al encabezado.
 */
export interface SalaTitleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** El título, en el idioma de la persona. */
  title: string;
  /** Idioma del título si no es el de la página. */
  titleLang?: string;
  /** El título original, en su escritura, con su idioma. Si es igual que `title`, no se repite. */
  original?: { text: string; lang: string } | null;
  /** Nivel del encabezado. En la ficha, `1`. `"none"` lo deja en un párrafo. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 | "none";
  /** `id` del encabezado, para nombrar con él una región. */
  headingId?: string;
  /** Reglas de composición. Por defecto, las de la ficha. */
  preset?: SalaTitlePreset;
}

export const SalaTitle = React.forwardRef<HTMLElement, SalaTitleProps>(function SalaTitle(
  { title, titleLang, original, headingLevel = 1, headingId, preset, className, ...props },
  ref
) {
  const Heading = (headingLevel === "none" ? "p" : `h${headingLevel}`) as "h1";
  const otro = original && original.text.trim() !== "" && original.text.trim() !== title.trim() ? original : null;
  const escrituras = salaScripts({ text: title, lang: titleLang }, otro);
  return (
    <div data-sala-title="" className={cn(SALA_TITLE_CSS.box, className)} {...props}>
      <Heading ref={ref as React.Ref<HTMLHeadingElement>} id={headingId} lang={titleLang} className="m-0">
        <SalaTitleText title={title} preset={preset} />
      </Heading>
      {otro ? (
        <p lang={otro.lang} className={SALA_TITLE_CSS.original}>
          {otro.text}
        </p>
      ) : null}
      {escrituras.length > 0 ? <SalaScriptFonts scripts={escrituras} /> : null}
    </div>
  );
});

/** Variables CSS de una composición: las lee `title.css`. */
export function salaTitleVars(plan: SalaTitlePlan): React.CSSProperties {
  const v = SALA_TITLE_CSS.vars;
  return {
    [v.narrowSize]: plan.narrow.size,
    [v.narrowStretch]: `${plan.narrow.stretch}%`,
    [v.narrowBlock]: Number(plan.narrow.block.toFixed(2)),
    [v.wideSize]: plan.wide.size,
    [v.wideStretch]: `${plan.wide.stretch}%`,
    [v.wideBlock]: Number(plan.wide.block.toFixed(2)),
  } as React.CSSProperties;
}

export interface SalaTitleTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "title" | "children"> {
  title: string;
  preset?: SalaTitlePreset;
  /** Una composición ya calculada (quien la necesita también para otra cosa). */
  plan?: SalaTitlePlan;
}

/**
 * El texto del rótulo, ya compuesto: el título con sus saltos de línea (los
 * de la caja estrecha, los de la ancha o los de las dos) y las variables de
 * tamaño y anchura. Va dentro de un encabezado y de un contenedor
 * (`container-type: inline-size`): de su ancho sale el tamaño. Lo usan
 * `SalaTitle`, `SalaStage` y el sustituto de `SalaPoster`.
 */
export function SalaTitleText({ title, preset = SALA_TITLE_PRESET.sala, plan, className, style, ...props }: SalaTitleTextProps) {
  const compuesto = plan ?? planSalaTitle(title, preset);
  const estrecha = new Set(compuesto.narrow.starts);
  const ancha = new Set(compuesto.wide.starts);
  // Un salto sin espacio (japonés, coreano, o una palabra partida): el `<br>` mete un espacio en el
  // nombre accesible («転生したら スライムだった件»). Entonces el rótulo se ve y no se lee, y el
  // título va tal cual en texto oculto, que no se selecciona (al copiar sale una vez).
  const sinEspacio = compuesto.chunks.some((_, i) => i > 0 && (estrecha.has(i) || ancha.has(i)) && compuesto.joins[i] === "");
  const rotulo = (
    <span
      data-sala-title-text=""
      data-lines={`${compuesto.narrow.starts.length} ${compuesto.wide.starts.length}`}
      className={cn(SALA_TITLE_CSS.text, "sala-type-title", className)}
      style={{ ...salaTitleVars(compuesto), ...(compuesto.lineHeight === SALA_TITLE_LINE_HEIGHT ? null : { lineHeight: compuesto.lineHeight }), ...style }}
      {...props}
      aria-hidden={sinEspacio ? true : props["aria-hidden"]}
    >
      {compuesto.chunks.map((trozo, i) => {
        if (i === 0) return trozo;
        const n = estrecha.has(i);
        const w = ancha.has(i);
        return (
          <React.Fragment key={i}>
            {/* El espacio va detrás del salto y en el mismo texto que la palabra: un espacio
                suelto junto a un <br> oculto, Chromium lo quita del nombre accesible
                («Learnedto»). Al principio de una línea visible se pliega solo. */}
            {n || w ? <br data-n={n ? "" : undefined} data-w={w ? "" : undefined} /> : null}
            {compuesto.joins[i] + trozo}
          </React.Fragment>
        );
      })}
    </span>
  );
  if (!sinEspacio) return rotulo;
  return (
    <>
      <span data-sala-title-name="" lang={props.lang} className="sr-only select-none">
        {title}
      </span>
      {rotulo}
    </>
  );
}
