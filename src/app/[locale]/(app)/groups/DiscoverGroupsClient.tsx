'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FilterBar, type FilterGroup } from '@/components/ui/FilterBar'
import { GroupCard, type GroupCardData } from '@/components/social/GroupCard'
import { KButton } from '@/components/ui/KButton'
import { F0 } from '@/lib/design/f0-tokens'

const PAGE_SIZE = 50

// Las labels UI dicen "Ya soy miembro"/"No soy miembro" pero el API usa joined/unjoined.
type Scope = 'all' | 'joined' | 'unjoined'
type Size = 'all' | 'small' | 'medium' | 'large'

export function DiscoverGroupsClient() {
  const t = useTranslations('groups')
  const tF = useTranslations('filters')

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [size, setSize] = useState<Size>('all')

  const [groups, setGroups] = useState<GroupCardData[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch helper: offset 0 reemplaza resultados; >0 los concatena (cargar más).
  async function fetchGroups(currentOffset: number, replace: boolean) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      params.set('scope', scope)
      params.set('size', size)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(currentOffset))

      const res = await fetch(`/api/groups/discover?${params.toString()}`)
      if (res.ok) {
        const data: { groups: GroupCardData[] } = await res.json()
        const next = data.groups ?? []
        setGroups(prev => (replace ? next : [...prev, ...next]))
        setHasMore(next.length === PAGE_SIZE)
      }
    } catch {
      if (replace) setGroups([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  // Debounce 400ms sobre query/scope/size → reset offset y recarga.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      fetchGroups(0, true)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, scope, size])

  function handleLoadMore() {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    fetchGroups(nextOffset, false)
  }

  const filterGroups: FilterGroup[] = [
    {
      key: 'scope',
      label: tF('scope'),
      options: [
        { value: 'joined', label: tF('scopeMember') },
        { value: 'unjoined', label: tF('scopeNonMember') },
      ],
    },
    {
      key: 'size',
      label: tF('size'),
      options: [
        { value: 'small', label: tF('size_1_10') },
        { value: 'medium', label: tF('size_11_50') },
        { value: 'large', label: tF('size_50plus') },
      ],
    },
  ]

  const activeFilters: Record<string, string> = { scope, size }

  function handleFilterChange(key: string, raw: string | string[]) {
    // Solo grupos single (string) en esta pantalla.
    const value = Array.isArray(raw) ? (raw[0] ?? '') : raw
    if (key === 'scope') setScope(value as Scope)
    else if (key === 'size') setSize(value as Size)
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full rounded-2xl border-2 px-4 py-2.5 text-sm placeholder:opacity-60 focus:outline-none focus:ring-2 focus-visible:ring-[oklch(68%_0.24_350)]"
        style={{ background: F0.surface2, borderColor: F0.stroke, color: F0.text }}
      />

      {/* Filtros sticky bajo el header de la app (h-14), como DiscoverClient */}
      <div
        className="sticky top-14 z-30 backdrop-blur-sm border-b py-3 px-4 -mx-4"
        style={{ background: `color-mix(in oklch, ${F0.bg} 95%, transparent)`, borderColor: F0.stroke }}
      >
        <FilterBar
          groups={filterGroups}
          activeFilters={activeFilters}
          onChange={handleFilterChange}
        />
      </div>

      {loaded && groups.length === 0 ? (
        <div className="rounded-bento border p-8 text-center" style={{ background: F0.surface, borderColor: F0.stroke }}>
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm" style={{ color: F0.textSecondary }}>{t('noGroupsFound')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(g => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <KButton
            size="md"
            variant="secondary"
            loading={loading}
            disabled={loading}
            onClick={handleLoadMore}
            className="rounded-full font-bold border-2"
            style={{ borderColor: F0.stroke, color: F0.textSecondary }}
          >
            {loading ? '...' : t('loadMore')}
          </KButton>
        </div>
      )}
    </div>
  )
}
