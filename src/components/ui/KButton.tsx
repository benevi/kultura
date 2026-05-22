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
        className={cn(
          /* Base */
          "inline-flex items-center justify-center gap-2 rounded-button font-body font-medium whitespace-nowrap",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
          "disabled:pointer-events-none disabled:opacity-40",
          /* Size */
          sizeClasses[size],
          /* Variant */
          variant === "primary" && [
            "text-on-accent-positive",
            "bg-accent-positive",
            "hover:brightness-110",
            "active:scale-[0.98]",
          ],
          variant === "secondary" && [
            "bg-transparent border border-surface-border",
            "text-text-secondary",
            "hover:bg-surface-elevated hover:text-text-primary",
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
