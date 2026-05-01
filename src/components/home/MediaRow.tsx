'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'

export interface MediaRowItem {
  mediaId: string
  title: string
  poster?: string | null
  type: string
}

interface MediaRowProps {
  items: MediaRowItem[]
  title: string
  emptyMessage?: string
  emptyAction?: { label: string; href: string }
  isLoading?: boolean
}

const SKELETONS = [0, 1, 2, 3, 4]

export function MediaRow({ items, title, emptyMessage, emptyAction, isLoading }: MediaRowProps) {
  if (!isLoading && items.length === 0 && !emptyMessage) return null

  return (
    <section>
      <h2 className="font-display text-xl mb-3">{title}</h2>

      {isLoading && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {SKELETONS.map((i) => (
            <div
              key={i}
              className="w-24 md:w-32 flex-shrink-0 animate-pulse bg-surface2 rounded-lg aspect-[2/3]"
            />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && emptyMessage && (
        <div className="bg-surface border border-border rounded-xl p-5 text-center flex flex-col gap-2">
          <p className="text-sm text-muted">{emptyMessage}</p>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className="mx-auto text-sm font-semibold text-accent hover:underline"
            >
              {emptyAction.label}
            </Link>
          )}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((item) => {
            const externalId = item.mediaId.split('_').slice(1).join('_')
            const href = `/media/${item.type}/${externalId}`
            return (
              <Link
                key={item.mediaId}
                href={href}
                className="w-24 md:w-32 flex-shrink-0 cursor-pointer group"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface2 relative">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      sizes="(max-width: 768px) 96px, 128px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl text-muted">🎬</span>
                    </div>
                  )}
                </div>
                <p className="text-xs mt-1 line-clamp-2 text-muted-light leading-tight">
                  {item.title}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
