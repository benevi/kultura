// Constantes del importador compartidas por sus piezas.
import { MAX_FILE_BYTES } from '@/lib/import/limits'

export const MB = Math.round(MAX_FILE_BYTES / 1024 / 1024)
export const UNMATCHED_SHOWN = 20
export const ACCEPT = '.zip,.csv,.xml,.gz,text/csv,application/zip,application/xml,text/xml,application/gzip'

/** Tarjeta de las fases vista previa, importando y terminado. */
export const card = 'rounded-bento bg-surface-default px-5 py-5 sm:px-6'
