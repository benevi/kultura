// ============================================================
// KULTURA — La biblioteca cambió: recomendaciones y match score se recalculan
// ============================================================

import 'server-only'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'

export function invalidateLibraryCaches(userId: string): void {
  invalidateRecCache(userId)
  invalidateMatchScoreCache(userId)
}
