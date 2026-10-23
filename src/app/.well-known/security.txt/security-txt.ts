// ============================================================
// KULTURA — Contenido de /.well-known/security.txt (RFC 9116)
//
// Contacto para avisar de vulnerabilidades. Todo sale de `siteUrl()`, así que
// al cambiar de dominio (NEXT_PUBLIC_SITE_URL) el archivo se actualiza solo.
// `Expires` es obligatorio y no debe pasar de un año: se anuncia a 180 días y
// la ruta se regenera cada día (`revalidate` en route.ts), así que nunca
// caduca mientras la web siga desplegada.
// ============================================================

import { LEGAL_CONTACT_EMAIL } from '../contact'
import { siteUrl } from '@/lib/site-url'

/** Días de validez que se anuncian en `Expires`. */
export const SECURITY_TXT_VALID_DAYS = 180

export function securityTxt(now: Date = new Date()): string {
  const base = siteUrl()
  const expires = new Date(now.getTime() + SECURITY_TXT_VALID_DAYS * 24 * 60 * 60 * 1000)
  return [
    `Contact: mailto:${LEGAL_CONTACT_EMAIL}`,
    `Contact: ${base}/es/legal#security`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: es, en',
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/es/legal#security`,
    '',
  ].join('\n')
}
