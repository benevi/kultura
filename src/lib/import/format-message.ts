// ============================================================
// KULTURA — Formateo de los textos del importador sin librería (F-26)
//
// Los textos del namespace `import` solo usan dos piezas de ICU:
//   {nombre}                                     → el valor
//   {n, plural, =0 {…} one {# título} other {…}} → con `Intl.PluralRules`,
//                                                  `#` = n con formato local
// Esto lo cubre. ¿Por qué no `createTranslator` de next-intl/use-intl? Medido
// en el build: importar el núcleo de use-intl desde un módulo de cliente
// propio hace que webpack saque `useTranslations` del chunk compartido de
// next-intl y lo DUPLIQUE en el JS de cada página (+1,3 KB gzip en /es/privacy
// y /es/best, por encima del presupuesto de Lighthouse de F-22). El apóstrofo
// es literal (no hay comillas ICU en estos textos); un texto que use otra
// sintaxis ICU se ve tal cual y lo detecta el test de los mensajes.
// ============================================================

export type MessageValues = Record<string, string | number | Date>

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'pound' }
  | { kind: 'plural'; name: string; options: Record<string, Node[]> }

class Parser {
  private i = 0
  constructor(private readonly src: string) {}

  /** Lee hasta `}` (sin consumirla) o el final. `inPlural`: `#` es el número. */
  nodes(inPlural: boolean): Node[] {
    const out: Node[] = []
    let text = ''
    const flush = () => {
      if (text) out.push({ kind: 'text', value: text })
      text = ''
    }
    while (this.i < this.src.length) {
      const ch = this.src[this.i]
      if (ch === '}') break
      if (ch === '{') {
        flush()
        out.push(this.argument())
        continue
      }
      if (ch === '#' && inPlural) {
        flush()
        out.push({ kind: 'pound' })
        this.i++
        continue
      }
      text += ch
      this.i++
    }
    flush()
    return out
  }

  private argument(): Node {
    this.i++ // {
    const name = this.until(/[,}]/).trim()
    if (this.src[this.i] === '}') {
      this.i++
      return { kind: 'arg', name }
    }
    this.i++ // ,
    const type = this.until(/[,}]/).trim()
    if (type !== 'plural' || this.src[this.i] !== ',') throw new Error(`ICU no admitido: ${type}`)
    this.i++ // ,
    const options: Record<string, Node[]> = {}
    for (;;) {
      this.skipSpace()
      if (this.src[this.i] === '}') {
        this.i++
        break
      }
      const selector = this.until(/[\s{]/).trim()
      this.skipSpace()
      if (!selector || this.src[this.i] !== '{') throw new Error('plural mal formado')
      this.i++ // {
      options[selector] = this.nodes(true)
      if (this.src[this.i] !== '}') throw new Error('plural sin cerrar')
      this.i++ // }
    }
    if (!options.other) throw new Error('plural sin "other"')
    return { kind: 'plural', name, options }
  }

  private until(stop: RegExp): string {
    let s = ''
    while (this.i < this.src.length && !stop.test(this.src[this.i])) s += this.src[this.i++]
    return s
  }

  private skipSpace(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++
  }
}

const cache = new Map<string, Node[]>()

function parse(message: string): Node[] {
  let ast = cache.get(message)
  if (!ast) {
    ast = new Parser(message).nodes(false)
    cache.set(message, ast)
  }
  return ast
}

function render(nodes: Node[], values: MessageValues, locale: string, count: number | null): string {
  let out = ''
  for (const node of nodes) {
    if (node.kind === 'text') out += node.value
    else if (node.kind === 'pound') out += count === null ? '#' : new Intl.NumberFormat(locale).format(count)
    else if (node.kind === 'arg') {
      const v = values[node.name]
      out += v === undefined ? `{${node.name}}` : v instanceof Date ? v.toLocaleDateString(locale) : typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : v
    } else {
      const n = Number(values[node.name])
      const exact = node.options[`=${n}`]
      const branch = exact ?? node.options[new Intl.PluralRules(locale).select(n)] ?? node.options.other
      out += render(branch, values, locale, n)
    }
  }
  return out
}

/** Formatea un texto con la sintaxis de arriba. Lanza si el ICU no es de los admitidos. */
export function formatMessage(message: string, values: MessageValues = {}, locale = 'es'): string {
  return render(parse(message), values, locale, null)
}
