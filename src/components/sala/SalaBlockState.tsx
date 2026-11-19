import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SalaBlockStateTitle } from "./SalaBlockStateTitle";
import { SalaStatusIcon } from "./SalaStatusIcon";

/**
 * Estado de un bloque de «Sala» (fase 8.4): lo que se pone donde iba el
 * contenido cuando no lo hay. Dos usos:
 *
 * - **Error** (`tone="error"`): la página o la sección no se ha podido cargar.
 *   Es la pieza que comparten los `error.tsx` de la app: título, explicación,
 *   «Reintentar» (`action`) y una salida (`secondary`). Enviar el error a
 *   Sentry y construir el enlace de salida siguen siendo cosa de quien la usa.
 * - **Vacío** (`tone="neutral"`, por defecto): todavía no hay nada (una
 *   biblioteca sin obras, una búsqueda sin resultados). Dice qué es este sitio
 *   y cuál es el primer paso.
 *
 * ```tsx
 * <SalaBlockState
 *   tone="error"
 *   headingLevel={1}
 *   focusTitle
 *   title={t("somethingWentWrong")}
 *   description={t("tryAgainHint")}
 *   action={<SalaButton onClick={reset}>{t("tryAgain")}</SalaButton>}
 *   secondary={<SalaLink variant="standalone" href="/home">{t("goHome")}</SalaLink>}
 * />
 * ```
 *
 * - Va alineado a la izquierda, como el resto de «Sala», en el mismo borde que
 *   el contenido al que sustituye. El alto lo pone quien lo usa (`className`).
 * - El título es un encabezado de verdad (`headingLevel`: `1` si sustituye a
 *   la página entera, `2` por defecto para una sección).
 * - `focusTitle`: el título recibe el foco al aparecer (ver
 *   `SalaBlockStateTitle`). Para los `error.tsx`; un estado vacío no lo lleva.
 * - El error lleva su dibujo, además del color; `media` pone otro adorno
 *   (una ilustración), siempre oculto a los lectores.
 * - Ningún texto sale de aquí. Es un componente de servidor; de cliente solo
 *   es el encabezado.
 */
export interface SalaBlockStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: "neutral" | "error";
  title: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  /** Qué ha pasado, o qué habrá aquí, y qué se puede hacer. */
  description?: React.ReactNode;
  /** La acción principal: un `SalaButton` («Reintentar», «Buscar obras»). */
  action?: React.ReactNode;
  /** La salida: un `SalaLink` suelto o un botón discreto («Ir al inicio»). */
  secondary?: React.ReactNode;
  /** Adorno encima del título. Sustituye al dibujo del error. */
  media?: React.ReactNode;
  focusTitle?: boolean;
}

export const SalaBlockState = React.forwardRef<HTMLDivElement, SalaBlockStateProps>(function SalaBlockState(
  { tone = "neutral", title, headingLevel = 2, description, action, secondary, media, focusTitle = false, className, ...props },
  ref
) {
  const adorno = media ?? (tone === "error" ? <SalaStatusIcon tone="error" className="h-10 w-10 text-sala-danger" /> : null);
  return (
    <div ref={ref} data-sala-block-state={tone} className={cn("flex flex-col items-start py-12 text-sala-ink sala-type-text", className)} {...props}>
      {adorno ? (
        <div aria-hidden="true" className="mb-6">
          {adorno}
        </div>
      ) : null}
      <SalaBlockStateTitle
        level={headingLevel}
        focus={focusTitle}
        // El foco que llega solo no pinta anillo (no es un control); el que
        // llega con el teclado, sí.
        className="max-w-[30ch] text-balance outline-none sala-type-heading [overflow-wrap:anywhere] sala-focused:sala-focus"
      >
        {title}
      </SalaBlockStateTitle>
      {description ? <div className="mt-4 max-w-prose text-sala-ink-secondary [overflow-wrap:anywhere]">{description}</div> : null}
      {action || secondary ? (
        <div className="mt-8 flex max-w-full flex-wrap items-center gap-x-6 gap-y-2">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
});
