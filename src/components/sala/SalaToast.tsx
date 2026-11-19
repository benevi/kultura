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
 * - **Cola.** Tres a la vez como mucho; el cuarto desplaza al más viejo (que
 *   «caduca»: se llama a su `onExpire`).
 * - **Regiones vivas montadas desde el principio** y vacías: una `assertive`
 *   para los errores y un `status` para lo demás. Un lector avisa de lo que
 *   cambia, no de lo que nace con texto.
 * - **Tiempo** (WCAG 2.2.1). 5 s; 8 s un error o un aviso con acción, y nunca
 *   menos de 6 s un error; los textos largos, más (hasta 15 s). El reloj de
 *   todos se para con el puntero encima, con el foco dentro y con la pestaña
 *   en segundo plano. `duration: Infinity` (o `showError(…, { persistent })`)
 *   lo deja hasta que se cierre.
 * - **No roba el foco.** Aparece y el foco sigue donde estaba. Con el teclado
 *   se llega con **F8** (lleva el foco al aviso más reciente y para el reloj);
 *   Escape lo cierra y devuelve el foco a donde estaba. Si se cierra con el
 *   foco dentro, el foco pasa al siguiente aviso o vuelve a su sitio: nunca se
 *   pierde. `action.autoFocus` lo lleva a la acción al aparecer, para cuando el
 *   control que la provocó ya no existe (tras cerrar un diálogo).
 * - **No tapa lo que tiene el foco** (WCAG 2.4.11). Va abajo, por encima de la
 *   barra inferior de la app (`--sala-toast-clear`, que pone quien la pinta) y
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
 *   (el diálogo no esconde las regiones vivas). Aun así, el error de una
 *   acción del diálogo va dentro de él (`SalaDialog`, prop `error`): el foco
 *   está atrapado allí y no puede llegar al aviso.
 */
export type SalaToastType = "success" | "error" | "info";

export interface SalaToastAction {
  label: string;
  onAction: () => void;
  /** El aviso se va sin pulsar la acción (tiempo, cierre, deslizar o desplazado por otros). Una vez. */
  onExpire?: () => void;
  /** Lleva el foco a la acción al aparecer. */
  autoFocus?: boolean;
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
  /** `conFoco`: el foco estaba dentro al cerrarlo, y hay que llevarlo a otro sitio. */
  onDismiss: (id: string, conFoco: boolean) => void;
}

function UnAviso({ toast, paused, dismissLabel, onDismiss }: UnAvisoProps) {
  const caja = React.useRef<HTMLDivElement>(null);
  const accion = React.useRef<HTMLButtonElement>(null);
  const reloj = React.useRef<number | null>(null);
  const queda = React.useRef(salaToastDuration(toast));
  const desde = React.useRef(0);
  const cerrado = React.useRef(false);
  const arrastre = React.useRef<{ x: number; id: number } | null>(null);
  const [saliendo, setSaliendo] = React.useState(false);
  const [dx, setDx] = React.useState(0);

  const alExpirar = React.useRef(toast.action?.onExpire);
  React.useEffect(() => {
    alExpirar.current = toast.action?.onExpire;
  });

  const irse = React.useCallback(
    (pulsada = false) => {
      if (cerrado.current) return;
      cerrado.current = true;
      if (!pulsada) alExpirar.current?.();
      if (reloj.current !== null) window.clearTimeout(reloj.current);
      reloj.current = null;
      const conFoco = Boolean(caja.current?.contains(document.activeElement));
      const nodo = caja.current;
      const quitar = () => onDismiss(toast.id, conFoco);
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
    [toast.id, onDismiss]
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
      onKeyDown={(event) => {
        if (event.key === "Escape") irse();
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
        arrastre.current = { x: event.clientX, id: event.pointerId };
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
        <p className="min-w-0 flex-1 basis-32 py-[0.6875rem] [overflow-wrap:anywhere]">{toast.message}</p>
        {toast.action ? (
          <button
            ref={accion}
            type="button"
            data-sala-toast-action=""
            onClick={() => {
              toast.action?.onAction();
              irse(true);
            }}
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

  React.useEffect(() => setMontado(true), []);

  const poner = React.useCallback((siguiente: SalaToastItem[]) => {
    lista.current = siguiente;
    setToasts(siguiente);
  }, []);

  const show = React.useCallback<SalaToastApi["show"]>(
    ({ message, type = "info", duration, action }) => {
      const sobran = lista.current.length + 1 - SALA_TOAST_MAX;
      // El que sale desplazado por los nuevos también caduca.
      if (sobran > 0) for (const viejo of lista.current.slice(0, sobran)) viejo.action?.onExpire?.();
      poner([...lista.current.slice(Math.max(0, sobran)), { id: nuevoId(), message, type, duration, ...(action ? { action } : {}) }]);
    },
    [poner]
  );

  const showError = React.useCallback<SalaToastApi["showError"]>(
    (message, options = {}) => show({ message, type: "error", duration: options.persistent ? Infinity : options.duration }),
    [show]
  );

  const dismiss = React.useCallback((id: string) => poner(lista.current.filter((toast) => toast.id !== id)), [poner]);

  const alCerrar = React.useCallback(
    (id: string, conFoco: boolean) => {
      if (conFoco) devolverFoco.current = true;
      dismiss(id);
    },
    [dismiss]
  );

  // Se cerró un aviso con el foco dentro: al siguiente aviso o a donde estaba.
  React.useEffect(() => {
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    const siguiente = zona.current?.querySelector<HTMLElement>("[data-sala-toast] button:last-of-type");
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

  // F8 lleva el foco al aviso más reciente.
  const hay = toasts.length > 0;
  React.useEffect(() => {
    if (!hay) return;
    const tecla = (event: KeyboardEvent) => {
      if (event.key !== "F8" || event.altKey || event.ctrlKey || event.metaKey) return;
      const botones = zona.current?.querySelectorAll<HTMLElement>("[data-sala-toast] button");
      const destino = botones?.[botones.length - 1];
      if (!destino) return;
      event.preventDefault();
      destino.focus();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [hay]);

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
  const pintar = (toast: SalaToastItem) => <UnAviso key={toast.id} toast={toast} paused={parado} dismissLabel={labels.dismiss} onDismiss={alCerrar} />;

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
                "pointer-events-none fixed inset-x-4 z-[60] flex flex-col md:left-auto md:right-6 md:w-96",
                arriba
                  ? "top-[calc(0.5rem+env(safe-area-inset-top))]"
                  : "bottom-[calc(1rem+var(--sala-toast-clear,0px)+env(safe-area-inset-bottom))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
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
