// @vitest-environment node
/**
 * F-33 · Fronteras: la clave privada y el cifrado nunca llegan al navegador,
 * no hay claves en el repo y la clave privada nunca lleva NEXT_PUBLIC_.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name)
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel]
  })
}

const SERVER_ONLY = ['config', 'webpush', 'dispatch', 'payload']

describe('push · fronteras', () => {
  it('los módulos de servidor llevan server-only', () => {
    for (const m of SERVER_ONLY) expect(read(`src/lib/push/${m}.ts`), m).toMatch(/^import 'server-only'$/m)
  })

  it('ningún archivo de cliente importa los módulos de servidor de push', () => {
    const files = walk('src').filter((f) => /\.(tsx?|jsx?)$/.test(f))
    const clientFiles = files.filter((f) => /^['"]use client['"]/m.test(read(f)) || f.endsWith(path.join('lib', 'push', 'client.ts')))
    expect(clientFiles.length).toBeGreaterThan(10)
    const re = new RegExp(`from ['"](@/lib/push|\\.)/(${SERVER_ONLY.join('|')})['"]`)
    for (const f of clientFiles) expect(re.test(read(f)), f).toBe(false)
  })

  it('la clave privada nunca con NEXT_PUBLIC_, sin librería web-push y sin claves en el código', () => {
    const files = [...walk('src'), ...walk('public'), ...walk('supabase'), 'package.json', 'next.config.mjs']
    for (const f of files.filter((x) => /\.(tsx?|jsx?|mjs|json|sql)$/.test(x))) {
      const text = read(f)
      expect(/NEXT_PUBLIC_VAPID_PRIVATE|NEXT_PUBLIC_PUSH_DISPATCH/.test(text), f).toBe(false)
      // Una clave VAPID privada real en base64url (43 caracteres) junto a su nombre.
      expect(/VAPID_PRIVATE_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{40,}/.test(text), f).toBe(false)
    }
    const pkg = JSON.parse(read('package.json'))
    expect({ ...pkg.dependencies, ...pkg.devDependencies }['web-push']).toBeUndefined()
  })

  it('solo push.settings y push.offer viajan al navegador (push.notify es del servidor)', () => {
    const cm = read('src/i18n/client-messages.ts')
    expect(cm).toContain('"push.settings"')
    expect(cm).toContain('"push.offer"')
    expect(cm).not.toMatch(/"push"|"push\.notify"/)
  })
})
