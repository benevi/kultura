import { cn } from "@/lib/utils/index";

/**
 * Clases de `SalaLink` (fase 8.4), aparte para que las use quien no puede
 * cargar el componente entero: la cabecera de «Sala» (fase 8.5 M2) sale en
 * páginas públicas cuyo JS no lleva el namespace `common` de la flecha de
 * «otra pestaña», y sus enlaces son siempre rutas de la app.
 */
export type SalaLinkVariant = "inline" | "standalone";

/** El subrayado y la marca al pasar el puntero: el texto, no la caja. */
export const TEXTO = "underline decoration-2 underline-offset-4 [overflow-wrap:anywhere]";
export const TRANSICION = "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none";

export const CLASES: Record<SalaLinkVariant, string> = {
  inline: cn(
    // El relleno hace que la marca ocupe la línea entera y que la zona que se
    // pulsa llegue a 24 px con el texto de interfaz (17 px) y el de lectura; no
    // mueve el texto. En una nota de 14 px se queda en 22 px: WCAG 2.5.8 exime
    // al enlace dentro de una frase, y más relleno pisaría la línea de al lado.
    "-mx-0.5 px-0.5 py-0.5 font-semibold text-sala-accent [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
    TEXTO,
    TRANSICION,
    "sala-hover:bg-sala-ink sala-hover:text-sala-background sala-hover:decoration-transparent",
    "sala-pressed:bg-sala-ink-secondary sala-pressed:text-sala-background sala-pressed:decoration-transparent",
    // Dentro de una frase el anillo va pegado: separado pisaría la palabra de al lado.
    "sala-focused:sala-focus sala-focused:!outline-offset-0",
    // Con el puntero encima, el bloque de tinta se comería el anillo, que es
    // de tinta también: ahí se separa 2 px y entre los dos se ve el fondo.
    "sala-hover:sala-focused:!outline-offset-2"
  ),
  // La caja de 48 px es la zona que se pulsa; lo que se marca es el texto de dentro.
  standalone: cn(
    "inline-flex min-h-sala-target max-w-full items-center text-sala-accent sala-type-label",
    "[&>span]:sala-hover:bg-sala-ink [&>span]:sala-hover:text-sala-background [&>span]:sala-hover:decoration-transparent",
    "[&>span]:sala-pressed:bg-sala-ink-secondary [&>span]:sala-pressed:text-sala-background [&>span]:sala-pressed:decoration-transparent",
    "sala-focused:sala-focus"
  ),
};

export const TEXTO_SUELTO = cn("-mx-0.5 min-w-0 px-0.5 py-1", TEXTO, TRANSICION);
