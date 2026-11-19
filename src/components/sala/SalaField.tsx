"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";

/**
 * La pieza común de los campos de «Sala» (fase 8.4): etiqueta, ayuda, error y
 * contador alrededor de un control, con sus asociaciones ya hechas. La usan
 * `SalaInput`, `SalaTextarea` y `SalaSelect`, y sirve para cualquier control
 * propio de la 8.5 (una nota, un progreso):
 *
 * ```tsx
 * <SalaField label="Nota" hint="Del 1 al 10" error={error}>
 *   {(control) => <input type="range" {...control} />}
 * </SalaField>
 * ```
 *
 * Ningún texto sale de aquí: todos llegan por props, ya traducidos.
 *
 * - **Etiqueta** siempre a la vista, encima (`<label for>`). Un placeholder no
 *   es una etiqueta.
 * - **Obligatorio u opcional** se dice con una palabra junto a la etiqueta
 *   (`requirement`), no con un asterisco ni con color. Si el control es
 *   `required` la palabra es solo para la vista (el lector ya lo oye del
 *   propio control); si no, entra en la descripción del control.
 * - **Ayuda** entre la etiqueta y el control: se lee antes de escribir y el
 *   teclado del móvil no la tapa.
 * - **Error** debajo, con icono y texto (nunca solo el color del borde). El
 *   control lleva `aria-invalid` y el error entra en su `aria-describedby`,
 *   el primero. No se usa `aria-errormessage`: su soporte es desigual y, junto
 *   con la descripción, hay lectores que leen el error dos veces.
 * - **El error se anuncia una vez, y siempre.** Lo dice una región viva del
 *   campo, con la etiqueta delante («Nombre: Ponle un nombre»), salvo en dos
 *   casos: cuando el foco acaba de llegar al control (el lector ya lo lee
 *   como descripción) y cuando habla el formulario (`SalaForm`, al enviar).
 *   Si el foco ya estaba dentro —enviar con Enter, validar mientras se
 *   escribe, un interruptor que no se ha podido guardar—, se anuncia: una
 *   descripción que cambia con el foco puesto no se lee sola (WCAG 4.1.3).
 */
export interface SalaFieldTexts {
  /** La etiqueta, siempre a la vista. */
  label: React.ReactNode;
  /** «obligatorio» u «opcional», ya traducido. Va junto a la etiqueta. */
  requirement?: string;
  /** Ayuda para rellenarlo: formato, para qué se usa. */
  hint?: React.ReactNode;
  /** Qué ha fallado y cómo arreglarlo. Con él, el control queda como no válido. */
  error?: string;
}

/** Lo que el control tiene que llevar puesto. */
export interface SalaFieldControl {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

/** Contador ya calculado: su texto («12 de 60») y si ha llegado al tope. */
export interface SalaFieldCount {
  text: string;
  full: boolean;
}

interface Opciones {
  id?: string;
  hint?: React.ReactNode;
  error?: string;
  requirement?: string;
  required?: boolean;
  /** `aria-describedby` que ya traía el control: se conserva, delante. */
  describedBy?: string;
  count?: SalaFieldCount;
}

/**
 * El foco «acaba de llegar» si entró en el control y desde entonces no se ha
 * tocado nada en él. Este tope solo cubre un caso raro: el foco lleva un rato
 * quieto en el control y el error llega solo (una respuesta del servidor). Si
 * se queda corto, el error se oye dos veces; si se quitara, no se oiría.
 */
const RECIEN_LLEGADO = 1000;
/**
 * El anuncio se retira cuando el foco entra en el control o sale de él (ahí el
 * error ya se lee en su sitio y, si se quedara, se oiría dos veces). Este plazo
 * es solo la red para quien no mueve el foco: es largo a propósito, porque un
 * anuncio «polite» que desaparece antes de que el lector llegue a él se pierde.
 */
const RETIRADA_ANUNCIO = 10_000;

/**
 * Dentro de un `SalaForm`: mientras el formulario da cuenta de un envío, los
 * campos callan y habla él (cuántos campos hay que corregir, una sola vez).
 */
export const SalaFormContext = React.createContext<{ silent: React.RefObject<boolean> } | null>(null);

/** El texto que oye un lector: sin lo que lleva `aria-hidden` (el dibujo, «obligatorio»). */
function textoLeido(nodo: Node): string {
  if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent ?? "";
  if (!(nodo instanceof Element) || nodo.getAttribute("aria-hidden") === "true") return "";
  return Array.from(nodo.childNodes, textoLeido).join("");
}

/**
 * Lo que se anuncia de un campo con error: su etiqueta y el error («Nombre:
 * Ponle un nombre»). Un error suelto no dice de qué campo es. La etiqueta se
 * lee del `<label>` del control o, en un grupo, de su `<legend>`; el error, si
 * no se pasa, del que el campo tiene pintado.
 */
export function salaFieldAnnouncement(control: HTMLElement | null, error?: string): string {
  if (!control) return error ?? "";
  const dicho = error ?? document.getElementById(`${control.id}-error`)?.textContent ?? "";
  const fuente = (control as HTMLInputElement).labels?.[0] ?? control.querySelector("legend");
  const etiqueta = fuente ? textoLeido(fuente).replace(/\s+/g, " ").trim() : "";
  return etiqueta ? `${etiqueta}: ${dicho}` : dicho;
}

/**
 * Ids y asociaciones de un campo. Para quien monta su propia composición (la
 * casilla, el grupo de radios); lo normal es usar `SalaField`.
 */
export function useSalaField({ id, hint, error, requirement, required, describedBy, count }: Opciones) {
  const auto = React.useId();
  const controlId = id ?? `sala-${auto}`;
  const ids = {
    label: `${controlId}-label`,
    hint: `${controlId}-hint`,
    error: `${controlId}-error`,
    requirement: `${controlId}-req`,
    count: `${controlId}-count`,
  };
  const invalid = Boolean(error);

  const descripcion =
    [
      describedBy,
      invalid ? ids.error : undefined,
      hint ? ids.hint : undefined,
      requirement && !required ? ids.requirement : undefined,
      count ? ids.count : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const form = React.useContext(SalaFormContext);
  const [anuncio, setAnuncio] = React.useState("");
  /** Cuándo entró el foco en el control, si después no se ha tocado nada en él; si no, 0. */
  const llegada = React.useRef(0);

  // El orden de lo que pasa, no un reloj: el foco entra (y el lector lee la
  // descripción), y cualquier tecla, clic o cambio dentro del control quiere
  // decir que ya estaba. Al entrar o salir el foco, el anuncio se retira.
  React.useEffect(() => {
    const control = document.getElementById(controlId);
    if (!control) return;
    // Dentro de un grupo de radios, pasar de uno a otro no es entrar ni salir.
    const deDentro = (event: FocusEvent) => event.relatedTarget instanceof Node && control.contains(event.relatedTarget);
    const entra = (event: FocusEvent) => {
      if (deDentro(event)) return;
      llegada.current = Date.now();
      setAnuncio("");
    };
    const sale = (event: FocusEvent) => {
      if (deDentro(event)) return;
      llegada.current = 0;
      setAnuncio("");
    };
    const toca = () => {
      llegada.current = 0;
    };
    const toques = ["keydown", "input", "change", "click"] as const;
    control.addEventListener("focusin", entra);
    control.addEventListener("focusout", sale);
    for (const toque of toques) control.addEventListener(toque, toca);
    return () => {
      control.removeEventListener("focusin", entra);
      control.removeEventListener("focusout", sale);
      for (const toque of toques) control.removeEventListener(toque, toca);
    };
  }, [controlId]);

  // Se anuncia el error que cambia después de pintar el campo; el que ya venía
  // pintado, no.
  const previo = React.useRef(error);
  React.useEffect(() => {
    if (previo.current === error) return;
    previo.current = error;
    const recien = llegada.current > 0 && Date.now() - llegada.current < RECIEN_LLEGADO;
    llegada.current = 0;
    const control = document.getElementById(controlId);
    const dentro = Boolean(control && control.contains(document.activeElement));
    // Calla si no hay error, si habla el formulario o si el foco acaba de
    // llegar (enviar y saltar al primer error): ahí el lector lo lee como
    // descripción del control.
    if (!error || form?.silent.current || (dentro && recien)) {
      setAnuncio("");
      return;
    }
    setAnuncio(salaFieldAnnouncement(control, error));
    const callar = window.setTimeout(() => setAnuncio(""), RETIRADA_ANUNCIO);
    return () => window.clearTimeout(callar);
  }, [error, controlId, form]);

  const control: SalaFieldControl = {
    id: controlId,
    "aria-describedby": descripcion,
    "aria-invalid": invalid || undefined,
  };

  return { control, ids, invalid, anuncio };
}

const PARTIR = "min-w-0 [overflow-wrap:anywhere]";

/** «obligatorio» u «opcional», junto a la etiqueta. */
export function SalaFieldRequirement({ id, required, children }: { id: string; required?: boolean; children: string }) {
  return (
    <span id={id} aria-hidden={required || undefined} className={cn("text-sala-ink-secondary sala-type-small", PARTIR)}>
      {children}
    </span>
  );
}

export function SalaFieldHint({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <p id={id} className={cn("text-sala-ink-secondary sala-type-small", PARTIR, className)}>
      {children}
    </p>
  );
}

/** El error: icono y texto. El icono es adorno; lo que cuenta lo dice el texto. */
export function SalaFieldError({ id, className, children }: { id: string; className?: string; children: string }) {
  return (
    <p id={id} className={cn("flex items-start gap-2 text-sala-danger sala-type-small", PARTIR, className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        // Un SVG no cambia de color solo con colores forzados: se le da el del sistema.
        className="mt-px h-4 w-4 shrink-0 forced-colors:text-[color:CanvasText]"
      >
        <path d="M2 2h12v12H2zM8 5v4M8 11.25v.5" />
      </svg>
      <span className={PARTIR}>{children}</span>
    </p>
  );
}

/** La región viva del error. Tiene que existir desde antes de que haya error. */
export function SalaFieldAnnouncer({ children }: { children: string }) {
  return (
    <span aria-live="polite" aria-atomic="true" data-sala-announcer="" className="sr-only">
      {children}
    </span>
  );
}

export interface SalaFieldProps extends SalaFieldTexts {
  /** Id del control. Si no llega, se genera. */
  id?: string;
  /** El control es obligatorio (`required`): decide cómo se lee `requirement`. */
  required?: boolean;
  describedBy?: string;
  count?: SalaFieldCount;
  className?: string;
  children: (control: SalaFieldControl) => React.ReactNode;
}

export function SalaField({ label, requirement, hint, error, id, required, describedBy, count, className, children }: SalaFieldProps) {
  const { control, ids, anuncio } = useSalaField({ id, hint, error, requirement, required, describedBy, count });

  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <label htmlFor={control.id} className={cn("text-sala-ink sala-type-label", PARTIR)}>
          {label}
        </label>
        {requirement ? (
          <SalaFieldRequirement id={ids.requirement} required={required}>
            {requirement}
          </SalaFieldRequirement>
        ) : null}
      </div>
      {hint ? <SalaFieldHint id={ids.hint}>{hint}</SalaFieldHint> : null}
      {children(control)}
      {error || count ? (
        // En un campo estrecho el contador baja a su línea antes que estrujar el error.
        <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1">
          {error ? (
            <SalaFieldError id={ids.error} className="flex-1 basis-48">
              {error}
            </SalaFieldError>
          ) : null}
          {count ? <SalaFieldCounter id={ids.count} count={count} /> : null}
        </div>
      ) : null}
      <SalaFieldAnnouncer>{anuncio}</SalaFieldAnnouncer>
    </div>
  );
}

/**
 * El contador. Entra en la descripción del control (se lee al llegar a él, no
 * a cada tecla) y, al tocar el tope, se anuncia una vez. El tope no se dice
 * solo con color: el texto pasa a tinta y a negrita.
 */
function SalaFieldCounter({ id, count }: { id: string; count: SalaFieldCount }) {
  return (
    <>
      <p
        id={id}
        data-full={count.full || undefined}
        className={cn(
          "ml-auto shrink-0 tabular-nums sala-type-small",
          count.full ? "font-bold text-sala-ink" : "text-sala-ink-secondary"
        )}
      >
        {count.text}
      </p>
      <span aria-live="polite" className="sr-only">
        {count.full ? count.text : ""}
      </span>
    </>
  );
}

// ------------------------------------------------------------
// Cuánto hay escrito (para el contador)
// ------------------------------------------------------------

type ConTexto = HTMLInputElement | HTMLTextAreaElement;

/**
 * Longitud de lo escrito, lo lleve quien usa el campo (`value`) o el
 * navegador. `watch` es la `ref` del control: une la de fuera y, si el campo
 * está en un formulario, vuelve a contar cuando el formulario se vacía
 * (`reset`), que no avisa con `change`.
 */
export function useSalaLength<T extends ConTexto>(value: unknown, defaultValue: unknown, ref: React.ForwardedRef<T>) {
  const [own, setOwn] = React.useState(() => String(defaultValue ?? "").length);
  const watch = React.useCallback(
    (el: T | null) => {
      const fuera = (valor: T | null) => {
        if (typeof ref === "function") ref(valor);
        else if (ref) ref.current = valor;
      };
      fuera(el);
      if (!el) return;
      const form = el.form;
      // El navegador repone el valor inicial después del evento.
      const recontar = () => window.setTimeout(() => setOwn(el.value.length));
      form?.addEventListener("reset", recontar);
      return () => {
        form?.removeEventListener("reset", recontar);
        fuera(null);
      };
    },
    [ref]
  );
  return { length: value === undefined ? own : String(value).length, setOwn, watch };
}

// ------------------------------------------------------------
// La caja de un control de texto (campo, área y desplegable)
// ------------------------------------------------------------

/**
 * Biblia §1 y §9: esquinas rectas, color plano, sin sombras, 48 px de alto.
 * La letra es de 17 px: con menos de 16, Safari de iOS amplía la página al
 * enfocar. El borde en reposo es `sala-border` (3:1 o más contra fondo y
 * panel, en cualquier paleta: lo barre `sala-tokens.test.ts`).
 *
 * El autorrelleno del navegador pinta su propio fondo y su propio color de
 * letra: aquí se le devuelve la tinta, sobre el panel. Esa «sombra» hacia
 * dentro es la única forma de tapar el fondo del navegador; no es una sombra
 * de diseño.
 */
export const SALA_CONTROL = [
  "block min-h-sala-target w-full min-w-0 appearance-none rounded-none border-2 bg-transparent px-3 py-2",
  "text-sala-ink sala-type-text",
  "placeholder:text-sala-ink-secondary placeholder:opacity-100",
  "caret-sala-ink selection:bg-sala-ink selection:text-sala-background",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:sala-focus",
  "autofill:[-webkit-text-fill-color:var(--sala-ink)] autofill:[box-shadow:inset_0_0_0_100vmax_var(--sala-panel)] autofill:[caret-color:var(--sala-ink)]",
];

export type SalaControlState = "rest" | "error" | "readOnly" | "disabled";

/**
 * - Reposo: borde gris; tinta al pasar el puntero y con el foco.
 * - Error: borde del color de error (y debajo, el icono y el texto).
 * - Solo lectura: una raya debajo y nada a los lados. Se distingue por la
 *   forma, no por el color: es un dato, no una caja donde escribir.
 * - Deshabilitado: borde discontinuo y gris, como el botón.
 */
export const SALA_CONTROL_STATE: Record<SalaControlState, string> = {
  rest: "border-sala-border sala-hover:border-sala-ink sala-focused:border-sala-ink",
  error: "border-sala-danger",
  // Sin borde arriba ni a los lados (con colores forzados, uno transparente se
  // pintaría); el relleno de arriba repone sus 2 px para que el texto no se mueva.
  readOnly: "border-x-0 border-t-0 border-b-sala-border px-0 pt-[calc(0.5rem+2px)]",
  disabled:
    "cursor-not-allowed border-dashed border-sala-border text-sala-ink-disabled opacity-100 placeholder:text-sala-ink-disabled",
};

export function salaControlState({
  disabled,
  readOnly,
  invalid,
}: {
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
}): SalaControlState {
  if (disabled) return "disabled";
  if (readOnly) return "readOnly";
  return invalid ? "error" : "rest";
}
