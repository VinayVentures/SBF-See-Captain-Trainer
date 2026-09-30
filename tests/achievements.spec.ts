import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  ALL_MISSIONS,
  checkAchievements,
  claimReadyMissions,
  ensureTodayMissions,
  recordMissionEvent,
  updateWindStreak,
} from '../src/engine/achievements'
import type { JoinedQuestion } from '../src/data/types'
import type { UserState } from '../src/services/persistence'

function mk(id: number, topic?: string): JoinedQuestion {
  return {
    id,
    category: 'basis',
    de: { question: '', answers: ['a', 'b', 'c', 'd'] as [string, string, string, string] },
    officialCorrectIndex: 0,
    source: { publisher: 'ELWIS', version: '2023-08-01' },
    app: { id, topic },
  }
}

function emptyState(): UserState {
  return {
    xp: 0, answered: 0, correct: 0, notes: {}, streakDays: 1,
    mocks: [], knotsMastered: {}, questions: {},
  }
}

describe('wind streak', () => {
  it('grows on correct, zeroes on wrong', () => {
    let s = updateWindStreak(0, true)
    expect(s.streak).toBe(1)
    s = updateWindStreak(s.streak, true)
    expect(s.streak).toBe(2)
    s = updateWindStreak(s.streak, false)
    expect(s.streak).toBe(0)
  })

  it('fires bonus XP at milestones 5, 10, 25, 50', () => {
    let s = { streak: 0, bonusXp: 0 } as { streak: number; bonusXp: number; crossedMilestone?: number }
    for (let i = 0; i < 5; i++) s = updateWindStreak(s.streak, true)
    expect(s.crossedMilestone).toBe(5)
    expect(s.bonusXp).toBeGreaterThan(0)
    for (let i = 0; i < 5; i++) s = updateWindStreak(s.streak, true)
    expect(s.crossedMilestone).toBe(10)
  })
})

describe('daily missions', () => {
  it('picks 3 missions per day', () => {
    const m = ensureTodayMissions(undefined, new Date('2026-01-15'))
    expect(m.missionIds).toHaveLength(3)
    expect(m.date).toBe('2026-01-15')
  })

  it('resets on new day', () => {
    const day1 = ensureTodayMissions(undefined, new Date('2026-01-15'))
    const day2 = ensureTodayMissions(day1, new Date('2026-01-16'))
    expect(day2.date).toBe('2026-01-16')
    // May pick different missions
    expect(day2).not.toBe(day1)
  })

  it('progresses on question_answered events', () => {
    let m = ensureTodayMissions(undefined, new Date('2026-01-15'))
    // Force at least one mission we know how to progress
    if (!m.missionIds.includes('answer_10_questions')) {
      m = { ...m, missionIds: ['answer_10_questions', ...m.missionIds.slice(1)],
        progress: { ...m.progress, answer_10_questions: 0 } as never,
        claimed: { ...m.claimed, answer_10_questions: false } as never }
    }
    for (let i = 0; i < 10; i++) {
      m = recordMissionEvent(m, { kind: 'question_answered', correct: true, wasUnseen: false, wasWeak: false })
    }
    expect(m.progress.answer_10_questions).toBe(10)
    const c = claimReadyMissions(m)
    const target = ALL_MISSIONS.find((x) => x.id === 'answer_10_questions')!
    expect(c.totalXp).toBeGreaterThanOrEqual(target.xpReward)
    expect(c.claimedIds).toContain('answer_10_questions')
  })
})

describe('achievements', () => {
  it('unlocks topic mastery when every question in the topic is mastered', () => {
    const qs = [mk(1, 'COLREG'), mk(2, 'COLREG'), mk(3, 'Weather')]
    const state = emptyState()
    for (const id of [1, 2]) {
      state.questions[id] = {
        seen: 3, correct: 3, wrong: 0, correctStreak: 3, wrongStreak: 0,
        mastery: 'mastered', bookmarked: false,
      }
    }
    const unlocked = checkAchievements(qs, state)
    expect(unlocked).toContain('colreg_master')
    expect(unlocked).not.toContain('navigation_officer')
  })

  it('unlocks catalogue_50 at 50%', () => {
    const qs = Array.from({ length: 10 }, (_, i) => mk(i + 1))
    const state = emptyState()
    for (let i = 1; i <= 5; i++) {
      state.questions[i] = {
        seen: 3, correct: 3, wrong: 0, correctStreak: 3, wrongStreak: 0,
        mastery: 'mastered', bookmarked: false,
      }
    }
    const unlocked = checkAchievements(qs, state)
    expect(unlocked).toContain('catalogue_50')
    expect(unlocked).not.toContain('catalogue_100')
  })

  it('unlocks first_mock_pass on first passed mock', () => {
    const state = emptyState()
    state.mocks = [{
      at: '2026-01-01', score: { basis: 7, see: 23, navigation: 9 },
      passed: true, passedBasis: true, passedSee: true, passedNavigation: true,
      overallPct: 100,
    }]
    const unlocked = checkAchievements([mk(1)], state)
    expect(unlocked).toContain('first_mock_pass')
  })

  it('unlocks knot_master when all 9 knots are mastered', () => {
    const state = emptyState()
    for (let i = 1; i <= 9; i++) state.knotsMastered[i] = true
    const unlocked = checkAchievements([mk(1)], state)
    expect(unlocked).toContain('knot_master')
  })

  it('does not unlock knot_master with 8/9', () => {
    const state = emptyState()
    for (let i = 1; i <= 8; i++) state.knotsMastered[i] = true
    const unlocked = checkAchievements([mk(1)], state)
    expect(unlocked).not.toContain('knot_master')
  })
})

describe('achievements coverage', () => {
  it('has all 8 achievements defined', () => {
    expect(ACHIEVEMENTS).toHaveLength(8)
  })
})
