import { describe, expect, it } from 'vitest'
import {
  bilgeQueue,
  bookmarkedQueue,
  intervalForStreak,
  learnQueue,
  masterySummary,
  toggleBookmark,
  updateQuestionState,
} from '../src/engine/learning'
import type { JoinedQuestion } from '../src/data/types'
import type { UserState } from '../src/services/persistence'

function mkQuestion(id: number, category: 'basis' | 'see' = 'basis'): JoinedQuestion {
  return {
    id,
    category,
    de: {
      question: `Q${id}`,
      answers: ['a', 'b', 'c', 'd'],
    },
    officialCorrectIndex: 0,
    source: { publisher: 'ELWIS', version: '2023-08-01' },
    app: { id },
  }
}

function emptyUserState(): UserState {
  return {
    xp: 0,
    answered: 0,
    correct: 0,
    notes: {},
    streakDays: 1,
    mocks: [],
    knotsMastered: {},
    questions: {},
  }
}

describe('updateQuestionState', () => {
  it('starts in "learning" after first correct answer', () => {
    const s = updateQuestionState(undefined, true, new Date('2026-01-01'))
    expect(s.seen).toBe(1)
    expect(s.correct).toBe(1)
    expect(s.correctStreak).toBe(1)
    expect(s.mastery).toBe('learning')
    expect(s.dueAt).toBeDefined()
  })

  it('marks "mastered" after 3 consecutive correct', () => {
    let s = updateQuestionState(undefined, true, new Date('2026-01-01'))
    s = updateQuestionState(s, true, new Date('2026-01-02'))
    s = updateQuestionState(s, true, new Date('2026-01-03'))
    expect(s.mastery).toBe('mastered')
    expect(s.correctStreak).toBe(3)
  })

  it('marks "weak" after a wrong answer and resets streak', () => {
    let s = updateQuestionState(undefined, true, new Date('2026-01-01'))
    s = updateQuestionState(s, true, new Date('2026-01-02'))
    s = updateQuestionState(s, false, new Date('2026-01-03'))
    expect(s.correctStreak).toBe(0)
    expect(s.wrongStreak).toBe(1)
    expect(s.mastery).toBe('weak')
  })

  it('interval grows with correct streak', () => {
    expect(intervalForStreak(0)).toBeLessThan(intervalForStreak(3))
    expect(intervalForStreak(3)).toBeLessThan(intervalForStreak(6))
  })
})

describe('bookmark toggle', () => {
  it('flips bookmarked', () => {
    const a = toggleBookmark(undefined)
    expect(a.bookmarked).toBe(true)
    const b = toggleBookmark(a)
    expect(b.bookmarked).toBe(false)
  })
})

describe('learn queue priority', () => {
  it('puts overdue before unseen before future', () => {
    const q1 = mkQuestion(1) // overdue
    const q2 = mkQuestion(2) // unseen
    const q3 = mkQuestion(3) // future
    const state = emptyUserState()
    const now = new Date('2026-01-15')
    state.questions[1] = updateQuestionState(undefined, true, new Date('2025-12-01')) // due long ago
    state.questions[3] = updateQuestionState(undefined, true, new Date('2026-01-14T23:59')) // due in future
    // Manually push due of q1 to well before now
    state.questions[1]!.dueAt = new Date('2025-12-02').toISOString()
    // ensure q3 due is in future
    state.questions[3]!.dueAt = new Date('2026-02-01').toISOString()
    const q = learnQueue([q1, q2, q3], state, now)
    const ids: number[] = []
    for (;;) {
      const n = q.next()
      if (!n) break
      ids.push(n.id)
    }
    expect(ids).toEqual([1, 2, 3])
  })
})

describe('bilge and bookmarks queues', () => {
  it('bilge returns only weak or currently-wrong questions', () => {
    const [q1, q2, q3] = [mkQuestion(1), mkQuestion(2), mkQuestion(3)]
    const state = emptyUserState()
    state.questions[1] = updateQuestionState(undefined, false)
    state.questions[2] = updateQuestionState(undefined, true)
    state.questions[2] = updateQuestionState(state.questions[2], true)
    state.questions[2] = updateQuestionState(state.questions[2], true)
    // q3 never seen
    const bq = bilgeQueue([q1, q2, q3], state)
    expect(bq.total()).toBe(1)
    expect(bq.peek()?.id).toBe(1)
  })

  it('bookmarks queue returns only bookmarked', () => {
    const [q1, q2] = [mkQuestion(1), mkQuestion(2)]
    const state = emptyUserState()
    state.questions[2] = toggleBookmark(undefined)
    const bq = bookmarkedQueue([q1, q2], state)
    expect(bq.total()).toBe(1)
    expect(bq.peek()?.id).toBe(2)
  })
})

describe('mastery summary', () => {
  it('categorises correctly', () => {
    const qs = [mkQuestion(1), mkQuestion(2), mkQuestion(3), mkQuestion(4)]
    const state = emptyUserState()
    // q1: mastered
    state.questions[1] = updateQuestionState(undefined, true)
    state.questions[1] = updateQuestionState(state.questions[1], true)
    state.questions[1] = updateQuestionState(state.questions[1], true)
    // q2: weak
    state.questions[2] = updateQuestionState(undefined, false)
    // q3: learning
    state.questions[3] = updateQuestionState(undefined, true)
    // q4: unseen
    const s = masterySummary(qs, state)
    expect(s.mastered).toBe(1)
    expect(s.weak).toBe(1)
    expect(s.learning).toBe(1)
    expect(s.unseen).toBe(1)
  })
})
