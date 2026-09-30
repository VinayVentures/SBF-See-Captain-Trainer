/**
 * Real exam readiness — spec §13.
 *
 * Weights (sum to 1.0):
 *   - Catalogue mastery: 0.35 — how many of 285 the user has actually mastered
 *   - Bilge health: 0.10 — penalty for large weak queue
 *   - Recent mock performance: 0.35 — last 3 mocks average, thresholds count double
 *   - Recent accuracy: 0.10 — last 50 answered questions
 *   - App content coverage cap: 0.10 — never claim more readiness than
 *     the app content supports
 *
 * We cap the whole score at min(coverage.translatedPct, coverage.explainedPct)
 * so a user with 0% translated content can never see 100% ready.
 */

import type { JoinedQuestion } from '../data/types'
import type { UserState } from '../services/persistence'
import type { Coverage } from './coverage'
import { masterySummary } from './learning'

export interface ReadinessBreakdown {
  overall: number
  masteryPct: number
  bilgePct: number
  mockPct: number
  accuracyPct: number
  coverageCap: number
  masteredCount: number
  weakCount: number
  cappedByCoverage: boolean
}

export function computeReadiness(
  allQuestions: readonly JoinedQuestion[],
  userState: UserState,
  coverage: Coverage,
): ReadinessBreakdown {
  const summary = masterySummary(allQuestions, userState)
  const total = allQuestions.length || 1

  const masteryPct = (summary.mastered / total) * 100
  const bilgePct = Math.max(0, 100 - (summary.weak / total) * 400) // 25% weak → 0

  const recentMocks = userState.mocks.slice(-3)
  let mockPct = 0
  if (recentMocks.length > 0) {
    let sum = 0
    for (const m of recentMocks) {
      // Passed-all-thresholds carries double weight.
      const factor = m.passed ? 2 : 1
      sum += m.overallPct * factor
    }
    const denom = recentMocks.reduce((n, m) => n + (m.passed ? 2 : 1), 0)
    mockPct = sum / denom
  }

  const accuracyPct = userState.answered > 0
    ? (userState.correct / userState.answered) * 100
    : 0

  const raw =
    masteryPct * 0.35 +
    bilgePct * 0.10 +
    mockPct * 0.35 +
    accuracyPct * 0.10 +
    coverage.translatedPct * 0.05 +
    coverage.explainedPct * 0.05

  const coverageCap = Math.min(coverage.translatedPct, coverage.explainedPct)
  const cappedByCoverage = raw > coverageCap
  const overall = Math.round(Math.min(raw, coverageCap))

  return {
    overall,
    masteryPct,
    bilgePct,
    mockPct,
    accuracyPct,
    coverageCap,
    masteredCount: summary.mastered,
    weakCount: summary.weak,
    cappedByCoverage,
  }
}
