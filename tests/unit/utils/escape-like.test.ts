import { describe, it, expect } from 'vitest'
import { escapeLikePattern } from '@/lib/utils/escape-like'

describe('escapeLikePattern', () => {
  it('escapa %, _ y la barra', () => {
    expect(escapeLikePattern(String.raw`100%_a\b`)).toBe(String.raw`100\%\_a\\b`)
  })
  it('deja igual el texto normal', () => {
    expect(escapeLikePattern('Film Club')).toBe('Film Club')
  })
})
