import { cn } from "@/lib/utils/index";

export type AlbumPageTone = "white" | "cyan" | "yellow";

export interface AlbumPageProps {
  /** Campo de color de la página: blanco (por defecto), cian o amarillo. */
  tone?: AlbumPageTone;
  /** Página izquierda de un pliego (con `right`): dos páginas y el lomo en escritorio. */
  left?: React.ReactNode;
  /** Página derecha del pliego. En móvil va debajo, una página cada vez. */
  right?: React.ReactNode;
  /** Contenido de una sola página (sin `left`/`right`). */
  children?: React.ReactNode;
  /** Mete el contenido en la retícula (`page-grid`). Por defecto, sí. */
  contained?: boolean;
  as?: "section" | "div" | "main" | "header" | "article";
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

const TONES: Record<AlbumPageTone, string> = {
  white: "",
  cyan: "paper-cyan",
  yellow: "paper-yellow",
};

/**
 * Página impresa del álbum (superficies públicas). Aplica `theme-paper`: los
 * tokens de todo lo que hay dentro pasan a papel (blanco, tinta marina, foco
 * marino), así la cabecera, los botones y los campos se re-visten solos. Con
 * `left` y `right` pinta un pliego: dos páginas con el lomo en el centro
 * (raya de 2 px) desde `md`; en móvil, una página detrás de otra.
 */
export function AlbumPage({
  tone = "white",
  left,
  right,
  children,
  contained = true,
  as: Comp = "section",
  className,
  ...rest
}: AlbumPageProps) {
  const spread = left != null && right != null;
  const body = spread ? (
    <div data-spread="" className="grid gap-10 md:grid-cols-2 md:gap-0">
      <div className="min-w-0 md:pr-8">{left}</div>
      <div className="min-w-0 border-t-2 border-surface-border pt-10 md:border-l-2 md:border-t-0 md:pl-8 md:pt-0">
        {right}
      </div>
    </div>
  ) : (
    children
  );
  return (
    <Comp data-album-page={tone} className={cn("theme-paper", TONES[tone], className)} {...rest}>
      {contained ? <div className="page-grid">{body}</div> : body}
    </Comp>
  );
}
