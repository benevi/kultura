import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils/index";
import { Spinner } from "./Spinner";

export type KButtonVariant = "primary" | "secondary" | "tonal" | "danger";
export type KButtonSize = "sm" | "md" | "lg";

export interface KButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KButtonVariant;
  size?: KButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

const sizeClasses: Record<KButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export const KButton = React.forwardRef<HTMLButtonElement, KButtonProps>(
  ({ variant = "primary", size = "md", asChild = false, loading = false, className, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          /* Base — radio F0: `rounded-pill` (20px) excede la mitad de la altura
             de cualquier tamaño de botón (32/40/44px), por lo que el navegador
             lo recorta a un estadio perfecto — el "botón pill" del sistema de diseño. */
          "inline-flex items-center justify-center gap-2 rounded-pill font-body whitespace-nowrap",
          "transition-all duration-150 ease-out",
          /* Foco de teclado: contorno (`outline`) pink de 2 px separado 2 px,
             como el resto de controles a mano y como `SalaButton`. Antes era un
             `ring` (`box-shadow`), que con colores forzados no se pinta: el
             foco desaparecía. El `outline` sí se pinta, con el color del
             sistema. Grosor, separación y color se fijan siempre y solo el
             estilo cambia con el foco: así `transition-all` no anima el
             contorno desde el color del texto. El hueco de 2 px es
             transparente (deja ver lo que hay detrás); el `ring` lo pintaba
             del fondo de la página. */
          "outline-2 outline-offset-2 outline-focus-ring focus-visible:[outline-style:solid]",
          "disabled:pointer-events-none disabled:opacity-40",
          /* Size */
          sizeClasses[size],
          /* Variant — pesos del sistema de diseño: primario 800, secundario 700.

             El primario es PINK (E-BOTON-PINK). Lo pintaba en
             `accent-positive` (lime), y parecía que el canvas no lo zanjaba:
             de los 27 pills de las 17 pantallas, 14 eran lime. Contados mal:
             TODOS los lime son badges de match ("98% MATCH", "91%", "60%"…),
             que además ya están retirados de la UI (E-MATCH-SIN-BADGE). De
             los pills de ACCIÓN, los 13 son pink, sin excepción — Enviar,
             Crear grupo, Empezar gratis, Añadir título, Nueva lista, Entrar,
             Guardar, Enviar sugerencia. Coincide con el sistema de diseño.

             `accent-positive` sigue siendo el verde semántico de estados
             (nav activa, chip de filtro activo, badge de biblioteca); lo que
             deja de ser es el color del botón primario. */
          variant === "primary" && [
            "font-extrabold",
            "text-on-accent-pink",
            "bg-accent-pink",
            "hover:brightness-110",
            "active:scale-[0.98]",
          ],
          variant === "secondary" && [
            "font-bold",
            "bg-transparent border-2 border-surface-border",
            "text-text-secondary",
            "hover:bg-surface-elevated hover:text-text-primary",
            "active:scale-[0.98]",
          ],
          /* Tonal: fondo un paso más claro, sin borde. Sale de los botones a
             mano de compartir (`MAIN` de ShareRanking y ShareRatingButton), el
             aviso de correo del calendario y los de email/confirm y
             email/unsubscribe. Para lo que no debe competir con el primario.
             En «Sala» corresponde a `quiet`. */
          variant === "tonal" && [
            "font-bold",
            "bg-surface-elevated",
            "text-text-primary",
            "hover:text-accent-pink",
            "active:scale-[0.98]",
          ],
          /* Peligro discreto: el secundario apagado, que se tiñe de rojo solo
             al pasar el ratón (bloquear, salir de la conversación, reportar).
             Sale de ConversationOptions, FriendshipButton y ReportButton.
             El rojo no avisa solo: el texto nombra lo que se pierde. En
             «Sala» corresponde a `danger`. */
          variant === "danger" && [
            "font-bold",
            "bg-transparent border-2 border-surface-border",
            "text-text-tertiary",
            "hover:bg-surface-elevated hover:text-accent-danger hover:border-accent-danger",
            "active:scale-[0.98]",
          ],
          className
        )}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && <Spinner size="sm" className="text-current" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
KButton.displayName = "KButton";
