'use client'

// ============================================================
// KULTURA — Estado de un título en tu biblioteca, compartido en la ficha
//
// La ficha pinta en sitios distintos lo mismo: el cromo (su forma depende del
// estado), el bloque de acciones (`LibraryAction`) y tu diario de ese título.
// Este contexto guarda la entrada y los apuntes una sola vez, para que al
// guardar o quitar cambie todo a la vez (y el cromo se pegue). Fuera de la
// ficha, cada componente usa su propio estado (`useTitleEntryState`).
// ============================================================

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { DiaryLog, LibraryEntry } from '@/types/library'
import type { DisplayScale } from './rating-display'

export interface TitleEntryState {
  entry: LibraryEntry | null
  setEntry: Dispatch<SetStateAction<LibraryEntry | null>>
  /** Apuntes del diario de este título (más reciente primero). */
  logs: DiaryLog[]
  setLogs: Dispatch<SetStateAction<DiaryLog[]>>
  /** Escala en la que la persona pone sus notas. */
  scale: DisplayScale
}

const TitleEntryContext = createContext<TitleEntryState | null>(null)

interface ProviderProps {
  initialEntry: LibraryEntry | null
  initialLogs?: DiaryLog[] | null
  scale?: DisplayScale
  children: ReactNode
}

export function TitleEntryProvider({ initialEntry, initialLogs, scale = 'legacy', children }: ProviderProps) {
  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [logs, setLogs] = useState<DiaryLog[]>(initialLogs ?? [])
  return (
    <TitleEntryContext.Provider value={{ entry, setEntry, logs, setLogs, scale }}>{children}</TitleEntryContext.Provider>
  )
}

/** El estado compartido de la ficha, o `null` fuera de ella. */
export function useTitleEntry(): TitleEntryState | null {
  return useContext(TitleEntryContext)
}

/**
 * El de la ficha si lo hay; si no, uno propio con los valores de partida
 * (los hooks se llaman siempre, en el mismo orden).
 */
export function useTitleEntryState(
  initialEntry: LibraryEntry | null,
  initialLogs: DiaryLog[] | null = null,
  scale: DisplayScale = 'legacy'
): TitleEntryState {
  const shared = useContext(TitleEntryContext)
  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [logs, setLogs] = useState<DiaryLog[]>(initialLogs ?? [])
  return shared ?? { entry, setEntry, logs, setLogs, scale }
}
