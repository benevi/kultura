// Saneamiento 5.3 — la sinopsis del hero de Inicio sale traducida.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const translate = vi.fn()
const afterMock = vi.fn()
vi.mock('@/lib/translate/synopsis', () => ({ translateSynopsis: (o: unknown) => translate(o) }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => afterMock(fn) }))

import { localizeHeroSynopsis } from '@/lib/media/hero-synopsis'

const item = (synopsis: string | null) => ({
  media_id: 'anime_al-1',
  progress: null,
  media: { id: 'anime_al-1', title: 'X', poster: null, year: 2020, type: 'anime', synopsis },
})

describe('localizeHeroSynopsis', () => {
  beforeEach(() => {
    translate.mockReset()
    afterMock.mockReset()
  })

  it('usa la traducción en caché sin llamar al modelo', async () => {
    translate.mockResolvedValue('Un chico encuentra un cuaderno.')
    const out = await localizeHeroSynopsis(item('A boy finds a notebook.'), 'es')
    expect(out.media?.synopsis).toBe('Un chico encuentra un cuaderno.')
    expect(translate).toHaveBeenCalledWith({ text: 'A boy finds a notebook.', locale: 'es', mediaId: 'anime_al-1', cacheOnly: true })
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('sin caché: sirve el original y traduce después de responder', async () => {
    translate.mockImplementation(async (o: { text: string }) => o.text)
    const out = await localizeHeroSynopsis(item('A boy finds a notebook.'), 'es')
    expect(out.media?.synopsis).toBe('A boy finds a notebook.')
    expect(afterMock).toHaveBeenCalledTimes(1)
    await afterMock.mock.calls[0][0]()
    expect(translate).toHaveBeenLastCalledWith({ text: 'A boy finds a notebook.', locale: 'es', mediaId: 'anime_al-1' })
  })

  it('sin sinopsis no hace nada', async () => {
    const it0 = item(null)
    expect(await localizeHeroSynopsis(it0, 'es')).toBe(it0)
    expect(translate).not.toHaveBeenCalled()
  })
})
