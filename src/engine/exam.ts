/**
 * Mock exam skeleton (spec §14), now per-licence-mode.
 *
 * The generator draws the per-mode composition from `MOCK_COMPOSITION` in
 * services/mode.ts. Section thresholds are "5 of 7" for Basis and ~78% of
 * each specific section, matching the ELWIS pass rules.
 */

import type { NavTemplate, OfficialQuestion } from '../data/types'
import type { Mode } from '../data/types'
import { MOCK_COMPOSITION } from '../services/mode'

export interface MockPaper {
  mode: Mode
  basis: OfficialQuestion[]
  /** mode's main specific section (See-specific, Binnen-specific) */
  specific: OfficialQuestion[]
  /** See mode: nav templates. Binnen-Segeln: Segeln-specific questions. Absent on Binnen-Motor. */
  navigation: NavTemplate[]
  segeln: OfficialQuestion[]
}

export const MOCK_DURATION_MINUTES = 60

/** Pass threshold = ceil(5/7 · count). Matches ELWIS "5 of 7 / 18 of 23 / 7 of 9" rule. */
function threshold(count: number): number {
  return Math.ceil((5 / 7) * count)
}

export interface MockCounts {
  basis: number
  specific: number
  navigation: number
  segeln: number
}

export interface MockThresholds {
  basis: number
  specific: number
  navigation: number
  segeln: number
}

export function countsFor(mode: Mode): MockCounts {
  const c = MOCK_COMPOSITION[mode]
  return {
    basis: c.basis,
    specific: c.specific,
    navigation: c.navigation ?? 0,
    segeln: c.segeln ?? 0,
  }
}

export function thresholdsFor(mode: Mode): MockThresholds {
  const c = countsFor(mode)
  return {
    basis: threshold(c.basis),
    specific: threshold(c.specific),
    navigation: c.navigation ? threshold(c.navigation) : 0,
    segeln: c.segeln ? threshold(c.segeln) : 0,
  }
}

/** The ELWIS-published specific-section category for a given mode. */
export function specificCategoryFor(mode: Mode): OfficialQuestion['category'] {
  if (mode === 'see') return 'see'
  return 'binnen'
}

export interface MockScore {
  basis: number
  specific: number
  navigation: number
  segeln: number
}

export interface MockResult {
  passed: boolean
  passedBasis: boolean
  passedSpecific: boolean
  passedNavigation: boolean
  passedSegeln: boolean
  score: MockScore
}

export function generateMock(
  mode: Mode,
  questions: readonly OfficialQuestion[],
  navTemplates: readonly NavTemplate[],
  rng: () => number = Math.random,
): MockPaper {
  const counts = countsFor(mode)
  const specificCat = specificCategoryFor(mode)
  const basisPool = questions.filter((q) => q.category === 'basis')
  const specificPool = questions.filter((q) => q.category === specificCat)
  const segelnPool = questions.filter((q) => q.category === 'segeln')
  return {
    mode,
    basis: sample(basisPool, counts.basis, rng),
    specific: sample(specificPool, counts.specific, rng),
    navigation: counts.navigation
      ? sample(navTemplates, counts.navigation, rng)
      : [],
    segeln: counts.segeln ? sample(segelnPool, counts.segeln, rng) : [],
  }
}

export function evaluate(mode: Mode, score: MockScore): MockResult {
  const thr = thresholdsFor(mode)
  const counts = countsFor(mode)
  const passedBasis = score.basis >= thr.basis
  const passedSpecific = score.specific >= thr.specific
  // Sections that don't exist in this mode are considered passed vacuously.
  const passedNavigation = counts.navigation === 0 || score.navigation >= thr.navigation
  const passedSegeln = counts.segeln === 0 || score.segeln >= thr.segeln
  return {
    passed: passedBasis && passedSpecific && passedNavigation && passedSegeln,
    passedBasis,
    passedSpecific,
    passedNavigation,
    passedSegeln,
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
