/**
 * Mock exam session — spec §14–15. Runs the 60-min exam with strict
 * lockdown, then produces a MockResult that flows into readiness.
 */

import type { Mode, NavTemplate, OfficialQuestion } from '../data/types'
import type { Permutation } from './randomiser'
import { newSessionSeed, permute } from './randomiser'
import {
  countsFor,
  generateMock,
  MOCK_DURATION_MINUTES,
  thresholdsFor,
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
  mode: Mode,
  questions: readonly OfficialQuestion[],
  navTemplates: readonly NavTemplate[],
  now: Date = new Date(),
  rng: () => number = Math.random,
): MockSession {
  const paper = generateMock(mode, questions, navTemplates, rng)
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
  correctByCategory: { basis: number; specific: number; navigation: number; segeln: number }
  totalByCategory: { basis: number; specific: number; navigation: number; segeln: number }
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
  const correctByCategory = { basis: 0, specific: 0, navigation: 0, segeln: 0 }
  const totalByCategory = { basis: 0, specific: 0, navigation: 0, segeln: 0 }
  const wrongMcqIds: number[] = []

  const gradeMcq = (
    questions: readonly OfficialQuestion[],
    bucket: 'basis' | 'specific' | 'segeln',
  ) => {
    for (const q of questions) {
      totalByCategory[bucket] += 1
      const displaySlot = session.answers[q.id]
      if (displaySlot === undefined) {
        wrongMcqIds.push(q.id)
        continue
      }
      const perm = permutationFor(session, q.id)
      const chosenIndex = perm[displaySlot]!
      if (chosenIndex === q.officialCorrectIndex) {
        correctByCategory[bucket] += 1
      } else {
        wrongMcqIds.push(q.id)
      }
    }
  }

  gradeMcq(session.paper.basis, 'basis')
  gradeMcq(session.paper.specific, 'specific')
  gradeMcq(session.paper.segeln, 'segeln')

  for (const t of session.paper.navigation) {
    totalByCategory.navigation += 1
    if (navSelfGrades[t.id]) correctByCategory.navigation += 1
  }

  const mode = session.paper.mode
  const counts = countsFor(mode)
  const thr = thresholdsFor(mode)

  const passedBasis = correctByCategory.basis >= thr.basis
  const passedSpecific = correctByCategory.specific >= thr.specific
  const passedNavigation = counts.navigation === 0
    || correctByCategory.navigation >= thr.navigation
  const passedSegeln = counts.segeln === 0
    || correctByCategory.segeln >= thr.segeln
  const passed = passedBasis && passedSpecific && passedNavigation && passedSegeln

  const totalCorrect = correctByCategory.basis + correctByCategory.specific
    + correctByCategory.navigation + correctByCategory.segeln
  const totalQ = counts.basis + counts.specific + counts.navigation + counts.segeln
  const overallPct = totalQ === 0 ? 0 : (totalCorrect / totalQ) * 100

  // MockRecord has an optional `navigation` field that we use to carry the
  // "third section" for the current mode: nav tasks on See, Segeln on
  // Binnen-Segeln, undefined on Binnen-Motor.
  const thirdCount = counts.navigation || counts.segeln
  const thirdCorrect = counts.navigation ? correctByCategory.navigation : correctByCategory.segeln

  const record: MockRecord = {
    at: now.toISOString(),
    score: {
      basis: correctByCategory.basis,
      specific: correctByCategory.specific,
      ...(thirdCount ? { navigation: thirdCorrect } : {}),
    },
    passed,
    passedBasis,
    passedSpecific,
    ...(thirdCount
      ? { passedNavigation: counts.navigation ? passedNavigation : passedSegeln }
      : {}),
    overallPct,
  }

  return { record, wrongMcqIds, correctByCategory, totalByCategory }
}
