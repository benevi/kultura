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
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-body font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "flex h-10 w-full rounded-button border bg-surface-base px-3 py-2",
            "text-sm font-body text-text-primary",
            "border-surface-border",
            "placeholder:text-text-tertiary",
            "transition-colors duration-150",
            /* Focus: green, not red */
            "focus-visible:outline-none focus-visible:border-accent-positive",
            "focus-visible:ring-1 focus-visible:ring-accent-positive/40",
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
