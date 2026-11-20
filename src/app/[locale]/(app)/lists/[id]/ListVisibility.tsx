'use client'

import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ShareLinkButton } from '@/components/social/ShareLinkButton'

interface ListVisibilityProps {
  isPublic: boolean
  onChange: (value: string) => void
  /** Ruta pública de la lista; sin ella no se ofrece compartir. */
  publicPath: string | null
  listName: string
}

/** Privada / pública, el enlace para compartir y la explicación (solo el dueño). */
export function ListVisibility({ isPublic, onChange, publicPath, listName }: ListVisibilityProps) {
  const tcol = useTranslations('collection')

  return (
    <>
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <SegmentedControl
          ariaLabel={tcol('visibility')}
          value={isPublic ? 'public' : 'private'}
          onChange={onChange}
          options={[
            { value: 'private', label: tcol('private') },
            { value: 'public', label: tcol('public') },
          ]}
        />
        {isPublic && publicPath && (
          <ShareLinkButton path={publicPath} title={listName} label={tcol('share')} />
        )}
      </div>
      <p className="text-meta text-text-tertiary mt-2">
        {isPublic ? tcol('publicHint') : tcol('privateHint')}
      </p>
    </>
  )
}
