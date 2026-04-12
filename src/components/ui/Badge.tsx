import { cn } from "@/lib/utils/index";

export interface BadgeProps {
  variant?: "default" | "accent" | "muted";
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface2 text-text",
  accent: "bg-accent/20 text-accent",
  muted: "bg-surface text-muted",
};

export function Badge({
  variant = "default",
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
