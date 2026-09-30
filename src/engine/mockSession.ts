/**
 * Mock exam session — spec §14–15. Runs the 60-min exam with strict
 * lockdown, then produces a MockResult that flows into readiness.
 */

import type { NavTemplate, OfficialQuestion } from '../data/types'
import type { Permutation } from './randomiser'
import { newSessionSeed, permute } from './randomiser'
import {
  generateMock,
  MOCK_COUNTS,
  MOCK_DURATION_MINUTES,
  MOCK_THRESHOLDS,
  type MockPaper,
} from './exam'
import type { MockRecord } from '../services/persistence'

export interface MockSession {
  paper: MockPaper
  seed: number
  startedAtMs: number
  deadlineMs: number
  /** display slot chosen by the user, keyed by catalogue question id */
  answers: Record<number, number | undefined>
  /** free-text nav answers, keyed by nav template id */
  navAnswers: Record<number, string>
  submitted: boolean
}

export function newMockSession(
  questions: readonly OfficialQuestion[],
  navTemplates: readonly NavTemplate[],
  now: Date = new Date(),
  rng: () => number = Math.random,
): MockSession {
  const paper = generateMock(questions, navTemplates, rng)
  const startedAtMs = now.getTime()
  return {
    paper,
    seed: newSessionSeed(),
    startedAtMs,
    deadlineMs: startedAtMs + MOCK_DURATION_MINUTES * 60_000,
    answers: {},
    navAnswers: {},
    submitted: false,
  }
}

export function permutationFor(session: MockSession, questionId: number): Permutation {
  return permute(questionId, session.seed)
}

export function timeRemainingMs(session: MockSession, now: Date = new Date()): number {
  return Math.max(0, session.deadlineMs - now.getTime())
}

export interface MockGradeResult {
  record: MockRecord
  wrongMcqIds: number[]
  correctByCategory: { basis: number; see: number; navigation: number }
  totalByCategory: { basis: number; see: number; navigation: number }
}

/**
 * Grade the MCQ sections; nav is self-graded via the `navSelfGrades`
 * map (id → correct?). Callers who don't have a nav answer key pass
 * an empty object; the UI presents nav answers back with a
 * "did you get this right?" checkbox instead.
 */
export function grade(
  session: MockSession,
  navSelfGrades: Record<number, boolean>,
  now: Date = new Date(),
): MockGradeResult {
  const correctByCategory = { basis: 0, see: 0, navigation: 0 }
  const totalByCategory = { basis: 0, see: 0, navigation: 0 }
  const wrongMcqIds: number[] = []

  for (const q of [...session.paper.basis, ...session.paper.see]) {
    totalByCategory[q.category] += 1
    const displaySlot = session.answers[q.id]
    if (displaySlot === undefined) {
      wrongMcqIds.push(q.id)
      continue
    }
    const perm = permutationFor(session, q.id)
    const chosenIndex = perm[displaySlot]!
    if (chosenIndex === q.officialCorrectIndex) {
      correctByCategory[q.category] += 1
    } else {
      wrongMcqIds.push(q.id)
    }
  }

  for (const t of session.paper.navigation) {
    totalByCategory.navigation += 1
    if (navSelfGrades[t.id]) correctByCategory.navigation += 1
  }

  const score = {
    basis: correctByCategory.basis,
    see: correctByCategory.see,
    navigation: correctByCategory.navigation,
  }
  const passedBasis = score.basis >= MOCK_THRESHOLDS.basis
  const passedSee = score.see >= MOCK_THRESHOLDS.see
  const passedNavigation = score.navigation >= MOCK_THRESHOLDS.navigation
  const passed = passedBasis && passedSee && passedNavigation

  const totalCorrect = score.basis + score.see + score.navigation
  const totalQ = MOCK_COUNTS.basis + MOCK_COUNTS.see + MOCK_COUNTS.navigation
  const overallPct = (totalCorrect / totalQ) * 100

  const record: MockRecord = {
    at: now.toISOString(),
    score,
    passed,
    passedBasis,
    passedSee,
    passedNavigation,
    overallPct,
  }

  return { record, wrongMcqIds, correctByCategory, totalByCategory }
}
