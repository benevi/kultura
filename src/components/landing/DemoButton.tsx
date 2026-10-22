import { KButton } from "@/components/ui/KButton";
import { cn } from "@/lib/utils/index";

/**
 * Entrada a la cuenta demo de solo lectura (E-DEMO). Un formulario POST y no
 * un enlace: cambia la sesión, y un GET lo dispararía cualquier precarga. Sin
 * JavaScript: funciona aunque la página no haya hidratado.
 *
 * `className` va al formulario; el botón ocupa todo su ancho (en móvil el
 * hero apila los dos botones a lo ancho).
 */
export function DemoButton({
  label,
  locale,
  className,
  buttonClassName,
}: {
  label: string;
  locale: string;
  className?: string;
  /** Ajustes del botón según el fondo (p. ej. sobre la card púrpura del cierre). */
  buttonClassName?: string;
}) {
  return (
    <form action="/api/auth/demo" method="post" className={className}>
      <input type="hidden" name="locale" value={locale} />
      <KButton type="submit" variant="secondary" size="lg" className={cn(className && "w-full", buttonClassName)}>
        {label}
      </KButton>
    </form>
  );
}
