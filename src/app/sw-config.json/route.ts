// ============================================================
// KULTURA — GET /sw-config.json (F-23, interruptor del service worker)
//
// Lo consulta `public/sw.js` al activarse y como mucho una vez por hora tras
// una navegación con red. Con `NEXT_PUBLIC_PWA_SW=0` (y redeploy) responde
// `{"enabled": false}` y el worker borra sus cachés y se da de baja solo,
// aunque el usuario no vuelva a la zona con sesión. Sin datos de nadie: no
// lee cookies ni sesión. `no-store` para que ningún CDN ni el navegador
// guarden una respuesta vieja.
// ============================================================

import { NextResponse } from 'next/server'
import { isServiceWorkerEnabled } from '@/components/pwa/sw-register'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { enabled: isServiceWorkerEnabled(process.env.NEXT_PUBLIC_PWA_SW) },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
