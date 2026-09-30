/**
 * Mock exam skeleton (spec §14).
 *
 * The generator draws 7 Basis + 23 See + 9 nav-template selections. This
 * lives in the codebase (with tests) even during Milestone A because we
 * want the engine to be correct before content is finished. The UI gates
 * the real mock exam behind coverage completion — see `engine/coverage.ts`
 * and `ui/screens/mock.ts`.
 */

import type { NavTemplate, OfficialQuestion } from '../data/types'

export interface MockPaper {
  basis: OfficialQuestion[]
  see: OfficialQuestion[]
  navigation: NavTemplate[]
}

export const MOCK_COUNTS = { basis: 7, see: 23, navigation: 9 } as const
export const MOCK_THRESHOLDS = { basis: 5, see: 18, navigation: 7 } as const
export const MOCK_DURATION_MINUTES = 60

export interface MockScore {
  basis: number
  see: number
  navigation: number
}

export interface MockResult {
  passed: boolean
  passedBasis: boolean
  passedSee: boolean
  passedNavigation: boolean
  score: MockScore
}

export function generateMock(
  questions: readonly OfficialQuestion[],
  navTemplates: readonly NavTemplate[],
  rng: () => number = Math.random,
): MockPaper {
  const basisPool = questions.filter((q) => q.category === 'basis')
  const seePool = questions.filter((q) => q.category === 'see')
  return {
    basis: sample(basisPool, MOCK_COUNTS.basis, rng),
    see: sample(seePool, MOCK_COUNTS.see, rng),
    navigation: sample(navTemplates, MOCK_COUNTS.navigation, rng),
  }
}

export function evaluate(score: MockScore): MockResult {
  const passedBasis = score.basis >= MOCK_THRESHOLDS.basis
  const passedSee = score.see >= MOCK_THRESHOLDS.see
  const passedNavigation = score.navigation >= MOCK_THRESHOLDS.navigation
  return {
    passed: passedBasis && passedSee && passedNavigation,
    passedBasis,
    passedSee,
    passedNavigation,
    score,
  }
}

function sample<T>(pool: readonly T[], k: number, rng: () => number): T[] {
  if (pool.length < k) {
    throw new Error(
      `sample: pool size ${pool.length} smaller than requested ${k}`,
    )
  }
  const copy = pool.slice()
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (copy.length - i))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy.slice(0, k)
}
