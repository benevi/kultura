import { KButton } from "@/components/ui/KButton";

/**
 * Entrada a la cuenta demo de solo lectura (E-DEMO). Un formulario POST y no
 * un enlace: cambia la sesión, y un GET lo dispararía cualquier precarga. Sin
 * JavaScript: funciona aunque la página no haya hidratado.
 */
export function DemoButton({ label, locale }: { label: string; locale: string }) {
  return (
    <form action="/api/auth/demo" method="post">
      <input type="hidden" name="locale" value={locale} />
      <KButton type="submit" variant="secondary" size="lg">
        {label}
      </KButton>
    </form>
  );
}
