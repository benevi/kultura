import * as React from "react"
import { cn } from "@/lib/utils/index"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  hint?: string
}

/**
 * Campo genérico (origen shadcn). Usaba `ring-ring` y `ring-offset-background`,
 * colores que no existen en el tema de KULTURA: no generaban regla y el foco
 * caía al azul por defecto de Tailwind. Ahora sigue el mismo patrón que
 * `KInput`: borde `--field-border`, contorno de foco pink, 16 px en móvil y
 * error anunciado (`aria-invalid` + `aria-describedby` + `role="alert"`).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, id, "aria-describedby": describedByProp, ...props }, ref) => {
    const autoId = React.useId()
    const inputId = id ?? `input-${autoId}`
    const messageId = `${inputId}-msg`
    const describedBy =
      [describedByProp, error || hint ? messageId : undefined].filter(Boolean).join(" ") || undefined
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-10 w-full rounded-md border border-field-border bg-surface px-3 py-2 text-base md:text-sm text-text file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-accent-danger",
            className
          )}
          ref={ref}
          {...props}
        />
        {error ? (
          <p id={messageId} role="alert" className="text-xs text-accent-danger">{error}</p>
        ) : hint ? (
          <p id={messageId} className="text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
