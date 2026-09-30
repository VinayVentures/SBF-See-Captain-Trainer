import { describe, expect, it } from 'vitest'
import { computeReadiness } from '../src/engine/readiness'
import type { JoinedQuestion } from '../src/data/types'
import type { UserState } from '../src/services/persistence'
import type { Coverage } from '../src/engine/coverage'

function mkCatalogue(n: number): JoinedQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    category: 'basis' as const,
    de: { question: '', answers: ['a', 'b', 'c', 'd'] as [string, string, string, string] },
    officialCorrectIndex: 0 as const,
    source: { publisher: 'ELWIS' as const, version: '2023-08-01' },
    app: { id: i + 1 },
  }))
}

function fullCoverage(total: number): Coverage {
  return {
    officialTotal: total,
    translated: total,
    explained: total,
    translatedPct: 100,
    explainedPct: 100,
    isExamReady: true,
  }
}

function emptyState(): UserState {
  return {
    xp: 0, answered: 0, correct: 0, notes: {}, streakDays: 1,
    mocks: [], knotsMastered: {}, questions: {},
  }
}

describe('readiness', () => {
  it('low but nonzero on empty state with full coverage', () => {
    const r = computeReadiness(mkCatalogue(10), emptyState(), fullCoverage(10))
    // coverage=100 contributes 10, empty bilge contributes ~10, mastery/mock/accuracy are 0.
    expect(r.overall).toBeGreaterThan(0)
    expect(r.overall).toBeLessThan(30)
  })

  it('caps at coverage: 0% translated → 0% readiness even at 100% mastery', () => {
    const qs = mkCatalogue(10)
    const state = emptyState()
    for (const q of qs) {
      state.questions[q.id] = {
        seen: 3, correct: 3, wrong: 0, correctStreak: 3, wrongStreak: 0,
        mastery: 'mastered', bookmarked: false,
      }
    }
    state.answered = 30
    state.correct = 30
    const zeroCov: Coverage = {
      officialTotal: 10, translated: 0, explained: 0,
      translatedPct: 0, explainedPct: 0, isExamReady: false,
    }
    const r = computeReadiness(qs, state, zeroCov)
    expect(r.overall).toBe(0)
    expect(r.cappedByCoverage).toBe(true)
  })

  it('rewards mock passes double', () => {
    const qs = mkCatalogue(10)
    const state = emptyState()
    state.mocks = [
      { at: '2026-01-01', score: { basis: 7, see: 23, navigation: 9 },
        passed: true, passedBasis: true, passedSee: true, passedNavigation: true,
        overallPct: 100 },
    ]
    const r = computeReadiness(qs, state, fullCoverage(10))
    expect(r.mockPct).toBe(100)
  })
})
