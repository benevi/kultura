'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { MediaCard } from '@/components/media/MediaCard'
import type { AiRec, AiRecsResult } from '@/lib/claude/recommendations'
import type { MediaItem } from '@/types/media'

type Status = 'idle' | 'loading' | 'done' | 'starter' | 'empty' | 'error' | 'rate_limited'

// Un esqueleto por tipo recomendable (movie, tv, anime, book, manga, comic, game).
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5, 6]

interface AiRecommendationsProps {
  /**
   * Las recomendaciones de hoy, si ya se generaron (las lee Inicio en el
   * servidor sin coste). Con ellas la sección se pinta directamente.
   */
  initial?: AiRecsResult | null
  /**
   * Lo popular para una cuenta sin señal suficiente (menos de 3 títulos): se
   * enseña directamente, sin botón, porque no hay nada que pedirle a la IA.
   */
  starter?: MediaItem[]
  /**
   * Esqueleto mientras el servidor prepara lo popular (fallback de Suspense en
   * Inicio). No pide nada: solo pinta la espera.
   */
  pending?: boolean
}

function initialStatus(
  initial: AiRecsResult | null | undefined,
  starter: MediaItem[] | undefined,
  pending: boolean
): Status {
  if (pending) return 'loading'
  if (initial && initial.recommendations.length > 0) return 'done'
  if (starter && starter.length > 0) return 'starter'
  return 'idle'
}

/**
 * "Para ti" (D-06 / ROJO-4). Nada se pide al montarse: la IA solo se llama
 * cuando el usuario pulsa "Recomiéndame", que es además el consentimiento que
 * promete la política de privacidad (se le dice qué se envía y a quién). La
 * respuesta vale para todo el día.
 */
export function AiRecommendations({
  initial = null,
  starter: initialStarter,
  pending = false,
}: AiRecommendationsProps = {}) {
  const t = useTranslations('aiRecommendations')
  const [recs, setRecs] = useState<AiRec[]>(initial?.recommendations ?? [])
  const [source, setSource] = useState<AiRecsResult['source']>(initial?.source ?? 'ai')
  const [capped, setCapped] = useState(initial?.capped === true)
  // `saved: false` → el modelo falló y no se guardó: no son "las de hoy".
  const [saved, setSaved] = useState(initial?.saved !== false)
  const [starter, setStarter] = useState<MediaItem[]>(initialStarter ?? [])
  const [status, setStatus] = useState<Status>(() => initialStatus(initial, initialStarter, pending))
  const sectionRef = useRef<HTMLElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  // Solo se mueve el foco cuando el resultado llega por un clic: el botón que
  // lo tenía desaparece y el lector de pantalla se quedaría en el vacío.
  const focusOnResult = useRef(false)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (status === 'loading' || status === 'idle' || !focusOnResult.current) return
    focusOnResult.current = false
    sectionRef.current?.focus()
  }, [status])

  const fetchRecs = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    focusOnResult.current = true
    setStatus('loading')

    fetch('/api/ai-recommendations', { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 429) { setStatus('rate_limited'); return }
        if (!r.ok) { setStatus('error'); return }
        const data: Partial<AiRecsResult> & { starter?: MediaItem[] } = await r.json()
        const list = data.recommendations ?? []
        const popular = data.starter ?? []
        setRecs(list)
        setSource(data.source ?? 'ai')
        setCapped(data.capped === true)
        setSaved(data.saved !== false)
        setStarter(popular)
        // Sin recomendaciones propias se enseña lo popular, y solo si tampoco
        // hay eso queda la tarjeta de "añade títulos" sola.
        setStatus(list.length > 0 ? 'done' : popular.length > 0 ? 'starter' : 'empty')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })
  }, [])

  // El cartel hace de título, así que acompaña a lo que de verdad es una
  // recomendación (o está a punto de serlo), no a un error ni a un aviso.
  const hasBadge = status === 'done' || status === 'loading' || status === 'starter'

  return (
    // Sin <h2> la sección se quedaba sin nombre accesible (el cartel es un div
    // decorativo con emoji), así que el título vive ahora aquí.
    <section
      ref={sectionRef}
      tabIndex={-1}
      // Recibe el foco tras el clic (el botón desaparece): anillo visible con
      // teclado, el mismo patrón de foco que el resto de controles.
      className={`relative rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${hasBadge ? 'pt-7 md:pt-8' : ''}`}
      aria-label={t('title')}
      aria-busy={status === 'loading'}
    >
      {/* El cartel lima ES la cabecera de la sección: el par "Para ti · IA"
          que había debajo repetía lo mismo en plano y robaba altura. Se
          pinta también durante la carga para que el esqueleto no aparezca
          huérfano; en los estados vacío/error la tarjeta ya se explica sola. */}
      {hasBadge && (
        <div
          className="inline-block absolute -top-3.5 left-0 z-10 rounded-2xl px-3.5 py-1.5 md:px-4 md:py-2 bg-accent-lime text-on-accent-lime font-display text-[10px] md:text-[11px] font-extrabold tracking-wide"
          style={{ transform: 'rotate(-4deg)', boxShadow: '4px 4px 0 rgba(0,0,0,0.35)' }}
        >
          {status === 'starter'
            ? `🔥 ${t('starterBadge')}`
            : status === 'done' && source === 'match'
              ? `✦ ${t('matchBadge')}`
              : `🤖 ${t('aiPickBadge')}`}
        </div>
      )}

      {/* Sin fetch al montar (D-06): la IA se llama solo con este botón, y la
          línea de abajo dice qué se envía y a quién antes de pulsarlo. */}
      {status === 'idle' && (
        <div className="bg-surface-default border border-surface-border rounded-card p-6 flex flex-col items-center gap-3 text-center">
          <span className="text-3xl" aria-hidden="true">✦</span>
          <div>
            <h2 className="font-display text-base font-bold text-text-primary">{t('askTitle')}</h2>
            <p className="font-body text-sm text-text-secondary mt-1">{t('askHint')}</p>
          </div>
          <KButton size="sm" onClick={fetchRecs}>
            {t('askButton')}
          </KButton>
          <p className="font-body text-xs text-text-tertiary max-w-md">
            {t('askPrivacy')}{' '}
            <Link href="/privacy" className="underline hover:text-text-secondary">
              {t('privacyLink')}
            </Link>
          </p>
        </div>
      )}

      {/* Región viva SIEMPRE montada: los lectores de pantalla solo anuncian
          cambios de texto en una región que ya existía, no una que aparece. */}
      <p role="status" className="sr-only">
        {status === 'loading' ? t('generating') : ''}
      </p>

      {status === 'loading' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" aria-hidden="true">
          {SKELETON_KEYS.map((i) => (
            <div key={i} className="animate-pulse bg-surface-elevated rounded-card aspect-[2/3]" />
          ))}
        </div>
      )}

      {status === 'empty' && (
        <div className="bg-surface-default border border-surface-border rounded-card p-6 flex flex-col items-center gap-3 text-center">
          <span className="text-3xl">✦</span>
          <div>
            <p className="font-body text-sm font-medium text-text-primary">{t('needMoreItems')}</p>
            <p className="font-body text-xs text-text-tertiary mt-1">{t('needMoreItemsHint')}</p>
          </div>
          <KButton asChild size="sm">
            <Link href="/discover">{t('exploreContent')}</Link>
          </KButton>
        </div>
      )}

      {/* Primera impresión de una cuenta nueva (E-INICIO-ARRANQUE): lo popular
          ahora mismo, un título de cada formato, con el cartel diciendo lo que
          es —no lo elige la IA para ti— y una línea que explica cómo llegar a
          las recomendaciones de verdad. */}
      {status === 'starter' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {starter.map((item) => (
              <MediaCard key={item.id} item={item} showType />
            ))}
          </div>
          <p className="font-body text-sm text-text-secondary">
            {t('starterHint')}{' '}
            <Link href="/discover" className="font-bold text-accent-pink hover:underline">
              {t('exploreContent')}
            </Link>
          </p>
        </div>
      )}

      {(status === 'rate_limited' || status === 'error') && (
        <div className="bg-surface-default border border-surface-border rounded-card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-medium text-text-primary">
              {status === 'rate_limited' ? t('rateLimited') : t('error')}
            </p>
            <p className="font-body text-xs text-text-tertiary mt-0.5">{t('tryAgainLater')}</p>
          </div>
          <KButton variant="secondary" size="sm" onClick={fetchRecs} className="flex-shrink-0">
            {t('retry')}
          </KButton>
        </div>
      )}

      {status === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {recs.map((rec) => {
              // Sin explicación del modelo se pinta el porqué localizado a partir
              // de datos reales (los géneros del ítem), igual que la ficha; sin
              // géneros no hay frase honesta que construir → solo la card.
              const genres = (rec.item.genres ?? []).slice(0, 2)
              const why = rec.reason ??
                (genres.length > 0
                  ? t('whyRecommendedText', { genres: genres.join(', ') })
                  : null)

              return (
                <div key={rec.item.id} className="flex flex-col gap-2">
                  {/* Misma card que Descubrir/Biblioteca: enlaza a la ficha real
                      por externalId. E-MATCH-SIN-BADGE: el match sigue siendo el
                      criterio con el que se elige cada recomendación, pero ya no
                      se pinta como etiqueta. */}
                  <MediaCard item={rec.item} showType />
                  {/* Sin recorte a propósito: con `line-clamp-3` la tercera
                      línea se cortaba por la MITAD de los glifos (visto en
                      Inicio), y una frase truncada a medio carácter es peor que
                      una card un poco más alta. El largo se controla en origen
                      —el prompt pide máx. 100 caracteres— no aquí. */}
                  {why && (
                    <p className="font-body text-xs text-text-secondary leading-relaxed">
                      {why}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {/* Por qué no cambian al volver: valen para todo el día. Con el tope
              diario alcanzado se dice que hoy van sin explicación de la IA.
              Si el modelo falló no se guardaron: no se promete nada. */}
          {(capped || saved) && (
            <p className="font-body text-xs text-text-tertiary">
              {capped ? t('cappedNote') : t('dailyNote')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
