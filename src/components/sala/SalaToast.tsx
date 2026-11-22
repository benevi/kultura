"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/index";
import { SalaCloseIcon, SalaStatusIcon } from "./SalaStatusIcon";

/**
 * Aviso efímero de «Sala» (fase 8.4): el resultado de una acción, que flota un
 * momento y se va. Convive con `ToastProvider`, y su API es la misma
 * (`show`, `showError`, `dismiss`) para que el cambio de la 8.5 sea mecánico:
 * `useToastContext()` pasa a ser `useSalaToast()`.
 *
 * ```tsx
 * <SalaToastProvider labels={{ region: t("toasts.region"), dismiss: t("toasts.dismiss") }}>…</SalaToastProvider>
 *
 * const toast = useSalaToast();
 * toast.show({ message: t("saved"), type: "success" });
 * toast.show({ message: t("removed"), action: { label: t("undo"), onAction, onExpire } });
 * toast.showError(t("errorSaving"));
 * ```
 *
 * - **Cola.** Tres a la vez como mucho; el cuarto desplaza al más viejo que no
 *   sea fijo (que «caduca»: se llama a su `onExpire`). Un aviso fijo
 *   (`duration: Infinity`, un error `persistent`) solo sale si los tres lo son.
 * - **Cada aviso se resuelve una vez:** o se pulsa su acción (`onAction`) o
 *   caduca (`onExpire`), nunca las dos cosas ni dos veces la misma, aunque se
 *   pulse dos veces o lo desplace otro mientras se está yendo.
 * - **Regiones vivas montadas desde el principio** y vacías: una `assertive`
 *   para los errores y un `status` para lo demás. Un lector avisa de lo que
 *   cambia, no de lo que nace con texto.
 * - **Tiempo** (WCAG 2.2.1). 5 s; 8 s un error o un aviso con acción, y nunca
 *   menos de 6 s un error; los textos largos, más (hasta 15 s). El reloj de
 *   todos se para con el puntero encima, con el foco dentro y con la pestaña
 *   en segundo plano. `duration: Infinity` (o `showError(…, { persistent })`)
 *   lo deja hasta que se cierre.
 * - **No roba el foco.** Aparece y el foco sigue donde estaba. Con el teclado
 *   se llega con **F8**: lleva el foco a la acción del aviso más reciente (a
 *   su botón de cerrar si no tiene acción) y para el reloj. Un aviso con
 *   acción dice la tecla al lector (`labels.hint`). Escape lo cierra y
 *   devuelve el foco a donde estaba. Si se cierra con el
 *   foco dentro, el foco pasa al siguiente aviso o vuelve a su sitio: nunca se
 *   pierde. `action.autoFocus` lo lleva a la acción al aparecer, para cuando el
 *   control que la provocó ya no existe (tras cerrar un diálogo).
 * - **No tapa lo que tiene el foco** (WCAG 2.4.11). Va abajo, por encima de la
 *   barra inferior de la app (`--bottom-nav-clear`, que pone quien la pinta) y
 *   de la zona segura; si el control con el foco queda debajo de la pila, la
 *   pila se pasa arriba. Solo los avisos reciben clics: el hueco entre ellos y
 *   a sus lados deja pasar el puntero.
 * - **Cómo se ve.** Un bloque de tinta (el color del texto, con el del fondo
 *   encima): se separa de la página sin sombra. El error, un bloque de
 *   `sala-danger`. Cada tipo lleva su dibujo: el tono no es solo color.
 *   Los avisos son de la app, no de una obra: van siempre con los neutros.
 * - **Movimiento.** Entra subiendo 12 px en 150 ms y se va fundiéndose; con
 *   movimiento reducido, ni lo uno ni lo otro. En táctil se descarta también
 *   deslizándolo a un lado; el botón de cerrar hace lo mismo sin arrastrar.
 * - **Con un diálogo abierto** siguen viéndose (van por encima) y oyéndose
 *   (el diálogo no esconde las regiones vivas). Pero el foco está atrapado en
 *   el diálogo: ni F8 ni Tab llegan al aviso. Por eso **un aviso con acción
 *   no corre mientras haya un diálogo modal abierto**: se queda hasta que se
 *   cierre, y entonces sigue su reloj y F8 llega a él. En desarrollo se avisa
 *   por consola. El error de una acción del diálogo va dentro de él
 *   (`SalaDialog`, prop `error`), no aquí.
 */
export type SalaToastType = "success" | "error" | "info";

export interface SalaToastAction {
  label: string;
  onAction: () => void;
  /** El aviso se va sin pulsar la acción (tiempo, cierre, deslizar o desplazado por otros). Una vez. */
  onExpire?: () => void;
  /** Lleva el foco a la acción al aparecer. */
  autoFocus?: boolean;
  /**
   * A dónde va el foco tras pulsar la acción, si la acción lo cambia de sitio
   * (p. ej. «Deshacer» vuelve a pintar «Actualizar»). Se pide al quitar el
   * aviso, cuando ya está pintado; si no da nada, lo de siempre (el aviso
   * siguiente o donde estaba antes).
   */
  focusAfter?: () => HTMLElement | null;
}

export interface SalaToastItem {
  id: string;
  message: string;
  type: SalaToastType;
  /** Milisegundos en pantalla. `Infinity`: hasta que se cierre. */
  duration?: number;
  action?: SalaToastAction;
}

export interface SalaToastApi {
  show: (payload: { message: string; type?: SalaToastType; duration?: number; action?: SalaToastAction }) => void;
  showError: (message: string, options?: { persistent?: boolean; duration?: number }) => void;
  dismiss: (id: string) => void;
}

export interface SalaToastLabels {
  /** Nombre de la zona de avisos; conviene que diga la tecla: «Avisos (F8)». */
  region: string;
  /** Nombre del botón que cierra un aviso. */
  dismiss: string;
  /** Lo que oye el lector en un aviso con acción: «Pulsa F8 para ir al aviso». */
  hint?: string;
}

export const SALA_TOAST_MAX = 3;
export const SALA_TOAST_MS = 5000;
/** Un error o un aviso con acción: tiempo para leerlo y decidir. */
export const SALA_TOAST_LONG_MS = 8000;
export const SALA_TOAST_ERROR_MIN_MS = 6000;
export const SALA_TOAST_MAX_MS = 15000;
/** A partir de aquí, cada carácter suma tiempo de lectura. */
const LARGO_BASE = 80;
const MS_POR_CARACTER = 60;
const DESLIZAR_PX = 80;

/** Tiempo en pantalla (`Infinity` = hasta que se cierre). */
export function salaToastDuration(toast: Pick<SalaToastItem, "type" | "duration" | "action" | "message">): number {
  if (toast.duration !== undefined) {
    return toast.type === "error" ? Math.max(toast.duration, SALA_TOAST_ERROR_MIN_MS) : toast.duration;
  }
  const base = toast.type === "error" || toast.action ? SALA_TOAST_LONG_MS : SALA_TOAST_MS;
  const lectura = Math.max(0, toast.message.length - LARGO_BASE) * MS_POR_CARACTER;
  return Math.min(base + lectura, SALA_TOAST_MAX_MS);
}

const Contexto = React.createContext<SalaToastApi | null>(null);

export function useSalaToast(): SalaToastApi {
  const contexto = React.useContext(Contexto);
  if (!contexto) throw new Error("useSalaToast se usa dentro de <SalaToastProvider>");
  return contexto;
}

// ------------------------------------------------------------
// Un aviso
// ------------------------------------------------------------

const BLOQUE: Record<SalaToastType, string> = {
  info: "bg-sala-ink text-sala-background",
  success: "bg-sala-ink text-sala-background",
  error: "bg-sala-danger text-sala-danger-ink",
};

/** Al pasar el puntero o pulsar, el botón se invierte sobre su bloque. */
const INVERTIDO: Record<SalaToastType, string> = {
  info: "sala-hover:bg-sala-background sala-hover:text-sala-ink sala-pressed:bg-sala-background sala-pressed:text-sala-ink",
  success: "sala-hover:bg-sala-background sala-hover:text-sala-ink sala-pressed:bg-sala-background sala-pressed:text-sala-ink",
  error: "sala-hover:bg-sala-danger-ink sala-hover:text-sala-danger sala-pressed:bg-sala-danger-ink sala-pressed:text-sala-danger",
};

// El anillo es del color del texto del bloque (el de «Sala» es la tinta, que
// aquí es el fondo) y va por dentro: fuera se confundiría con el aviso vecino.
const BOTON = [
  "inline-flex min-h-sala-target shrink-0 cursor-pointer items-center justify-center border-2 sala-type-label",
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:[outline:3px_solid_currentColor] sala-focused:[outline-offset:-7px]",
];

interface UnAvisoProps {
  toast: SalaToastItem;
  paused: boolean;
  dismissLabel: string;
  hint?: string;
  /** `true` la primera vez que se pide para este aviso; después, `false`. */
  onSettle: (id: string) => boolean;
  /**
   * `conFoco`: el foco estaba dentro al cerrarlo, y hay que llevarlo a otro
   * sitio; `destino`, a dónde lo pide la acción pulsada.
   */
  onDismiss: (id: string, conFoco: boolean, destino?: () => HTMLElement | null) => void;
}

function UnAviso({ toast, paused, dismissLabel, hint, onSettle, onDismiss }: UnAvisoProps) {
  const caja = React.useRef<HTMLDivElement>(null);
  const accion = React.useRef<HTMLButtonElement>(null);
  const reloj = React.useRef<number | null>(null);
  const queda = React.useRef(salaToastDuration(toast));
  const desde = React.useRef(0);
  const cerrado = React.useRef(false);
  const arrastre = React.useRef<{ x: number; id: number } | null>(null);
  const [saliendo, setSaliendo] = React.useState(false);
  const [dx, setDx] = React.useState(0);

  const accionDe = React.useRef(toast.action);
  React.useEffect(() => {
    accionDe.current = toast.action;
  });

  const irse = React.useCallback(
    (pulsada = false) => {
      if (cerrado.current) return;
      cerrado.current = true;
      // O la acción o caducar, y una sola vez: lo lleva la cuenta el proveedor,
      // que también puede haberlo dado ya por caducado al desplazarlo.
      if (onSettle(toast.id)) {
        if (pulsada) accionDe.current?.onAction();
        else accionDe.current?.onExpire?.();
      }
      if (reloj.current !== null) window.clearTimeout(reloj.current);
      reloj.current = null;
      const conFoco = Boolean(caja.current?.contains(document.activeElement));
      const nodo = caja.current;
      const destino = pulsada ? accionDe.current?.focusAfter : undefined;
      const quitar = () => onDismiss(toast.id, conFoco, destino);
      // Sin animación (movimiento reducido, o un navegador que no anima) se quita ya.
      const anima = nodo && typeof nodo.getAnimations === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!anima) return quitar();
      setSaliendo(true);
      // Red por si `animationend` no llega (pestaña en segundo plano).
      const red = window.setTimeout(quitar, 400);
      nodo.addEventListener(
        "animationend",
        () => {
          window.clearTimeout(red);
          quitar();
        },
        { once: true }
      );
    },
    [toast.id, onDismiss, onSettle]
  );

  // El reloj: corre mientras no esté parado, y al parar guarda lo que le queda.
  React.useEffect(() => {
    if (paused || saliendo || !Number.isFinite(queda.current)) return;
    desde.current = Date.now();
    reloj.current = window.setTimeout(() => irse(), Math.max(0, queda.current));
    return () => {
      if (reloj.current === null) return;
      window.clearTimeout(reloj.current);
      reloj.current = null;
      queda.current -= Date.now() - desde.current;
    };
  }, [paused, saliendo, irse]);

  const enfocarAccion = toast.action?.autoFocus === true;
  React.useEffect(() => {
    if (enfocarAccion) accion.current?.focus();
  }, [enfocarAccion]);

  const soltar = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastre.current || arrastre.current.id !== event.pointerId) return;
    const recorrido = event.clientX - arrastre.current.x;
    arrastre.current = null;
    if (Math.abs(recorrido) >= DESLIZAR_PX) irse();
    else setDx(0);
  };

  return (
    <div
      ref={caja}
      data-sala-toast={toast.type}
      data-sala-toast-id={toast.id}
      onKeyDown={(event) => {
        if (event.key === "Escape") irse();
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
        arrastre.current = { x: event.clientX, id: event.pointerId };
        // El dedo puede salirse del aviso a medio deslizar: los eventos siguen llegando aquí.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Un puntero que ya no existe: se desliza igual mientras siga encima.
        }
      }}
      onPointerMove={(event) => {
        if (arrastre.current?.id === event.pointerId) setDx(event.clientX - arrastre.current.x);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}
      className={cn(
        // El borde transparente no se ve; con colores forzados (que quitan el
        // fondo) el sistema lo pinta, y el aviso sigue teniendo caja.
        "pointer-events-auto mt-2 flex touch-pan-y items-start gap-3 border-2 border-transparent py-1 pl-4 pr-1 sala-type-text",
        BLOQUE[toast.type],
        saliendo ? "animate-sala-fade-out" : "animate-sala-rise-in",
        "motion-reduce:animate-none"
      )}
    >
      <SalaStatusIcon tone={toast.type} className="mt-[0.875rem]" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3">
        <p className="min-w-0 flex-1 basis-32 py-[0.6875rem] [overflow-wrap:anywhere]">
          {toast.message}
          {toast.action && hint ? <span className="sr-only"> {hint}</span> : null}
        </p>
        {toast.action ? (
          <button
            ref={accion}
            type="button"
            data-sala-toast-action=""
            onClick={() => irse(true)}
            className={cn(BOTON, "max-w-full border-current px-4 [overflow-wrap:anywhere]", INVERTIDO[toast.type])}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" aria-label={dismissLabel} onClick={() => irse()} className={cn(BOTON, "w-sala-target border-transparent", INVERTIDO[toast.type])}>
        <SalaCloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// La cola y la zona de avisos
// ------------------------------------------------------------

const nuevoId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** ¿Se pisan dos cajas? */
const sePisan = (a: DOMRect, b: DOMRect) => a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;

export function SalaToastProvider({ children, labels }: { children: React.ReactNode; labels: SalaToastLabels }) {
  const [toasts, setToasts] = React.useState<SalaToastItem[]>([]);
  const lista = React.useRef<SalaToastItem[]>([]);
  const [montado, setMontado] = React.useState(false);
  const [encima, setEncima] = React.useState(false);
  const [dentro, setDentro] = React.useState(false);
  const [oculta, setOculta] = React.useState(false);
  const [arriba, setArriba] = React.useState(false);
  const zona = React.useRef<HTMLDivElement>(null);
  /** Dónde estaba el foco antes de entrar en la zona: ahí vuelve. */
  const antes = React.useRef<HTMLElement | null>(null);
  const devolverFoco = React.useRef(false);
  /** Lo que pidió la acción pulsada (`focusAfter`), si lo pidió. */
  const destinoFoco = React.useRef<(() => HTMLElement | null) | null>(null);

  React.useEffect(() => setMontado(true), []);

  const poner = React.useCallback((siguiente: SalaToastItem[]) => {
    lista.current = siguiente;
    setToasts(siguiente);
  }, []);

  /** Los avisos ya resueltos (acción pulsada o caducados): cada uno, una sola vez. */
  const resueltos = React.useRef(new Set<string>());
  const resolver = React.useCallback((id: string) => {
    if (resueltos.current.has(id)) return false;
    resueltos.current.add(id);
    return true;
  }, []);

  const show = React.useCallback<SalaToastApi["show"]>(
    ({ message, type = "info", duration, action }) => {
      let quedan = lista.current;
      // No cabe: sale el más viejo que no sea fijo (un error `persistent` no lo
      // echan tres avisos corrientes); si todos lo son, el más viejo. El que
      // sale también caduca, si no estaba ya resuelto.
      while (quedan.length >= SALA_TOAST_MAX) {
        const fuera = quedan.find((toast) => toast.duration !== Infinity) ?? quedan[0];
        if (resolver(fuera.id)) fuera.action?.onExpire?.();
        quedan = quedan.filter((toast) => toast !== fuera);
      }
      if (action && process.env.NODE_ENV !== "production" && document.querySelector('[aria-modal="true"]')) {
        console.warn(
          "SalaToast: aviso con acción mientras hay un diálogo modal abierto. El foco no puede salir del diálogo, así que el aviso se queda fijo hasta que se cierre. Si la acción es de ese diálogo, ponla dentro."
        );
      }
      poner([...quedan, { id: nuevoId(), message, type, duration, ...(action ? { action } : {}) }]);
    },
    [poner, resolver]
  );

  const showError = React.useCallback<SalaToastApi["showError"]>(
    (message, options = {}) => show({ message, type: "error", duration: options.persistent ? Infinity : options.duration }),
    [show]
  );

  const dismiss = React.useCallback((id: string) => poner(lista.current.filter((toast) => toast.id !== id)), [poner]);

  // La cuenta de resueltos no crece sin fin: se olvida a los que ya no están.
  React.useEffect(() => {
    const vivos = new Set(toasts.map((toast) => toast.id));
    for (const id of resueltos.current) if (!vivos.has(id)) resueltos.current.delete(id);
  }, [toasts]);

  const alCerrar = React.useCallback(
    (id: string, conFoco: boolean, destino?: () => HTMLElement | null) => {
      if (conFoco) {
        devolverFoco.current = true;
        destinoFoco.current = destino ?? null;
      }
      dismiss(id);
    },
    [dismiss]
  );

  // Se cerró un aviso con el foco dentro: al siguiente aviso o a donde estaba.
  React.useEffect(() => {
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    const pedido = destinoFoco.current?.() ?? null;
    destinoFoco.current = null;
    if (pedido?.isConnected) {
      pedido.focus();
      setDentro(false);
      return;
    }
    const siguiente = zona.current?.querySelector<HTMLElement>("[data-sala-toast] button");
    if (siguiente) siguiente.focus();
    else if (antes.current?.isConnected) antes.current.focus();
    // Un control que desaparece con el foco puesto no avisa de que lo pierde.
    setDentro(Boolean(zona.current?.contains(document.activeElement)));
  }, [toasts]);

  // Sin avisos no hay nada sobre lo que estar: el siguiente empieza con el reloj en marcha.
  React.useEffect(() => {
    if (toasts.length > 0) return;
    setEncima(false);
    setDentro(false);
  }, [toasts.length]);

  // Pestaña en segundo plano: el reloj no corre para quien no está mirando.
  React.useEffect(() => {
    const mirar = () => setOculta(document.visibilityState === "hidden");
    mirar();
    document.addEventListener("visibilitychange", mirar);
    return () => document.removeEventListener("visibilitychange", mirar);
  }, []);

  // F8 lleva el foco al aviso más reciente: a su acción o, si no tiene, a su
  // botón de cerrar (el primer botón del aviso es la acción cuando la hay).
  const hay = toasts.length > 0;
  React.useEffect(() => {
    if (!hay) return;
    const tecla = (event: KeyboardEvent) => {
      if (event.key !== "F8" || event.altKey || event.ctrlKey || event.metaKey) return;
      const ultimo = lista.current[lista.current.length - 1];
      const destino = ultimo ? zona.current?.querySelector<HTMLElement>(`[data-sala-toast-id="${ultimo.id}"] button`) : null;
      if (!destino) return;
      event.preventDefault();
      destino.focus();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [hay]);

  // Con un diálogo modal abierto el foco no puede llegar al aviso: los que
  // llevan acción no corren hasta que se cierre. Los diálogos cuelgan de
  // `<body>`, así que basta con mirar a sus hijos.
  const hayAccion = toasts.some((toast) => toast.action);
  const [modal, setModal] = React.useState(false);
  React.useEffect(() => {
    if (!hayAccion) {
      setModal(false);
      return;
    }
    const mirar = () => setModal(document.querySelector('[aria-modal="true"]') !== null);
    mirar();
    if (typeof MutationObserver === "undefined") return;
    const observador = new MutationObserver(mirar);
    observador.observe(document.body, { childList: true });
    return () => observador.disconnect();
  }, [hayAccion]);

  // WCAG 2.4.11: si la pila tapa el control que tiene el foco, se va al otro lado.
  React.useEffect(() => {
    if (!hay) {
      setArriba(false);
      return;
    }
    const comprobar = () => {
      const activo = document.activeElement;
      const pila = zona.current;
      if (!pila || !(activo instanceof HTMLElement) || activo === document.body || pila.contains(activo)) return;
      const cajas = Array.from(pila.querySelectorAll<HTMLElement>("[data-sala-toast]"), (aviso) => aviso.getBoundingClientRect());
      const foco = activo.getBoundingClientRect();
      if (cajas.some((caja) => sePisan(caja, foco))) setArriba((estaba) => !estaba);
    };
    comprobar();
    document.addEventListener("focusin", comprobar);
    return () => document.removeEventListener("focusin", comprobar);
  }, [hay, toasts]);

  const api = React.useMemo(() => ({ show, showError, dismiss }), [show, showError, dismiss]);
  const parado = encima || dentro || oculta;
  const errores = toasts.filter((toast) => toast.type === "error");
  const otros = toasts.filter((toast) => toast.type !== "error");
  const pintar = (toast: SalaToastItem) => (
    <UnAviso
      key={toast.id}
      toast={toast}
      paused={parado || (modal && toast.action !== undefined)}
      dismissLabel={labels.dismiss}
      hint={labels.hint}
      onSettle={resolver}
      onDismiss={alCerrar}
    />
  );

  return (
    <Contexto.Provider value={api}>
      {children}
      {montado
        ? createPortal(
            <div
              ref={zona}
              role="region"
              aria-label={labels.region}
              data-sala-toast-viewport={arriba ? "top" : "bottom"}
              onPointerEnter={() => setEncima(true)}
              onPointerLeave={() => setEncima(false)}
              onFocus={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                  if (event.relatedTarget instanceof HTMLElement) antes.current = event.relatedTarget;
                  setDentro(true);
                }
              }}
              onBlur={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDentro(false);
              }}
              // Por encima del diálogo (z-50). Los huecos no reciben clics.
              className={cn(
                // A la derecha se suma el ancho de la barra de scroll que quita un
                // diálogo al abrirse (la variable la pone Radix en `<body>`): la
                // zona no da un salto.
                "pointer-events-none fixed left-4 right-[calc(1rem+var(--removed-body-scroll-bar-size,0px))] z-[60] flex flex-col",
                "md:left-auto md:right-[calc(1.5rem+var(--removed-body-scroll-bar-size,0px))] md:w-96",
                arriba
                  ? "top-[calc(0.5rem+env(safe-area-inset-top))]"
                  : "bottom-[calc(1rem+var(--bottom-nav-clear,0px)+env(safe-area-inset-bottom))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
              )}
            >
              <div aria-live="assertive" aria-relevant="additions text" data-sala-toast-live="assertive" className="flex flex-col">
                {errores.map(pintar)}
              </div>
              {/* `aria-live` escrito aunque `status` ya lo implique: con un diálogo abierto, Radix
                  saca del árbol de accesibilidad todo menos lo que lleva ese atributo. */}
              <div role="status" aria-live="polite" data-sala-toast-live="polite" className="flex flex-col">
                {otros.map(pintar)}
              </div>
            </div>,
            document.body
          )
        : null}
    </Contexto.Provider>
  );
}
