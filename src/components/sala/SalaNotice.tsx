import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SalaButton } from "./SalaButton";
import { SalaCloseIcon, SalaStatusIcon, type SalaTone } from "./SalaStatusIcon";

/**
 * Aviso en línea de «Sala» (fase 8.4): un mensaje dentro de la página, en su
 * sitio (encima de un formulario, en una sección, dentro de un diálogo). No
 * flota ni se va solo: para eso está el aviso efímero (`SalaToastProvider`).
 *
 * - **Tonos:** `info`, `success`, `warning` y `error`. El tono va en el borde y
 *   en el dibujo, que tiene una forma distinta en cada uno: nunca solo en el
 *   color (WCAG 1.4.1). El texto es siempre tinta sobre panel.
 * - **Quién lo anuncia** (`live`). Por defecto, según la urgencia: `error` es
 *   un `role="alert"` (interrumpe) y los demás un `role="status"` (esperan su
 *   turno). El papel lo lleva solo el texto: los botones quedan fuera, para que
 *   el lector no los lea como parte del aviso. Con `live="off"` no lleva papel:
 *   para un aviso que ya estaba en la página al llegar, o cuando ya lo anuncia
 *   otro (el diálogo anuncia su `error`; un aviso dentro de otra región viva se
 *   oiría dos veces). Nunca lleva `aria-live` además del papel.
 * - **Un aviso que aparece después** tiene que nacer en una región que ya
 *   existía: un lector avisa de los cambios, no de lo que nace con texto. Lo
 *   seguro es dejar el `SalaNotice` siempre montado y cambiarle el contenido,
 *   o envolverlo en un `role="status"` propio y pasarle `live="off"`.
 * - **Acción** (`action`): un `SalaButton` o un `SalaLink`, debajo del texto.
 * - **Cierre** (`onClose` + `closeLabel`): un botón de 48 px. Quien lo cierra
 *   decide a dónde va el foco después (lo normal: al encabezado o al control
 *   siguiente); el aviso no puede saberlo.
 * - `toneLabel` es una palabra para el lector de pantalla delante del texto
 *   («Error:», «Aviso:»), ya traducida. Opcional: un texto bien escrito ya dice
 *   qué pasa.
 *
 * Ningún texto sale de aquí. Es un componente de servidor; con `onClose` lo
 * monta un componente de cliente.
 */
export type SalaNoticeTone = SalaTone;

type Cierre = { onClose: () => void; closeLabel: string } | { onClose?: undefined; closeLabel?: undefined };

export type SalaNoticeProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "role" | "aria-live"> & {
  tone?: SalaNoticeTone;
  /** Una línea que resume el aviso. Opcional: uno corto no la necesita. */
  title?: React.ReactNode;
  /** El mensaje: qué pasa y, si algo se puede hacer, qué. */
  children: React.ReactNode;
  /** Palabra para el lector delante del texto («Error:»). */
  toneLabel?: string;
  /**
   * `auto` (por defecto): `alert` si es un error, `status` si no. `assertive`
   * y `polite` lo fuerzan; `off` no pone papel.
   */
  live?: "auto" | "assertive" | "polite" | "off";
  action?: React.ReactNode;
} & Cierre;

const BORDE: Record<SalaNoticeTone, string> = {
  info: "border-sala-border",
  success: "border-sala-success",
  warning: "border-sala-warning",
  error: "border-sala-danger",
};

const DIBUJO: Record<SalaNoticeTone, string> = {
  info: "text-sala-ink",
  success: "text-sala-success",
  warning: "text-sala-warning",
  error: "text-sala-danger",
};

function papel(tone: SalaNoticeTone, live: NonNullable<SalaNoticeProps["live"]>): "alert" | "status" | undefined {
  if (live === "off") return undefined;
  if (live === "assertive") return "alert";
  if (live === "polite") return "status";
  return tone === "error" ? "alert" : "status";
}

export const SalaNotice = React.forwardRef<HTMLDivElement, SalaNoticeProps>(function SalaNotice(
  { tone = "info", title, toneLabel, live = "auto", action, onClose, closeLabel, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-sala-notice={tone}
      // Color plano y esquinas rectas (biblia §1). El borde es de 2 px y de un
      // color de 3:1 o más: con colores forzados sigue ahí, con el del sistema.
      className={cn("flex items-start gap-3 border-2 bg-sala-panel p-4 text-sala-ink sala-type-text", BORDE[tone], className)}
      {...props}
    >
      <SalaStatusIcon tone={tone} className={cn("mt-[0.1875rem]", DIBUJO[tone])} />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <div role={papel(tone, live)}>
          {toneLabel ? <span className="sr-only">{toneLabel} </span> : null}
          {title ? <p className="mb-1 font-semibold">{title}</p> : null}
          <div>{children}</div>
        </div>
        {action ? <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">{action}</div> : null}
      </div>
      {onClose ? (
        // Sale por los lados del relleno para que el aspa quede alineada con el
        // texto sin que el aviso crezca: la zona que se pulsa sigue en 48 px.
        <SalaButton variant="quiet" icon={<SalaCloseIcon />} label={closeLabel} onClick={onClose} className="-my-3 -mr-3 shrink-0" />
      ) : null}
    </div>
  );
});
