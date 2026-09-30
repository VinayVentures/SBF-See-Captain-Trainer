/**
 * Learning engine — Milestone C: SRS + mastery states + Bilge + bookmarks.
 *
 * Simple Leitner-box scheduling:
 *   - Each question has a "box" (correctStreak). Right answer → next box.
 *     Wrong answer → back to box 0.
 *   - Due interval doubles per box: 0 → 30min, 1 → 4h, 2 → 1d, 3 → 3d,
 *     4 → 7d, 5 → 14d, 6+ → 30d.
 *   - Mastery state derives from streak: 0 or 1 wrong recently = weak,
 *     3+ correct in a row = mastered, unseen = never answered.
 *
 * Learn queue priorities:
 *   1. Overdue questions (dueAt in the past) — SRS-scheduled review
 *   2. New/unseen questions
 *   3. Questions with due dates in the future, sorted by soonest
 */

import type { JoinedQuestion } from '../data/types'
import type { QuestionState, UserState } from '../services/persistence'
import { emptyQuestionState } from '../services/persistence'

export type MasteryState = QuestionState['mastery']

const BOX_INTERVALS_MS: readonly number[] = [
  30 * 60_000,               // box 0: 30 min
  4 * 60 * 60_000,           // box 1: 4h
  24 * 60 * 60_000,          // box 2: 1d
  3 * 24 * 60 * 60_000,      // box 3: 3d
  7 * 24 * 60 * 60_000,      // box 4: 7d
  14 * 24 * 60 * 60_000,     // box 5: 14d
  30 * 24 * 60 * 60_000,     // box 6+: 30d
]

export function intervalForStreak(streak: number): number {
  const clamped = Math.max(0, Math.min(BOX_INTERVALS_MS.length - 1, streak))
  return BOX_INTERVALS_MS[clamped]!
}

/**
 * Update per-question state after an answer. Returns the new state
 * (caller writes it back into UserState.questions[id]).
 */
export function updateQuestionState(
  prev: QuestionState | undefined,
  correct: boolean,
  now: Date = new Date(),
): QuestionState {
  const s: QuestionState = prev ? { ...prev } : emptyQuestionState()
  s.seen += 1
  s.lastAt = now.toISOString()

  if (correct) {
    s.correct += 1
    s.correctStreak += 1
    s.wrongStreak = 0
  } else {
    s.wrong += 1
    s.wrongStreak += 1
    s.correctStreak = 0
  }

  const streakForInterval = correct ? s.correctStreak : 0
  s.dueAt = new Date(now.getTime() + intervalForStreak(streakForInterval)).toISOString()

  s.mastery = deriveMastery(s)
  return s
}

function deriveMastery(s: QuestionState): MasteryState {
  if (s.seen === 0) return 'unseen'
  if (s.correctStreak >= 3) return 'mastered'
  if (s.wrongStreak > 0 || s.wrong > s.correct) return 'weak'
  return 'learning'
}

export function toggleBookmark(prev: QuestionState | undefined): QuestionState {
  const s = prev ? { ...prev } : emptyQuestionState()
  s.bookmarked = !s.bookmarked
  return s
}

export interface QuestionQueue {
  next(): JoinedQuestion | undefined
  peek(): JoinedQuestion | undefined
  remaining(): number
  total(): number
  position(): number
}

class ArrayQueue implements QuestionQueue {
  private i = 0
  constructor(private readonly items: readonly JoinedQuestion[]) {}
  next() {
    const q = this.items[this.i]
    if (q) this.i++
    return q
  }
  peek() {
    return this.items[this.i]
  }
  remaining() {
    return this.items.length - this.i
  }
  total() {
    return this.items.length
  }
  position() {
    return this.i
  }
}

export function learnQueue(
  all: readonly JoinedQuestion[],
  userState: UserState,
  now: Date = new Date(),
  rng: () => number = Math.random,
): QuestionQueue {
  const nowMs = now.getTime()
  const withState = all.map((q) => ({
    q,
    state: userState.questions[q.id],
  }))

  const overdue: typeof withState = []
  const unseen: typeof withState = []
  const future: typeof withState = []

  for (const item of withState) {
    if (!item.state || item.state.seen === 0) {
      unseen.push(item)
    } else if (item.state.dueAt && new Date(item.state.dueAt).getTime() <= nowMs) {
      overdue.push(item)
    } else {
      future.push(item)
    }
  }

  overdue.sort((a, b) => {
    const at = a.state?.dueAt ? new Date(a.state.dueAt).getTime() : 0
    const bt = b.state?.dueAt ? new Date(b.state.dueAt).getTime() : 0
    return at - bt
  })

  shuffle(unseen, rng)

  future.sort((a, b) => {
    const at = a.state?.dueAt ? new Date(a.state.dueAt).getTime() : 0
    const bt = b.state?.dueAt ? new Date(b.state.dueAt).getTime() : 0
    return at - bt
  })

  return new ArrayQueue(
    [...overdue, ...unseen, ...future].map((x) => x.q),
  )
}

export function bilgeQueue(
  all: readonly JoinedQuestion[],
  userState: UserState,
): QuestionQueue {
  const items = all.filter((q) => {
    const s = userState.questions[q.id]
    return s && (s.mastery === 'weak' || s.wrongStreak > 0)
  })
  items.sort((a, b) => {
    const sa = userState.questions[a.id]!
    const sb = userState.questions[b.id]!
    return sb.wrongStreak - sa.wrongStreak || sb.wrong - sa.wrong
  })
  return new ArrayQueue(items)
}

export function bookmarkedQueue(
  all: readonly JoinedQuestion[],
  userState: UserState,
): QuestionQueue {
  return new ArrayQueue(all.filter((q) => userState.questions[q.id]?.bookmarked))
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

export interface MasterySummary {
  unseen: number
  learning: number
  weak: number
  mastered: number
}

export function masterySummary(
  all: readonly JoinedQuestion[],
  userState: UserState,
): MasterySummary {
  const out: MasterySummary = { unseen: 0, learning: 0, weak: 0, mastered: 0 }
  for (const q of all) {
    const m = userState.questions[q.id]?.mastery ?? 'unseen'
    out[m] += 1
  }
  return out
}
