'use client'

// ============================================================
// KULTURA — Tu diario de este título, en la ficha (F-24)
// Los apuntes que has hecho de ESTE título (fecha, nota, revisionado,
// reseña). Comparte estado con `LibraryAction` (`TitleEntryProvider`): un
// apunte nuevo aparece aquí al guardar, y quitar el título de la biblioteca
// los quita (la FK los borra con la entrada). Borrar uno se puede deshacer
// mientras dura el aviso. Sin apuntes, no pinta nada.
// ============================================================

import { useTranslations } from 'next-intl'
import { DiaryEntry } from './DiaryEntry'
import { useTitleEntry } from './entry-context'
import { useUndoableLogDelete } from './useUndoableLogDelete'

interface TitleDiaryProps {
  title: string
  /** Clase del título de sección de la ficha (el mismo para todas). */
  headingClassName: string
}

export function TitleDiary({ title, headingClassName }: TitleDiaryProps) {
  const t = useTranslations('diary')
  const shared = useTitleEntry()
  const noop = () => undefined
  const remove = useUndoableLogDelete(shared?.setLogs ?? noop)
  if (!shared || shared.logs.length === 0) return null

  return (
    <section aria-labelledby="title-diary">
      <h2 id="title-diary" className={headingClassName}>
        {t('yourDiary')}
      </h2>
      <ul className="flex flex-col gap-2">
        {shared.logs.map((log) => (
          <DiaryEntry key={log.id} log={log} scale={shared.scale} title={title} onDelete={(l) => remove(l, title)} />
        ))}
      </ul>
    </section>
  )
}
