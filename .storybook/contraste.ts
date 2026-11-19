import axe from "axe-core";

/**
 * Que un contraste sin medir no pase en silencio.
 *
 * El addon de accesibilidad solo hace fallar una historia por las
 * «violations» de axe. Lo que axe deja en «incomplete» (no pudo decidir) pasa,
 * y así pasó un texto a 3,04:1: axe no supo leer un color (`oklch(L C none)`),
 * no midió ningún texto de la página y la historia salió en verde. El addon
 * no tiene opción para esto (Storybook 10.6), así que esta pieza se engancha
 * una sola vez, en `afterEach` de `.storybook/preview.tsx`, y vale para todas
 * las historias.
 *
 * La regla:
 *
 * 1. **axe no pudo leer un color, o la regla dio error** (`colorParse`,
 *    `error-occurred` o un motivo que no conocemos): falla siempre. No es una
 *    duda de accesibilidad, es que la medida no se hizo. Se arregla el color o
 *    la herramienta, no se declara.
 * 2. **axe leyó los colores pero no puede calcular el contraste** (texto sobre
 *    imagen o degradado, pseudoelementos, elementos solapados… la lista está
 *    en `MOTIVOS_REVISABLES`): falla, salvo que la historia diga que ese
 *    contraste se ha medido a mano y cómo:
 *
 *    ```ts
 *    parameters: { contraste: { revisado: { bgImage: "Texto sobre la portada con velo: 7,3:1 en el píxel más claro" } } }
 *    ```
 *
 *    Un motivo declarado que ya no aparece también falla: una excepción que
 *    sobra taparía la siguiente.
 *
 * No se ejecuta si la historia apaga axe (`a11y.test: "off"`, `a11y.disable`)
 * o la regla `color-contrast`. Las violaciones las sigue juzgando el addon.
 */

/** Motivos por los que axe mide los colores y aun así no puede dar una cifra. */
export const MOTIVOS_REVISABLES = {
  bgImage: "el fondo es una imagen",
  bgGradient: "el fondo es un degradado",
  imgNode: "el elemento es una imagen",
  bgOverlap: "otro elemento tapa el fondo",
  fgAlpha: "el texto es translúcido",
  elmPartiallyObscured: "otro elemento tapa parte del texto",
  elmPartiallyObscuring: "el elemento tapa parte de otro",
  outsideViewport: "el texto queda fuera de la ventana",
  equalRatio: "texto y fondo tienen el mismo color (1:1)",
  shortTextContent: "el texto es demasiado corto para saber si es texto",
  nonBmp: "el texto son caracteres fuera del plano básico (iconos, emojis)",
  pseudoContent: "hay un pseudoelemento con fondo",
} as const;

export type MotivoRevisable = keyof typeof MOTIVOS_REVISABLES;

/** `parameters.contraste` de una historia. */
export interface ContrasteParametros {
  /** Motivo de axe → cómo se ha medido a mano ese contraste. */
  revisado?: Partial<Record<MotivoRevisable, string>>;
}

interface A11yParametros {
  disable?: boolean;
  test?: string;
  config?: { rules?: Array<{ id?: string; enabled?: boolean }> };
  options?: { rules?: Record<string, { enabled?: boolean }> };
}

interface Contexto {
  id: string;
  viewMode?: string;
  parameters: { a11y?: A11yParametros; contraste?: ContrasteParametros };
}

const REGLA = "color-contrast";
// Lo mismo que mira el addon: la página menos las piezas del propio Storybook.
const DONDE = { include: document.body, exclude: [".sb-wrapper", "#storybook-docs", "#storybook-highlights-root"] };

/**
 * Solo en las pruebas (modo navegador de Vitest; la misma señal que usa
 * Storybook): en el panel de Storybook axe ya lo lanza el addon y no admite
 * dos pasadas a la vez.
 */
function enPruebas(): boolean {
  return Boolean((globalThis as { __vitest_browser__?: boolean }).__vitest_browser__);
}

function apagado(a11y: A11yParametros = {}): boolean {
  return (
    a11y.disable === true ||
    a11y.test === "off" ||
    a11y.options?.rules?.[REGLA]?.enabled === false ||
    (a11y.config?.rules ?? []).some((rule) => rule.id === REGLA && rule.enabled === false)
  );
}

const esRevisable = (motivo: string): motivo is MotivoRevisable => motivo in MOTIVOS_REVISABLES;

/** Por qué axe dejó un nodo sin medir: su `messageKey`, o `error` si la regla falló. */
function motivoDe(node: axe.NodeResult, reglaConError: boolean): string {
  const checks = [...node.any, ...node.all, ...node.none];
  if (reglaConError || checks.some((check) => check.id === "error-occurred")) return "error";
  const propio = checks.find((check) => check.id === REGLA) ?? checks[0];
  return (propio?.data as { messageKey?: string } | null | undefined)?.messageKey ?? "desconocido";
}

export async function contrasteMedido({ id, viewMode, parameters }: Contexto): Promise<void> {
  if (!enPruebas() || viewMode === "docs" || apagado(parameters.a11y)) return;

  axe.reset();
  const { incomplete } = await axe.run(DONDE, { runOnly: { type: "rule", values: [REGLA] } });
  axe.reset();

  const revisado = parameters.contraste?.revisado ?? {};
  const vistos = new Set<string>();
  const sinMedir: string[] = [];
  const sinRevisar: string[] = [];

  for (const regla of incomplete) {
    const error = (regla as { error?: { message?: string } }).error;
    for (const node of regla.nodes) {
      const motivo = motivoDe(node, Boolean(error));
      vistos.add(motivo);
      const detalle = error?.message ?? [...node.any, ...node.all, ...node.none][0]?.message ?? "";
      const linea = `  - [${motivo}] ${node.html.replace(/\s+/g, " ").slice(0, 140)}\n      ${detalle}`;
      if (!esRevisable(motivo)) sinMedir.push(linea);
      else if (!revisado[motivo]?.trim()) sinRevisar.push(`${linea}\n      (${MOTIVOS_REVISABLES[motivo]})`);
    }
  }
  const sobran = Object.keys(revisado).filter((motivo) => !vistos.has(motivo));

  const partes: string[] = [];
  if (sinMedir.length) {
    partes.push(
      `axe no pudo medir el contraste de ${sinMedir.length} nodo(s): no supo leer un color o la regla dio error. ` +
        `Esto no se declara: se arregla el color (¿una clase que mezcla fuera de sRGB?).\n${resumen(sinMedir)}`
    );
  }
  if (sinRevisar.length) {
    partes.push(
      `axe no puede calcular el contraste de ${sinRevisar.length} nodo(s). Mídelo a mano y decláralo en la historia: ` +
        `parameters.contraste.revisado = { <motivo>: "cómo se ha medido" }.\n${resumen(sinRevisar)}`
    );
  }
  if (sobran.length) {
    partes.push(`parameters.contraste.revisado declara motivos que ya no aparecen: ${sobran.join(", ")}. Quítalos.`);
  }
  if (partes.length) throw new Error(`Contraste sin medir en «${id}» (axe, ${REGLA}).\n\n${partes.join("\n\n")}`);
}

function resumen(lineas: string[], max = 8): string {
  const resto = lineas.length - max;
  return lineas.slice(0, max).join("\n") + (resto > 0 ? `\n  … y ${resto} más` : "");
}
