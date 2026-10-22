import { notFound } from 'next/navigation'

/**
 * Cualquier ruta inexistente bajo `/[locale]` es la 404 de su idioma. El
 * `notFound()` va también en los metadatos: así Next resuelve el `<title>` de
 * `not-found.tsx` en las dos cabeceras que manda (la del HTML y la del payload
 * con el que el navegador pinta la página) y no se queda el de la portada.
 */
export async function generateMetadata(): Promise<never> {
  notFound()
}

export default function CatchAllPage() {
  notFound()
}
