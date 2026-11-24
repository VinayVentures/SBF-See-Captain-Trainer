/**
 * Local persistence — abstracted behind an interface so Milestone F can
 * drop in a Supabase-backed implementation without UI changes.
 *
 * Schema evolves via version numbers:
 *   v1: initial refactor (wrong queue as counter)
 *   v2: rich per-question state for SRS (Milestone C) + mock history +
 *       bookmarks. Migrates forward from v1 and from the pre-refactor
 *       `sbfState` key.
 *   v3: per-licence-mode isolation. Everything that was a single UserState
 *       in v2 (XP, streak, achievements, per-question mastery, mocks,
 *       notes) is now a per-mode UserState — a See learner and a Binnen
 *       learner share no state. v2 blobs migrate into modes.see.
 */

import { MODES, type Mode } from '../data/types'
import { currentMode } from './mode'

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
  /**
   * Section scores. `basis` is the shared basis section. `specific` is the
   * mode's main specific section (See-specific, Binnen-specific). `navigation`
   * carries the See navigation tasks on See mode, or the Segeln-specific
   * section on Binnen-Segeln mode. Undefined (not present) on Binnen-Motor
   * where there is no third section.
   */
  score: { basis: number; specific: number; navigation?: number }
  passed: boolean
  passedBasis: boolean
  passedSpecific: boolean
  passedNavigation?: boolean
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

export type ModeStates = Record<Mode, UserState>

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

interface PersistedV3 {
  version: 3
  modes: ModeStates
}

const KEY = 'sbf.v3'
const LEGACY_V2_KEY = 'sbf.v2'
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

function emptyModeStates(): ModeStates {
  return {
    see: emptyState(),
    'binnen-motor': emptyState(),
    'binnen-segeln': emptyState(),
  }
}

/**
 * Load the per-mode state blob from storage, migrating older schemas if
 * encountered. Pure read — safe to call repeatedly.
 */
function readModes(): ModeStates {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedV3
      if (parsed.version === 3 && parsed.modes) {
        return withModeDefaults(parsed.modes)
      }
    } catch {
      /* fall through */
    }
  }
  // v2 → v3: slot v2 single-state into modes.see, keep other modes empty.
  const v2 = localStorage.getItem(LEGACY_V2_KEY)
  if (v2) {
    try {
      const parsed = JSON.parse(v2) as PersistedV2
      if (parsed.version === 2 && parsed.state) {
        const modes = emptyModeStates()
        modes.see = withDefaults(parsed.state)
        writeModes(modes)
        return modes
      }
    } catch {
      /* fall through */
    }
  }
  const v1 = localStorage.getItem(LEGACY_V1_KEY)
  if (v1) {
    try {
      const parsed = JSON.parse(v1) as PersistedV1
      if (parsed.version === 1 && parsed.state) {
        const modes = emptyModeStates()
        modes.see = migrateV1(parsed.state)
        writeModes(modes)
        return modes
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
      const modes = emptyModeStates()
      modes.see = migrated
      writeModes(modes)
      return modes
    } catch {
      /* fall through */
    }
  }
  return emptyModeStates()
}

function writeModes(modes: ModeStates): void {
  const p: PersistedV3 = { version: 3, modes }
  localStorage.setItem(KEY, JSON.stringify(p))
}

function migrateV1(v1: PersistedV1['state']): UserState {
  const questions: Record<number, QuestionState> = {}
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
    mocks: [],
    knotsMastered: v1.knotsMastered,
    questions,
  }
}

function withDefaults(state: Partial<UserState>): UserState {
  const base = emptyState()
  const merged: UserState = {
    ...base,
    ...state,
    notes: state.notes ?? {},
    mocks: state.mocks ?? [],
    knotsMastered: state.knotsMastered ?? {},
    questions: state.questions ?? {},
  }
  // Migrate v2-era mock records: { score: { see, navigation }, passedSee }
  // → { score: { specific, navigation }, passedSpecific }.
  merged.mocks = merged.mocks.map((m) => {
    const raw = m as MockRecord & {
      score: { basis: number; specific?: number; see?: number; navigation?: number }
      passedSee?: boolean
      passedSpecific?: boolean
    }
    if (raw.score.specific !== undefined) return m
    return {
      at: raw.at,
      score: {
        basis: raw.score.basis,
        specific: raw.score.see ?? 0,
        navigation: raw.score.navigation,
      },
      passed: raw.passed,
      passedBasis: raw.passedBasis,
      passedSpecific: raw.passedSee ?? raw.passedSpecific ?? false,
      passedNavigation: raw.passedNavigation,
      overallPct: raw.overallPct,
    }
  })
  return merged
}

function withModeDefaults(modes: Partial<ModeStates>): ModeStates {
  const out = emptyModeStates()
  for (const m of MODES) {
    const slice = modes[m]
    if (slice) out[m] = withDefaults(slice)
  }
  return out
}

/**
 * Load the UserState for the currently active mode. Engines call this.
 */
export function loadState(): UserState {
  const modes = readModes()
  return modes[currentMode()]
}

/**
 * Persist the given UserState into the currently active mode's slice.
 * Other modes are left untouched.
 */
export function saveState(state: UserState): void {
  const modes = readModes()
  modes[currentMode()] = state
  writeModes(modes)
}

/** Backup/export path: read all three modes at once. */
export function loadAllModes(): ModeStates {
  return readModes()
}

/** Backup/import path: replace all three modes at once. */
export function saveAllModes(modes: ModeStates): void {
  writeModes(withModeDefaults(modes))
}

export function questionStateFor(state: UserState, id: number): QuestionState {
  return state.questions[id] ?? emptyQuestionState()
}
