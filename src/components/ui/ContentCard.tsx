import Image from "next/image";
import { cn } from "@/lib/utils/index";

export type ContentCardStatus = "completed" | "pending" | null;

export interface ContentCardProps {
  title: string;
  poster?: string;
  year?: number;
  rating?: number;
  status?: ContentCardStatus;
  /** Additional metadata line (e.g. genre, director) */
  meta?: string;
  className?: string;
  onClick?: () => void;
}

export function ContentCard({
  title,
  poster,
  year,
  rating,
  status,
  meta,
  className,
  onClick,
}: ContentCardProps) {
  return (
    <article
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-card overflow-hidden cursor-pointer",
        "bg-surface-default border border-surface-border",
        "border-[0.5px] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        onClick && "cursor-pointer",
        className
      )}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      {/* Poster — aspect 2/3 */}
      <div className="relative w-full" style={{ aspectRatio: "2/3" }}>
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
            <span className="text-text-tertiary text-xs font-body">Sin portada</span>
          </div>
        )}

        {/* Badge rating — esquina superior derecha */}
        {rating !== undefined && rating !== null && (
          <div
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-body font-medium"
            style={{
              background: "rgba(10,12,14,0.85)",
              color: "var(--accent-highlight)",
            }}
          >
            ★ {rating.toFixed(1)}
          </div>
        )}

        {/* Badge estado — esquina inferior izquierda */}
        {status && (
          <div
            className={cn(
              "absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs font-body font-medium uppercase tracking-wide",
              status === "completed"
                ? "text-on-accent-positive"
                : "text-text-secondary"
            )}
            style={{
              background:
                status === "completed"
                  ? "var(--accent-positive)"
                  : "var(--surface-elevated)",
            }}
          >
            {status === "completed" ? "Visto" : "Pendiente"}
          </div>
        )}
      </div>

      {/* Text area below poster */}
      <div className="p-2 flex flex-col gap-0.5">
        <p
          className="text-text-primary font-body leading-snug line-clamp-2"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          {title}
        </p>
        {(meta || year) && (
          <p
            className="text-text-secondary font-body"
            style={{ fontSize: "12px", fontWeight: 400 }}
          >
            {[year, meta].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}
