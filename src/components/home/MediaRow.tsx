'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'

export interface MediaRowItem {
  mediaId: string
  title: string
  poster?: string | null
  type: string
  year?: number
  /** Match score real (F3a). Ausente = sin badge — nunca decorativo. */
}

interface MediaRowProps {
  items: MediaRowItem[]
  title: string
  emptyIcon?: string
  emptyMessage?: string
  emptyHint?: string
  emptyAction?: { label: string; href: string }
  isLoading?: boolean
}

const SKELETONS = [0, 1, 2, 3, 4]

export function MediaRow({ items, title, emptyIcon, emptyMessage, emptyHint, emptyAction, isLoading }: MediaRowProps) {
  if (!isLoading && items.length === 0 && !emptyMessage) return null

  return (
    <section>
      <h2 className="font-display text-xl font-bold mb-3 text-text-primary">{title}</h2>

      {isLoading && (
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {SKELETONS.map((i) => (
            <div
              key={i}
              className="w-28 md:w-36 flex-shrink-0 animate-pulse bg-surface-elevated rounded-bento aspect-[2/3]"
            />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && emptyMessage && (
        <div className="bg-surface-default border border-surface-border rounded-bento p-6 text-center flex flex-col items-center gap-3">
          {emptyIcon && <span className="text-3xl">{emptyIcon}</span>}
          <p className="font-body text-sm font-medium text-text-primary">{emptyMessage}</p>
          {emptyHint && <p className="font-body text-xs text-text-tertiary">{emptyHint}</p>}
          {emptyAction && (
            <KButton asChild size="sm">
              <Link href={emptyAction.href}>{emptyAction.label}</Link>
            </KButton>
          )}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((item) => {
            const externalId = item.mediaId.split('_').slice(1).join('_')
            const href = `/media/${item.type}/${externalId}`
            return (
              <Link
                key={item.mediaId}
                href={href}
                className="w-28 md:w-36 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative aspect-[2/3] rounded-bento overflow-hidden bg-surface-elevated">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 112px, 144px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl text-text-tertiary">◻</span>
                    </div>
                  )}
                </div>
                <p
                  className="font-display text-sm font-bold mt-2 line-clamp-2 text-text-primary leading-tight"
                  title={item.title}
                >
                  {item.title}
                </p>
                {item.year && (
                  <p className="font-body text-xs text-text-tertiary mt-0.5">{item.year}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
