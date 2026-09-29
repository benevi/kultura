import * as React from "react";
import { cn } from "@/lib/utils/index";

export interface KInputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const KInput = React.forwardRef<HTMLInputElement, KInputProps>(
  ({ className, type, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-body font-bold text-text-tertiary">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            /* F0 (Login/Settings): bloque surface-2 sin borde visible,
               radio 14px, padding 15×18, texto 15px. */
            "flex w-full rounded-[14px] border-2 bg-surface-elevated px-[18px] py-[13px]",
            "text-[15px] font-body text-text-primary",
            "border-transparent",
            "placeholder:text-text-tertiary",
            "transition-colors duration-150",
            /* Focus: green, not red */
            "focus-visible:outline-none focus-visible:border-accent-positive",
                        "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-accent-danger focus-visible:border-accent-danger focus-visible:ring-accent-danger/40",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-xs font-body text-accent-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs font-body text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);
KInput.displayName = "KInput";
