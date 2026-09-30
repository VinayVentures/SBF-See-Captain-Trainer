/**
 * Local persistence — abstracted behind an interface so Milestone F can
 * drop in a Supabase-backed implementation without UI changes.
 *
 * Also migrates the pre-refactor `sbfState` localStorage key into the new
 * versioned `sbf.v1` shape on first read.
 */

export interface UserState {
  xp: number
  answered: number
  correct: number
  wrong: Record<number, number>
  notes: Record<number, string>
  streakDays: number
  mocks: number[]
  knotsMastered: Record<number, boolean>
}

export interface Persisted {
  version: 1
  state: UserState
}

const KEY = 'sbf.v1'
const LEGACY_KEY = 'sbfState'

export function loadState(): UserState {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed.version === 1 && parsed.state) return parsed.state
    } catch {
      // fall through to legacy migration / defaults
    }
  }
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy) {
    try {
      const s = JSON.parse(legacy) as {
        xp?: number
        n?: number
        ok?: number
        wrong?: Record<number, number>
        notes?: Record<number, string>
        streak?: number
        mocks?: number[]
        knots?: Record<number, boolean>
      }
      const migrated: UserState = {
        xp: s.xp ?? 0,
        answered: s.n ?? 0,
        correct: s.ok ?? 0,
        wrong: s.wrong ?? {},
        notes: s.notes ?? {},
        streakDays: s.streak ?? 1,
        mocks: s.mocks ?? [],
        knotsMastered: s.knots ?? {},
      }
      saveState(migrated)
      return migrated
    } catch {
      /* ignore */
    }
  }
  return {
    xp: 0,
    answered: 0,
    correct: 0,
    wrong: {},
    notes: {},
    streakDays: 1,
    mocks: [],
    knotsMastered: {},
  }
}

export function saveState(state: UserState): void {
  const p: Persisted = { version: 1, state }
  localStorage.setItem(KEY, JSON.stringify(p))
}
