/** F-19 · /.well-known/security.txt (RFC 9116). */
import { afterEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/.well-known/security.txt/route'
import { SECURITY_TXT_VALID_DAYS, securityTxt } from '@/app/.well-known/security.txt/security-txt'
import { LEGAL_CONTACT_EMAIL } from '@/app/.well-known/contact'

const ORIGINAL_SITE = process.env.NEXT_PUBLIC_SITE_URL

afterEach(() => {
  if (ORIGINAL_SITE === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE
})

function field(body: string, name: string): string[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith(`${name}: `))
    .map((line) => line.slice(name.length + 2))
}

describe('security.txt', () => {
  it('responde 200 en text/plain con Contact y Expires', async () => {
    const res = GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    const body = await res.text()
    expect(field(body, 'Contact')).toContain(`mailto:${LEGAL_CONTACT_EMAIL}`)
    expect(field(body, 'Expires')).toHaveLength(1)
    expect(field(body, 'Preferred-Languages')).toEqual(['es, en'])
  })

  it('Expires es una fecha futura de menos de un año (RFC 9116 §2.5.5)', () => {
    const now = new Date('2026-10-23T10:00:00.123Z')
    const [expires] = field(securityTxt(now), 'Expires')
    expect(expires).toBe('2027-04-21T10:00:00Z')
    const ms = Date.parse(expires) - now.getTime()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThan(365 * 24 * 60 * 60 * 1000)
    expect(SECURITY_TXT_VALID_DAYS).toBeLessThan(365)
  })

  it('Canonical, Policy y el segundo Contact salen de NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://kultura.example/'
    const body = securityTxt()
    expect(field(body, 'Canonical')).toEqual(['https://kultura.example/.well-known/security.txt'])
    expect(field(body, 'Policy')).toEqual(['https://kultura.example/es/legal#security'])
    expect(field(body, 'Contact')).toContain('https://kultura.example/es/legal#security')
    expect(body.endsWith('\n')).toBe(true)
  })
})
