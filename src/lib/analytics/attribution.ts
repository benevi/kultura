// ============================================================
// KULTURA — Atribución del alta (D-12, CRE-1c / CRE-7)
//
// De dónde viene cada cuenta nueva SIN cookies ni `localStorage`: los
// `utm_*`, el `ref` (quién invita) y su firma `inv` viajan por la URL desde la
// página que se comparte hasta el alta:
//   /u/benevi?ref=benevi&inv=…  →  /login?mode=register&ref=…&inv=…
//   → `signUp({ options: { data: { attribution } } })` (correo) o el `next`
//     del callback (Google) → metadatos del usuario y evento `signup_completed`.
//
// Puro y sin dependencias de servidor: lo usan el login (cliente), el
// callback y las páginas públicas.
// ============================================================

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
export type UtmKey = (typeof UTM_KEYS)[number]

/** Canal del alta: el 100 % de las cuentas nuevas cae en uno de los tres. */
export type AttributionChannel = 'utm' | 'ref' | 'direct'

export interface Attribution {
  channel: AttributionChannel
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  /** Nombre de usuario de quien comparte (sin verificar: solo atribución). */
  ref?: string
}

/** Lo que viaja por la URL: la atribución más la firma de la invitación. */
export interface AttributionParams extends Attribution {
  /** Firma `<exp>.<hmac>` de `ref` (ver `lib/analytics/invite.ts`). Nunca se guarda. */
  inv?: string
}

/** Los mismos caracteres que admiten los nombres antiguos (con punto y guion). */
const REF_RE = /^[A-Za-z0-9_.-]{2,40}$/
const INV_RE = /^\d{9,11}\.[0-9a-f]{32}$/
const UTM_MAX = 100

type ParamSource = { get(name: string): string | null }

/** Valor de `utm_*` limpio: sin caracteres de control, recortado y en minúsculas. */
function cleanUtm(raw: string | null): string | undefined {
  if (!raw) return undefined
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u001F\u007F<>"'`]/g, '').trim().toLowerCase().slice(0, UTM_MAX)
  return value || undefined
}

/** Atribución de una URL (`searchParams` de una página o de una petición). */
export function parseAttribution(params: ParamSource | null | undefined): AttributionParams {
  const out: AttributionParams = { channel: 'direct' }
  if (!params) return out
  for (const key of UTM_KEYS) {
    const value = cleanUtm(params.get(key))
    if (value) out[key] = value
  }
  const ref = params.get('ref')?.trim()
  if (ref && REF_RE.test(ref)) out.ref = ref
  const inv = params.get('inv')?.trim().toLowerCase()
  if (out.ref && inv && INV_RE.test(inv)) out.inv = inv
  out.channel = out.utm_source ? 'utm' : out.ref ? 'ref' : 'direct'
  return out
}

/** `searchParams` de una página de Next (`string | string[] | undefined`). */
export function parseAttributionRecord(
  record: Record<string, string | string[] | undefined> | null | undefined,
): AttributionParams {
  return parseAttribution({
    get: (name) => {
      const value = record?.[name]
      return (Array.isArray(value) ? value[0] : value) ?? null
    },
  })
}

/** Lo que se guarda en los metadatos y en el evento: sin la firma. */
export function toStoredAttribution(attr: AttributionParams): Attribution {
  const out: Attribution = { channel: attr.channel }
  for (const key of UTM_KEYS) if (attr[key]) out[key] = attr[key]
  if (attr.ref) out.ref = attr.ref
  return out
}

/** Atribución ya guardada en `user_metadata.attribution` (alta por correo), o `null`. */
export function storedAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const parsed = parseAttribution({
    get: (name) => (typeof record[name] === 'string' ? (record[name] as string) : null),
  })
  return toStoredAttribution(parsed)
}

/** Pares clave/valor para añadir a una URL (en orden estable). */
export function attributionEntries(attr: AttributionParams): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (const key of UTM_KEYS) if (attr[key]) entries.push([key, attr[key] as string])
  if (attr.ref) entries.push(['ref', attr.ref])
  if (attr.ref && attr.inv) entries.push(['inv', attr.inv])
  return entries
}

/** Añade la atribución a una ruta interna que ya puede llevar `?`. */
export function withAttribution(path: string, attr: AttributionParams): string {
  const entries = attributionEntries(attr)
  if (entries.length === 0) return path
  const [base, hash = ''] = path.split('#')
  const query = new URLSearchParams(entries).toString()
  return `${base}${base.includes('?') ? '&' : '?'}${query}${hash ? `#${hash}` : ''}`
}
