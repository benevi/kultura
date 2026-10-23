// /.well-known/security.txt — ver security-txt.ts. El middleware no lo
// intercepta: su matcher excluye las rutas con punto.
import { securityTxt } from './security-txt'

export const revalidate = 86400

export function GET(): Response {
  return new Response(securityTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
