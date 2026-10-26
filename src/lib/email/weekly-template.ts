// ============================================================
// KULTURA — Plantilla del correo semanal (F-28, CRE-9) · solo servidor
//
// Dos versiones del mismo contenido: texto plano (siempre) y HTML accesible:
// `lang`, una sola columna de 600 px como máximo, tablas solo de maquetación
// (`role="presentation"`), un h1, textos de enlace que dicen adónde llevan,
// contraste AA en claro y sin imágenes remotas (ni portadas ni píxeles de
// seguimiento: nada se carga al abrirlo). Todo lo que viene de fuera (títulos
// de los proveedores, nombre de usuario) se escapa.
// Los textos salen de `messages/{es,en}.json` (namespaces `email` y
// `calendar`) con `createTranslator`, igual que en la app.
// ============================================================

import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { describeEvent, shortDay, type CalendarT } from '@/lib/calendar/format'
import type { CalendarEvent } from '@/lib/calendar/types'

/** Líneas como máximo en el cuerpo; el resto, "y N más en tu calendario". */
export const WEEKLY_EMAIL_MAX_ITEMS = 12

export interface WeeklyEmailInput {
  locale: 'es' | 'en'
  username: string
  /** Eventos de la semana, ya ordenados. */
  events: CalendarEvent[]
  calendarUrl: string
  settingsUrl: string
  unsubscribeUrl: string
}

export interface WeeklyEmail {
  subject: string
  text: string
  html: string
}

const MESSAGES = { es, en } as const

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Saltos de línea y caracteres de control fuera (un título no puede inyectar cabeceras ni líneas). */
function oneLine(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
}

export function buildWeeklyEmail(input: WeeklyEmailInput): WeeklyEmail {
  const messages = MESSAGES[input.locale]
  const t = createTranslator({ locale: input.locale, messages, namespace: 'email.weekly' })
  const tc = createTranslator({ locale: input.locale, messages, namespace: 'calendar' }) as unknown as CalendarT

  const shown = input.events.slice(0, WEEKLY_EMAIL_MAX_ITEMS)
  const rest = input.events.length - shown.length
  const rows = shown.map((e) => ({
    day: e.date ? shortDay(e.date, input.locale) : '',
    title: oneLine(e.title),
    what: oneLine(describeEvent(e, tc, input.locale)),
  }))
  const username = oneLine(input.username)

  const subject = oneLine(t('subject', { count: input.events.length }))
  const text = [
    t('greeting', { username }),
    '',
    t('intro'),
    '',
    ...rows.map((r) => `· ${r.day} — ${r.title}: ${r.what}`),
    ...(rest > 0 ? ['', t('more', { count: rest })] : []),
    '',
    `${t('cta')}: ${input.calendarUrl}`,
    '',
    '—',
    t('why'),
    t('manageText', { url: input.settingsUrl }),
    t('unsubscribeText', { url: input.unsubscribeUrl }),
  ].join('\n')

  const h = escapeHtml
  const item = (r: (typeof rows)[number]) => `
          <tr>
            <td style="padding:12px 0;border-top:1px solid #e6e1ef;vertical-align:top;width:96px;font-size:14px;line-height:20px;color:#4a4458;white-space:nowrap">${h(r.day)}</td>
            <td style="padding:12px 0 12px 12px;border-top:1px solid #e6e1ef;vertical-align:top;font-size:16px;line-height:22px;color:#1c1826"><strong>${h(r.title)}</strong><br><span style="font-size:14px;line-height:20px;color:#4a4458">${h(r.what)}</span></td>
          </tr>`

  const html = `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${h(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1f8;color:#1c1826;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${h(t('preheader'))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1f8">
  <tr>
    <td align="center" style="padding:24px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px">
        <tr>
          <td style="padding:32px 28px 8px">
            <p style="margin:0 0 16px;font-size:14px;font-weight:800;letter-spacing:2px;color:#1c1826">KULTURA</p>
            <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;font-weight:700;color:#1c1826">${h(subject)}</h1>
            <p style="margin:0 0 4px;font-size:16px;line-height:24px">${h(t('greeting', { username }))}</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:24px">${h(t('intro'))}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(item).join('')}
            </table>
            ${rest > 0 ? `<p style="margin:12px 0 0;font-size:14px;line-height:20px;color:#4a4458">${h(t('more', { count: rest }))}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 32px">
            <a href="${h(input.calendarUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1c1826;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${h(t('cta'))}</a>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
        <tr>
          <td style="padding:16px 28px;font-size:13px;line-height:20px;color:#4a4458">
            <p style="margin:0 0 8px">${h(t('why'))}</p>
            <p style="margin:0"><a href="${h(input.settingsUrl)}" style="color:#1c1826">${h(t('manage'))}</a> · <a href="${h(input.unsubscribeUrl)}" style="color:#1c1826">${h(t('unsubscribe'))}</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  return { subject, text, html }
}
