// ============================================================
// KULTURA — Encabezado de página (E-PAGE-HEADING)
//
// El canvas "Kultura — Diseño completo" encabeza TODAS las pantallas
// autenticadas igual: un <h1> display de 42px peso 700 con un emoji al final
// ("Tus listas 📋", "Grupos 🎉", "Notificaciones 🔔", "Ajustes ⚙️"), y a su
// derecha —opcional— la acción primaria de la pantalla como pill pink
// ("+ Nueva lista", "+ Crear grupo").
//
// En el código cada pantalla se lo montaba por su cuenta y ninguna coincidía:
// `text-4xl tracking-wide`, `text-3xl font-extrabold`, `text-2xl md:text-3xl`…
// Nueve tamaños distintos para el mismo elemento. Esto lo unifica.
//
// El canvas pone un emoji tras el título; en el código va un icono propio
// (`src/components/icons`, VOZ.md: sin emojis en la interfaz) y APARTE del
// texto traducido: es decoración, lleva `aria-hidden` y no se cuela en el
// nombre accesible de la pantalla.
// ============================================================

import type { KIcon } from "@/components/icons";
import { cn } from "@/lib/utils/index";

export interface PageHeadingProps {
  /** El título ya traducido. */
  children: React.ReactNode;
  /** Icono decorativo tras el título (el emoji del artboard). Opcional. */
  icon?: KIcon;
  /** Acción primaria de la pantalla, a la derecha (normalmente un `KButton`). */
  action?: React.ReactNode;
  className?: string;
}

export function PageHeading({
  children,
  icon: Icon,
  action,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        "mb-7 flex items-center justify-between gap-5",
        className
      )}
    >
      {/* 42px es el valor literal del canvas; en móvil baja a 30px para que un
          título largo no parta la pantalla. */}
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-4xl">
        {children}
        {Icon && (
          <Icon
            aria-hidden="true"
            data-testid="page-heading-icon"
            className="ml-2 inline-block h-7 w-7 -translate-y-0.5 align-middle text-accent-pink md:h-8 md:w-8"
          />
        )}
      </h1>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}
