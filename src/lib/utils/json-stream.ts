/**
 * JSON servido en streaming (`ReadableStream`), para respuestas que pueden ser
 * grandes como la exportación de datos: una función de Vercel corta las
 * respuestas de una pieza por encima de 4,5 MB, pero no las que van por trozos.
 *
 * El texto resultante es EXACTAMENTE `JSON.stringify(value)`: los arrays y
 * objetos de los primeros `maxDepth` niveles se recorren elemento a elemento y
 * el resto se serializa entero. Se genera bajo demanda (`pull`), así que nunca
 * existe a la vez la cadena completa.
 */

const DEFAULT_CHUNK_CHARS = 64 * 1024

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Trozos de texto cuya concatenación es `JSON.stringify(value)`. */
export function* jsonParts(value: unknown, maxDepth = 2, depth = 0): Generator<string> {
  if (depth < maxDepth && Array.isArray(value)) {
    yield '['
    for (let i = 0; i < value.length; i++) {
      if (i > 0) yield ','
      const item = value[i]
      // Como JSON.stringify: undefined, funciones y símbolos dentro de un array son null.
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') yield 'null'
      else yield* jsonParts(item, maxDepth, depth + 1)
    }
    yield ']'
    return
  }
  if (depth < maxDepth && isPlainObject(value) && typeof value.toJSON !== 'function') {
    yield '{'
    let first = true
    for (const [key, item] of Object.entries(value)) {
      // Como JSON.stringify: esas claves se omiten.
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue
      yield `${first ? '' : ','}${JSON.stringify(key)}:`
      first = false
      yield* jsonParts(item, maxDepth, depth + 1)
    }
    yield '}'
    return
  }
  yield JSON.stringify(value) ?? 'null'
}

export function jsonStream(
  value: unknown,
  { maxDepth = 2, chunkChars = DEFAULT_CHUNK_CHARS }: { maxDepth?: number; chunkChars?: number } = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const parts = jsonParts(value, maxDepth)
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      let buffer = ''
      while (buffer.length < chunkChars) {
        const next = parts.next()
        if (next.done) {
          if (buffer) controller.enqueue(encoder.encode(buffer))
          controller.close()
          return
        }
        buffer += next.value
      }
      controller.enqueue(encoder.encode(buffer))
    },
    cancel() {
      parts.return(undefined)
    },
  })
}
