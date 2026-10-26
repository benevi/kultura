// ============================================================
// KULTURA — ZIP y GZIP en el navegador, sin dependencias (F-26)
//
// Letterboxd exporta un ZIP; MyAnimeList, un `.xml.gz`. Los dos se abren con
// `DecompressionStream` (nativo en navegadores actuales y en Node), así que
// no hace falta ninguna librería ni subir el archivo al servidor.
//
// Solo lo necesario para leer, con límites anti "bomba ZIP": nº de entradas,
// tamaño descomprimido total y por entrada (se corta al pasarse, no se mira
// lo que declara la cabecera, que puede mentir). ZIP64 y cifrados: no.
// ============================================================

import { ImportParseError } from './types'
import { MAX_UNPACKED_BYTES, MAX_ZIP_ENTRIES } from './limits'

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

/** Descomprime con un tope: al pasarlo, cancela y lanza `too_large`. */
async function decompress(data: Uint8Array, format: 'deflate-raw' | 'gzip', maxBytes: number): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
  let reader: ReadableStreamDefaultReader<Uint8Array>
  try {
    reader = source.pipeThrough(new DecompressionStream(format) as unknown as TransformStream<Uint8Array, Uint8Array>).getReader()
  } catch {
    throw new ImportParseError('corrupt')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new ImportParseError('too_large')
      }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof ImportParseError) throw e
    throw new ImportParseError('corrupt')
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function gunzip(bytes: Uint8Array, maxBytes = MAX_UNPACKED_BYTES): Promise<Uint8Array> {
  return decompress(bytes, 'gzip', maxBytes)
}

export interface ZipEntry {
  /** Ruta dentro del ZIP (`ratings.csv`, `likes/films.csv`). */
  name: string
  bytes: Uint8Array
}

const EOCD_SIG = 0x06054b50
const CDH_SIG = 0x02014b50
const LFH_SIG = 0x04034b50

/**
 * Lee las entradas de un ZIP cuyo nombre acepte `wanted` (para no descomprimir
 * fotos ni carpetas que no se usan). Lanza `corrupt` si no es un ZIP legible.
 */
export async function readZip(
  bytes: Uint8Array,
  wanted: (name: string) => boolean = () => true,
  maxBytes = MAX_UNPACKED_BYTES
): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // El registro final está en los últimos 22 bytes + comentario (≤ 64 KB).
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ImportParseError('corrupt')

  const count = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  if (count > MAX_ZIP_ENTRIES) throw new ImportParseError('too_many_files')
  if (cdOffset >= bytes.length) throw new ImportParseError('corrupt')

  const utf8 = new TextDecoder('utf-8')
  const latin = new TextDecoder('windows-1252')
  const entries: ZipEntry[] = []
  let budget = maxBytes
  let p = cdOffset
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CDH_SIG) {
      throw new ImportParseError('corrupt')
    }
    const flags = view.getUint16(p + 8, true)
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLength = view.getUint16(p + 28, true)
    const extraLength = view.getUint16(p + 30, true)
    const commentLength = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const rawName = bytes.subarray(p + 46, p + 46 + nameLength)
    // Bit 11: nombre en UTF-8; si no, CP437 (≈ Latin-1 para lo que importa).
    const name = (flags & 0x800 ? utf8 : latin).decode(rawName)
    p += 46 + nameLength + extraLength + commentLength

    const isDir = name.endsWith('/')
    const encrypted = (flags & 0x1) === 1
    if (isDir || encrypted || !wanted(name)) continue
    if (method !== 0 && method !== 8) continue

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LFH_SIG) {
      throw new ImportParseError('corrupt')
    }
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const end = start + compressedSize
    if (end > bytes.length) throw new ImportParseError('corrupt')
    const data = bytes.subarray(start, end)

    let content: Uint8Array
    if (method === 0) {
      if (data.byteLength > budget) throw new ImportParseError('too_large')
      content = data
    } else {
      content = await decompress(data, 'deflate-raw', budget)
    }
    budget -= content.byteLength
    entries.push({ name, bytes: content })
  }
  return entries
}

/** Último segmento de una ruta del ZIP, en minúsculas (`export/Ratings.csv` → `ratings.csv`). */
export function baseName(path: string): string {
  return (path.split('/').pop() ?? path).toLowerCase()
}
