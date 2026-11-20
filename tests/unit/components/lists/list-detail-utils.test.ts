// ============================================================
// KULTURA — Listas: utilidades puras del detalle (list-detail-utils).
// ============================================================

import { describe, it, expect } from 'vitest'
import { invitableFriends, publicListPath } from '@/app/[locale]/(app)/lists/[id]/list-detail-utils'
import type { ListMember } from '@/types/list'

const friend = (id: string) => ({ id, username: id, avatarColor: 'pink', avatarInitials: id.slice(0, 2) })

describe('invitableFriends', () => {
  it('excluye al dueño y a quien ya es miembro, y respeta el orden', () => {
    const members = [{ listId: 'l1', userId: 'u2' }, { listId: 'l1', userId: 'u4' }] as ListMember[]
    const friends = [friend('u1'), friend('u2'), friend('u3'), friend('u4'), friend('u5')]
    expect(invitableFriends(members, 'u1', friends).map((f) => f.id)).toEqual(['u3', 'u5'])
  })

  it('sin miembros solo quita al dueño', () => {
    expect(invitableFriends([], 'u1', [friend('u1'), friend('u2')]).map((f) => f.id)).toEqual(['u2'])
  })
})

describe('publicListPath', () => {
  it('ruta pública con el usuario del dueño', () => {
    expect(publicListPath({ id: 'l1', owner: { username: 'ana' } as never })).toBe('/u/ana/l/l1')
  })

  it('null sin dueño embebido', () => {
    expect(publicListPath({ id: 'l1', owner: undefined })).toBeNull()
  })
})
