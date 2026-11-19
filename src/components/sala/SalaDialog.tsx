"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "@/lib/design/sala-palette";
import { cn } from "@/lib/utils/index";
import { SalaButton } from "./SalaButton";
import { SalaNotice } from "./SalaNotice";
import { SalaCloseIcon } from "./SalaStatusIcon";

/**
 * Diálogo modal de «Sala» (fase 8.4). Convive con `Modal`, que sigue siendo el
 * de las pantallas de hoy; este entra con cada pantalla de la 8.5.
 *
 * Va sobre `@radix-ui/react-dialog`, como `Modal`: ya está en la app y el job
 * de accesibilidad lo prueba. **No es un `<dialog>` nativo**, y es a propósito:
 * `showModal()` deja inerte todo lo que no cuelga del diálogo y lo pinta en la
 * capa superior del navegador, así que un aviso efímero (o el error de una
 * acción que acaba mientras el diálogo sigue abierto) ni se vería encima ni se
 * anunciaría; no bloquea el scroll de la página, no cierra al pulsar fuera, y
 * no devuelve el foco si el botón que lo abrió ha cambiado. Habría que
 * escribir a mano justo lo que Radix ya hace y ya está probado.
 *
 * Lo que da:
 * - **Nombre y descripción.** `title` es obligatorio y nombra al diálogo
 *   (`aria-labelledby`); `description`, si la hay, lo describe.
 * - **Foco.** Al abrir va a `initialFocusRef`; si no, al control que lleve
 *   `data-autofocus`; si no, al primer control del cuerpo, luego al primero
 *   del pie y, si no hay ninguno, al botón de cerrar. Un cuerpo de solo texto
 *   que no cabe recibe él el foco: así las flechas lo desplazan. Tab y
 *   Mayús+Tab no salen. Al cerrar vuelve al control que lo abrió o, si ya no
 *   está, a `finalFocusRef`.
 * - **Fondo.** El resto de la página queda fuera del árbol de accesibilidad
 *   (`aria-hidden`; lo que lleva `aria-live` no, para que un aviso se siga
 *   oyendo) y no recibe clics. El scroll de la página se bloquea y se compensa
 *   el ancho de la barra: nada se mueve de sitio.
 * - **Cierre.** Escape, el botón de cerrar (`closeLabel`, su nombre) y, salvo
 *   `closeOnOutside={false}`, pulsar fuera: solo el clic que empieza y acaba en
 *   el velo (arrastrar una selección desde dentro no cierra). Con
 *   `dismissible={false}` (guardando) no cierra nada.
 * - **Lo que no cabe.** La cabecera y el pie se quedan; el cuerpo tiene su
 *   propio scroll, con una raya arriba y abajo que lo dice. Si entre la
 *   cabecera y el pie no dejan sitio al cuerpo (un móvil apaisado, el texto al
 *   200 %, un título de cuatro líneas), se desplaza el diálogo entero. El
 *   botón de cerrar no se desplaza nunca: está siempre en su esquina.
 * - **Móvil.** `variant="sheet"` es una hoja pegada abajo, a todo el ancho y
 *   de un 85 % del alto como mucho, por debajo de `md`; desde ahí, el diálogo
 *   centrado. Respeta las zonas seguras y, con el teclado en pantalla, sube
 *   por encima de él (`visualViewport`).
 * - **Errores de la acción** (`error`): se pintan y se anuncian dentro, en una
 *   región `alert` que existe desde que se abre.
 * - **Color.** El panel es `sala-panel` con borde de tinta; el velo es el
 *   color de fondo, casi opaco: color plano, sin sombras ni desenfoque. El
 *   diálogo cuelga de `<body>`, fuera de la obra: `palette` le da su paleta.
 *
 * Ningún texto sale de aquí: todos llegan por props, ya traducidos.
 */
type Cierre = { showClose?: true; closeLabel: string } | { showClose: false; closeLabel?: undefined };

export type SalaDialogProps = {
  open: boolean;
  /** Se pide cerrar (Escape, botón, fuera). Quien lo usa pone `open` a `false`. */
  onClose: () => void;
  title: React.ReactNode;
  /** Se lee al abrir, después del título. */
  description?: React.ReactNode;
  /** El cuerpo: lo que se desplaza si no cabe. */
  children?: React.ReactNode;
  /** Las acciones, que no se desplazan. La principal, la última. */
  footer?: React.ReactNode;
  /** `dialog`: centrado siempre. `sheet`: hoja inferior por debajo de `md`. */
  variant?: "dialog" | "sheet";
  /** `alertdialog` para una confirmación: ver `SalaConfirmDialog`. */
  role?: "dialog" | "alertdialog";
  /** Mientras es `false`, ni Escape ni el botón ni pulsar fuera cierran. */
  dismissible?: boolean;
  /** `false`: pulsar fuera no cierra (Escape y el botón, sí). */
  closeOnOutside?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** A dónde va el foco al cerrar si quien lo abrió ya no está en la página. */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** El título sigue nombrando al diálogo, pero no se ve. */
  hideTitle?: boolean;
  /** Error de la acción del diálogo: se ve y se anuncia dentro. */
  error?: string | null;
  /** Clases del panel (su ancho: `max-w-xl`). */
  className?: string;
  /** La paleta de la obra desde la que se abre. Sin ella, los neutros. */
  palette?: ImagePalette;
} & Cierre;

const TABULABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const primero = (dentro: Element | null) => dentro?.querySelector<HTMLElement>(TABULABLES) ?? null;

/**
 * Lo mínimo que tiene que quedarle al cuerpo (px) entre la cabecera y el pie.
 * Con menos, deja de tener scroll propio y se desplaza el diálogo entero.
 */
const CUERPO_MINIMO = 120;
/**
 * Para volver al scroll del cuerpo tiene que sobrar este margen (px). El pie
 * no mide lo mismo en un modo que en otro (16 px de aire): sin margen, en el
 * umbral justo los dos modos se llamarían el uno al otro sin parar.
 */
const HOLGURA = 24;

/**
 * Cuánto tapa el teclado en pantalla, en `--sala-kb` del velo. `dvh` no lo
 * descuenta (en iOS el teclado se pinta encima de la página), así que sin esto
 * la hoja quedaría debajo. Sin `visualViewport` no hace nada.
 */
function useTeclado(velo: React.RefObject<HTMLElement | null>, activo: boolean) {
  React.useEffect(() => {
    const ventana = window.visualViewport;
    if (!activo || !ventana) return;
    const medir = () => {
      // Con zoom de pellizco la ventana visual también encoge, sin teclado: no
      // se mide (a escala 2 daría media pantalla de «teclado» y la hoja saltaría).
      if (ventana.scale > 1.01) return;
      const tapado = Math.max(0, Math.round(window.innerHeight - ventana.height - ventana.offsetTop));
      velo.current?.style.setProperty("--sala-kb", `${tapado}px`);
    };
    // El velo se monta con el portal, después de este efecto: se mide al pintar.
    const pendiente = requestAnimationFrame(medir);
    ventana.addEventListener("resize", medir);
    ventana.addEventListener("scroll", medir);
    return () => {
      cancelAnimationFrame(pendiente);
      ventana.removeEventListener("resize", medir);
      ventana.removeEventListener("scroll", medir);
    };
  }, [velo, activo]);
}

export function SalaDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "dialog",
  role = "dialog",
  dismissible = true,
  closeOnOutside = true,
  showClose = true,
  closeLabel,
  initialFocusRef,
  finalFocusRef,
  hideTitle = false,
  error = null,
  className,
  palette,
}: SalaDialogProps) {
  // Quien tenía el foco justo antes de abrir: Radix solo lo devuelve si hay
  // `Dialog.Trigger`, y aquí cada pantalla tiene su propio botón.
  const quienAbrio = React.useRef<HTMLElement | null>(null);
  const empezoEnElVelo = React.useRef<EventTarget | null>(null);
  const velo = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  /** Lo que se desplaza cuando el cuerpo no tiene sitio: todo menos el botón de cerrar. */
  const rollo = React.useRef<HTMLDivElement>(null);
  const cabecera = React.useRef<HTMLDivElement>(null);
  const cuerpo = React.useRef<HTMLDivElement | null>(null);
  const fallo = React.useRef<HTMLDivElement>(null);
  const pie = React.useRef<HTMLDivElement>(null);
  const [entero, setEntero] = React.useState(false);
  const [desborda, setDesborda] = React.useState(false);
  /** Quién puede recibir el foco para desplazarse con el teclado. */
  const [enfocable, setEnfocable] = React.useState<{ rollo: boolean; cuerpo: boolean }>({ rollo: false, cuerpo: false });
  const [tituloId, setTituloId] = React.useState<string>();
  /** El modo en que está ahora, para medir con holgura y fuera del render. */
  const modo = React.useRef(false);

  const sigueAbierto = React.useRef(open);
  React.useEffect(() => {
    sigueAbierto.current = open;
  }, [open]);

  const hoja = variant === "sheet";
  useTeclado(velo, open);

  const pedirCierre = () => {
    if (dismissible) onClose();
  };

  /** ¿Le queda sitio al cuerpo entre la cabecera y el pie? Si no, se desplaza el diálogo entero. */
  const apretado = React.useCallback((): boolean => {
    const caja = panel.current;
    const nodo = cuerpo.current;
    if (!caja || !nodo) return false;
    const tope = parseFloat(getComputedStyle(caja).maxHeight);
    if (!Number.isFinite(tope)) return false;
    const fijo = (cabecera.current?.offsetHeight ?? 0) + (pie.current?.offsetHeight ?? 0) + (fallo.current?.offsetHeight ?? 0);
    const hueco = tope - fijo;
    const necesita = Math.min(nodo.scrollHeight, CUERPO_MINIMO);
    // Entrar es fácil y salir cuesta un poco más: no oscila en el umbral.
    return modo.current ? hueco < necesita + HOLGURA : hueco < necesita;
  }, []);

  // ¿Cabe el cuerpo? Se vuelve a mirar si cambia de tamaño él, lo que lleva o
  // el diálogo. El nodo llega por la ref (el portal lo monta después que este
  // componente).
  const [nodoCuerpo, setNodoCuerpo] = React.useState<HTMLDivElement | null>(null);
  const unirCuerpo = React.useCallback((nodo: HTMLDivElement | null) => {
    cuerpo.current = nodo;
    setNodoCuerpo(nodo);
  }, []);
  const medir = React.useCallback(() => {
    const nodo = cuerpo.current;
    if (!nodo) return;
    const todo = apretado();
    modo.current = todo;
    const noCabe = !todo && nodo.scrollHeight > nodo.clientHeight + 1;
    const soloTexto = primero(nodo) === null;
    const lista = rollo.current;
    const largo = todo && lista !== null && lista.scrollHeight > lista.clientHeight + 1;
    const activo = document.activeElement;
    setEntero(todo);
    setDesborda(noCabe);
    // Lo que se desplaza y no tiene ningún control dentro tiene que poder
    // recibir el foco: si no, con el teclado no se puede leer entero. Y a quien
    // ya tiene el foco no se le quita el `tabindex`: el foco caería en `<body>`.
    setEnfocable((antes) => {
      const ahora = { rollo: (largo && soloTexto) || activo === lista, cuerpo: (noCabe && soloTexto) || activo === nodo };
      return ahora.rollo === antes.rollo && ahora.cuerpo === antes.cuerpo ? antes : ahora;
    });
    setTituloId(panel.current?.getAttribute("aria-labelledby") ?? undefined);
  }, [apretado]);
  React.useEffect(() => {
    if (!nodoCuerpo) return;
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    for (const nodo of [panel.current, cabecera.current, pie.current, nodoCuerpo, ...Array.from(nodoCuerpo.children)]) {
      if (nodo) observador.observe(nodo);
    }
    return () => observador.disconnect();
  }, [nodoCuerpo, medir, children, footer, title, description, error]);

  // Red: si al cambiar de modo el foco se ha quedado en `<body>` (fuera del
  // diálogo, que es modal), vuelve a lo que se desplaza o al propio diálogo.
  React.useEffect(() => {
    if (!nodoCuerpo || document.activeElement !== document.body) return;
    const destino = enfocable.rollo ? rollo.current : enfocable.cuerpo ? cuerpo.current : panel.current;
    destino?.focus({ preventScroll: true });
  }, [nodoCuerpo, entero, enfocable]);

  // El cuerpo deja su propio aire debajo salvo cuando lleva la raya o no existe.
  const aire = desborda || !children;
  /** Lo que recibe el foco para desplazarse dice qué es: un grupo con el nombre del diálogo. */
  const comoGrupo = (si: boolean) => (si ? ({ tabIndex: 0, role: "group", "aria-labelledby": tituloId } as const) : {});

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) pedirCierre();
      }}
    >
      <Dialog.Portal>
        {/* El panel va dentro del velo: se centra sin `transform` (lo pisaría
            la entrada) y, si no cabe ni así, el velo se desplaza. */}
        <Dialog.Overlay
          ref={velo}
          data-sala-dialog-veil=""
          onPointerDown={(event) => {
            empezoEnElVelo.current = event.target;
          }}
          // Pulsar el velo no mueve el foco: si no cierra (una confirmación), el
          // foco se quedaría en `<body>`, fuera del diálogo.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) event.preventDefault();
          }}
          onClick={(event) => {
            const empezoAqui = empezoEnElVelo.current === null || empezoEnElVelo.current === event.currentTarget;
            empezoEnElVelo.current = null;
            if (closeOnOutside && event.target === event.currentTarget && empezoAqui) pedirCierre();
          }}
          // Con colores forzados el velo no se pinta: el panel se distingue por su borde.
          className={cn(
            palette && SALA_WORK_CLASS,
            "fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-sala-background/90 text-sala-ink",
            // Entra con un fundido corto y se va sin animación: cerrar no espera a nada.
            "animate-sala-fade-in motion-reduce:animate-none",
            "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
            hoja
              ? "items-end pb-[var(--sala-kb,0px)] pt-[env(safe-area-inset-top)] md:items-center md:p-4 md:pb-[calc(1rem+var(--sala-kb,0px))]"
              : "items-center p-4 pb-[calc(1rem+var(--sala-kb,0px))]"
          )}
          style={palette ? (workPaletteVars(palette) as React.CSSProperties) : undefined}
        >
          <Dialog.Content
            ref={panel}
            data-sala-dialog={variant}
            role={role}
            aria-modal="true"
            {...(description ? {} : { "aria-describedby": undefined })}
            onOpenAutoFocus={(event) => {
              quienAbrio.current = document.activeElement as HTMLElement | null;
              const caja = cuerpo.current;
              const soloTexto = caja !== null && primero(caja) === null;
              const pedido = initialFocusRef?.current ?? panel.current?.querySelector<HTMLElement>("[data-autofocus]");
              // Solo texto que no cabe: el foco va a lo que se desplaza (el cuerpo
              // o, si no le queda sitio, el diálogo entero), que se mueve con las
              // flechas y se queda arriba del todo. Ir al botón del pie lo abriría
              // por el final.
              let largo: HTMLElement | null = null;
              if (!pedido && caja && soloTexto) {
                if (apretado()) largo = rollo.current;
                else if (caja.scrollHeight > caja.clientHeight + 1) largo = caja;
              }
              if (largo) {
                largo.tabIndex = 0;
                setEnfocable((antes) => (largo === caja ? { ...antes, cuerpo: true } : { ...antes, rollo: true }));
              }
              const destino = pedido ?? largo ?? primero(caja) ?? primero(pie.current);
              // Sin destino, Radix lo pone en el primer control: el botón de cerrar.
              if (destino) {
                event.preventDefault();
                destino.focus({ preventScroll: destino === largo });
                if (destino === largo) largo.scrollTop = 0;
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const antes = quienAbrio.current;
              // `<body>` no es nadie: quien lo abrió ya no tenía el foco (o no existe).
              const vuelve = antes && antes.isConnected && antes !== document.body ? antes : finalFocusRef?.current;
              if (vuelve) vuelve.focus();
              // Solo si se ha cerrado: si la pantalla entera se desmonta, no hay nada que devolver.
              else if (!sigueAbierto.current && process.env.NODE_ENV !== "production") {
                console.warn("SalaDialog: al cerrar no hay a dónde devolver el foco. Pasa `finalFocusRef`.");
              }
            }}
            // Fuera cierra el velo con su propio clic (arriba); Radix, no: un
            // aviso efímero que se pulsa con el diálogo abierto no lo cierra.
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              if (!dismissible) event.preventDefault();
            }}
            className={cn(
              "relative flex w-full flex-col border-2 border-sala-ink bg-sala-panel text-sala-ink outline-none sala-type-text",
              "motion-reduce:animate-none",
              hoja
                ? [
                    "max-h-[min(85dvh,calc(100dvh-var(--sala-kb,0px)))] max-w-none animate-sala-sheet-in",
                    "border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]",
                    "md:max-h-[calc(100dvh-2rem-var(--sala-kb,0px))] md:max-w-md md:animate-sala-rise-in md:border-2 md:pb-0",
                  ]
                : "max-h-[calc(100dvh-2rem-var(--sala-kb,0px))] max-w-md animate-sala-rise-in",
              className
            )}
          >
            {/* El primero al tabular y siempre en su esquina: no va dentro de lo
                que se desplaza. Con fondo: si se desplaza el diálogo entero, el
                texto pasa por debajo. */}
            {showClose ? (
              <SalaButton
                variant="quiet"
                icon={<SalaCloseIcon />}
                label={closeLabel as string}
                onClick={pedirCierre}
                disabled={!dismissible}
                className="absolute right-0 top-0 z-10 bg-sala-panel"
              />
            ) : null}
            <div
              ref={rollo}
              data-sala-dialog-scroll={entero ? "panel" : "body"}
              {...comoGrupo(enfocable.rollo)}
              onBlur={medir}
              className={cn(
                // `relative`: lo que va con posición absoluta dentro (los textos
                // solo para lectores) tiene que colgar de quien se desplaza. Si
                // cuelga del panel, escapa del recorte y alarga el velo.
                "relative flex min-h-0 flex-1 flex-col",
                entero && "overflow-y-auto overscroll-contain sala-focused:sala-focus sala-focused:!outline-offset-[-3px]"
              )}
            >
              <div ref={cabecera} className={cn("shrink-0", hideTitle && !description && "sr-only")}>
                <Dialog.Title
                  className={cn(
                    "pb-[0.6875rem] pl-5 pt-[0.9375rem] sala-type-data [overflow-wrap:anywhere]",
                    // Sitio para el botón de cerrar, que va encima. En px, como él:
                    // con el texto al 200 % el botón no crece y el hueco tampoco.
                    showClose ? "pr-[52px]" : "pr-5",
                    hideTitle && "sr-only"
                  )}
                >
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description
                    className={cn("pb-3 pl-5 text-sala-ink-secondary [overflow-wrap:anywhere]", hideTitle && showClose ? "pr-[52px] pt-3" : "pr-5")}
                  >
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <div
                ref={unirCuerpo}
                data-sala-dialog-body=""
                {...comoGrupo(enfocable.cuerpo)}
                onBlur={medir}
                className={cn(
                  "relative px-5 [overflow-wrap:anywhere]",
                  entero ? "shrink-0" : "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                  // La raya dice que hay más: solo cuando el cuerpo no cabe.
                  desborda ? "border-y-2 border-sala-border py-4" : "pb-5 pt-1",
                  !children && "hidden",
                  "sala-focused:sala-focus sala-focused:!outline-offset-[-3px]"
                )}
              >
                {children}
              </div>
              {/* Existe desde que se abre: un lector no anuncia la región que nace ya con texto. */}
              <div ref={fallo} role="alert" data-sala-dialog-error="" className={error ? cn("shrink-0 px-5 pb-5", aire && "pt-4") : "sr-only"}>
                {error ? (
                  <SalaNotice tone="error" live="off">
                    {error}
                  </SalaNotice>
                ) : null}
              </div>
              {footer ? (
                <div ref={pie} data-sala-dialog-footer="" className={cn("flex shrink-0 flex-wrap justify-end gap-3 px-5 pb-5", aire && !error && "pt-4")}>
                  {footer}
                </div>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
