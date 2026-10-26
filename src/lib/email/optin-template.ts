// ============================================================
// KULTURA — Correo de confirmación del alta (doble opt-in, F-28) · solo servidor
// Mismo estilo que el semanal (weekly-template.ts): texto plano + HTML
// accesible sin imágenes remotas; todo lo dinámico, escapado.
// ============================================================

import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { escapeHtml } from './weekly-template'

const MESSAGES = { es, en } as const

export interface OptinEmailInput {
  locale: 'es' | 'en'
  username: string
  confirmUrl: string
}

function oneLine(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
}

export function buildOptinEmail(input: OptinEmailInput): { subject: string; text: string; html: string } {
  const t = createTranslator({ locale: input.locale, messages: MESSAGES[input.locale], namespace: 'email.optin' })
  const username = oneLine(input.username)
  const subject = t('subject')
  const text = [
    t('greeting', { username }),
    '',
    t('body'),
    '',
    t('linkText', { url: input.confirmUrl }),
    t('expires'),
    '',
    t('ignore'),
  ].join('\n')
  const h = escapeHtml
  const html = `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${h(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1f8;color:#1c1826;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1f8">
  <tr>
    <td align="center" style="padding:24px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px">
        <tr>
          <td style="padding:32px 28px">
            <p style="margin:0 0 16px;font-size:14px;font-weight:800;letter-spacing:2px">KULTURA</p>
            <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;font-weight:700">${h(subject)}</h1>
            <p style="margin:0 0 4px;font-size:16px;line-height:24px">${h(t('greeting', { username }))}</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:24px">${h(t('body'))}</p>
            <a href="${h(input.confirmUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1c1826;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${h(t('cta'))}</a>
            <p style="margin:24px 0 8px;font-size:14px;line-height:20px;color:#4a4458">${h(t('expires'))}</p>
            <p style="margin:0;font-size:14px;line-height:20px;color:#4a4458">${h(t('ignore'))}</p>
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
