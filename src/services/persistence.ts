/**
 * Local persistence — abstracted behind an interface so Milestone F can
 * drop in a Supabase-backed implementation without UI changes.
 *
 * Schema evolves via version numbers:
 *   v1: initial refactor (wrong queue as counter)
 *   v2: rich per-question state for SRS (Milestone C) + mock history +
 *       bookmarks. Migrates forward from v1 and from the pre-refactor
 *       `sbfState` key.
 */

export type MasteryState = 'unseen' | 'learning' | 'weak' | 'mastered'

export interface QuestionState {
  seen: number
  correct: number
  wrong: number
  correctStreak: number
  wrongStreak: number
  lastAt?: string
  dueAt?: string
  mastery: MasteryState
  bookmarked: boolean
}

export interface MockRecord {
  at: string
  score: { basis: number; see: number; navigation: number }
  passed: boolean
  passedBasis: boolean
  passedSee: boolean
  passedNavigation: boolean
  overallPct: number
}

export interface UserState {
  xp: number
  answered: number
  correct: number
  notes: Record<number, string>
  streakDays: number
  lastStreakDay?: string
  mocks: MockRecord[]
  knotsMastered: Record<number, boolean>
  questions: Record<number, QuestionState>
  windStreak?: number
  windStreakBest?: number
  achievements?: Record<string, string> // achievementId -> ISO date claimed
  dailyMissions?: {
    date: string
    progress: Record<string, number>
    claimed: Record<string, boolean>
    seed: number
    missionIds: string[]
  }
}

interface PersistedV1 {
  version: 1
  state: {
    xp: number
    answered: number
    correct: number
    wrong: Record<number, number>
    notes: Record<number, string>
    streakDays: number
    mocks: number[]
    knotsMastered: Record<number, boolean>
  }
}

interface PersistedV2 {
  version: 2
  state: UserState
}

const KEY = 'sbf.v2'
const LEGACY_V1_KEY = 'sbf.v1'
const LEGACY_PROTOTYPE_KEY = 'sbfState'

export function emptyQuestionState(): QuestionState {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    correctStreak: 0,
    wrongStreak: 0,
    mastery: 'unseen',
    bookmarked: false,
  }
}

function emptyState(): UserState {
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

export function loadState(): UserState {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedV2
      if (parsed.version === 2 && parsed.state) return withDefaults(parsed.state)
    } catch {
      /* fall through */
    }
  }
  const v1 = localStorage.getItem(LEGACY_V1_KEY)
  if (v1) {
    try {
      const parsed = JSON.parse(v1) as PersistedV1
      if (parsed.version === 1 && parsed.state) {
        const migrated = migrateV1(parsed.state)
        saveState(migrated)
        return migrated
      }
    } catch {
      /* fall through */
    }
  }
  const legacy = localStorage.getItem(LEGACY_PROTOTYPE_KEY)
  if (legacy) {
    try {
      const s = JSON.parse(legacy) as {
        xp?: number
        n?: number
        ok?: number
        wrong?: Record<number, number>
        notes?: Record<number, string>
        streak?: number
        knots?: Record<number, boolean>
      }
      const migrated = migrateV1({
        xp: s.xp ?? 0,
        answered: s.n ?? 0,
        correct: s.ok ?? 0,
        wrong: s.wrong ?? {},
        notes: s.notes ?? {},
        streakDays: s.streak ?? 1,
        mocks: [],
        knotsMastered: s.knots ?? {},
      })
      saveState(migrated)
      return migrated
    } catch {
      /* fall through */
    }
  }
  return emptyState()
}

function migrateV1(v1: PersistedV1['state']): UserState {
  const questions: Record<number, QuestionState> = {}
  // Represent v1 wrong queue as a "weak" state with wrongStreak = counter.
  for (const [idStr, count] of Object.entries(v1.wrong)) {
    const id = Number(idStr)
    const state = emptyQuestionState()
    state.seen = count
    state.wrong = count
    state.wrongStreak = 1
    state.mastery = 'weak'
    questions[id] = state
  }
  return {
    xp: v1.xp,
    answered: v1.answered,
    correct: v1.correct,
    notes: v1.notes,
    streakDays: v1.streakDays,
    mocks: [], // v1 mocks were just numbers, no per-mock detail; discard
    knotsMastered: v1.knotsMastered,
    questions,
  }
}

function withDefaults(state: Partial<UserState>): UserState {
  return {
    ...emptyState(),
    ...state,
    // ensure required nested objects exist
    notes: state.notes ?? {},
    mocks: state.mocks ?? [],
    knotsMastered: state.knotsMastered ?? {},
    questions: state.questions ?? {},
  }
}

export function saveState(state: UserState): void {
  const p: PersistedV2 = { version: 2, state }
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function questionStateFor(state: UserState, id: number): QuestionState {
  return state.questions[id] ?? emptyQuestionState()
}
