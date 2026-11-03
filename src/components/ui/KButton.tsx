import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils/index";
import { Spinner } from "./Spinner";

export type KButtonVariant = "primary" | "secondary";
export type KButtonSize = "sm" | "md" | "lg";

export interface KButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KButtonVariant;
  size?: KButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

/* Alto mínimo de 44 px en pantallas táctiles (`pointer-coarse:`), también en
   los tamaños compactos. */
const sizeClasses: Record<KButtonSize, string> = {
  sm: "h-9 px-3 text-sm pointer-coarse:h-11",
  md: "h-10 px-4 text-sm pointer-coarse:h-11",
  lg: "h-11 px-6 text-base",
};

/**
 * Botón del álbum (DISENO.md):
 * - primario: rosa sólido, la ÚNICA acción de color (una por pantalla);
 * - secundario: de noche, relleno marino un escalón más claro y texto
 *   blanco; en papel (`.theme-paper`), blanco con tinta marina y raya de 2 px.
 *   Lo deciden los tokens `--button-secondary-*`, no el componente.
 * Radio 8 px, Figtree 700. Foco: contorno de 2 px con separación (amarillo
 * de noche, marino en papel). Solo se animan color y transformación.
 */
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
          /* `min-w-0 max-w-full overflow-hidden`: una etiqueta con datos
             («Bloquear a {usuario}») no se sale de su caja (WIG). */
          "inline-flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-button border-2 font-body font-bold",
          "transition-[color,background-color,border-color,transform] duration-fast ease-out",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          "disabled:pointer-events-none disabled:opacity-40",
          "motion-safe:active:scale-[0.98]",
          sizeClasses[size],
          variant === "primary" && "border-accent-pink bg-accent-pink text-on-accent-pink hover:border-accent-pink-hover hover:bg-accent-pink-hover",
          variant === "secondary" &&
            "border-button-secondary-border bg-button-secondary text-on-button-secondary hover:border-surface-border hover:bg-surface-border",
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
