/**
 * Persistence v3 behavior: per-mode isolation + legacy-blob migration + backup round-trip.
 *
 * These tests use a lightweight in-memory localStorage polyfill (vitest runs
 * in node, no DOM). Each test resets the store and the mode module's cached
 * state so the modules behave as if freshly loaded.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null }
  getItem(k: string) { return this.store.get(k) ?? null }
  setItem(k: string, v: string) { this.store.set(k, String(v)) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
}

;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()

async function loadFreshModules() {
  // Reset ESM module cache so services/mode re-reads its `current` variable
  // from the (freshly set) localStorage, instead of using a cached value.
  vi.resetModules()
  return {
    mode: await import('../src/services/mode'),
    persistence: await import('../src/services/persistence'),
    backup: await import('../src/services/backup'),
  }
}

function emptyUserStateShape() {
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

describe('persistence v3: per-mode isolation', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear()
  })

  it('writing in one mode does not mutate other modes', async () => {
    const { mode, persistence } = await loadFreshModules()

    mode.setMode('see')
    const seeState = persistence.loadState()
    seeState.xp = 500
    seeState.questions[17] = {
      seen: 3, correct: 3, wrong: 0, correctStreak: 3, wrongStreak: 0,
      mastery: 'mastered', bookmarked: false,
    }
    persistence.saveState(seeState)

    mode.setMode('binnen-motor')
    const binnenState = persistence.loadState()
    expect(binnenState.xp).toBe(0)
    expect(binnenState.questions).toEqual({})

    mode.setMode('binnen-segeln')
    const segelnState = persistence.loadState()
    expect(segelnState.xp).toBe(0)
    expect(segelnState.questions).toEqual({})

    // Back to See — the earlier state is still there, untouched.
    mode.setMode('see')
    const seeReload = persistence.loadState()
    expect(seeReload.xp).toBe(500)
    expect(seeReload.questions[17]?.mastery).toBe('mastered')
  })

  it('answering in Binnen-Motor does not leak into See or Binnen-Segeln', async () => {
    const { mode, persistence } = await loadFreshModules()

    mode.setMode('binnen-motor')
    const bm = persistence.loadState()
    bm.xp = 42
    bm.answered = 10
    bm.correct = 8
    persistence.saveState(bm)

    mode.setMode('see')
    expect(persistence.loadState().xp).toBe(0)
    mode.setMode('binnen-segeln')
    expect(persistence.loadState().xp).toBe(0)
    mode.setMode('binnen-motor')
    expect(persistence.loadState().xp).toBe(42)
  })
})

describe('persistence v2 → v3 migration', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear()
  })

  it('v2 blob under sbf.v2 migrates into modes.see; Binnen modes start empty', async () => {
    const v2State = {
      ...emptyUserStateShape(),
      xp: 1234,
      answered: 50,
      correct: 40,
      questions: {
        1: {
          seen: 5, correct: 5, wrong: 0, correctStreak: 5, wrongStreak: 0,
          mastery: 'mastered', bookmarked: false,
        },
      },
    }
    ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage
      .setItem('sbf.v2', JSON.stringify({ version: 2, state: v2State }))

    const { mode, persistence } = await loadFreshModules()

    mode.setMode('see')
    const see = persistence.loadState()
    expect(see.xp).toBe(1234)
    expect(see.answered).toBe(50)
    expect(see.questions[1]?.mastery).toBe('mastered')

    mode.setMode('binnen-motor')
    const bm = persistence.loadState()
    expect(bm.xp).toBe(0)
    expect(bm.questions).toEqual({})

    mode.setMode('binnen-segeln')
    const bs = persistence.loadState()
    expect(bs.xp).toBe(0)
    expect(bs.questions).toEqual({})
  })

  it('migrated v2 mock records get score.see renamed to score.specific', async () => {
    const v2State = {
      ...emptyUserStateShape(),
      mocks: [
        {
          at: '2026-01-01T00:00:00.000Z',
          score: { basis: 7, see: 23, navigation: 9 },
          passed: true,
          passedBasis: true,
          passedSee: true,
          passedNavigation: true,
          overallPct: 100,
        },
      ],
    }
    ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage
      .setItem('sbf.v2', JSON.stringify({ version: 2, state: v2State }))

    const { mode, persistence } = await loadFreshModules()
    mode.setMode('see')
    const see = persistence.loadState()
    expect(see.mocks).toHaveLength(1)
    const m = see.mocks[0]!
    expect(m.score.specific).toBe(23)
    expect(m.score.basis).toBe(7)
    expect(m.score.navigation).toBe(9)
    expect(m.passedSpecific).toBe(true)
    expect((m as unknown as { passedSee?: boolean }).passedSee).toBeUndefined()
  })

  it('v1 blob under sbf.v1 migrates into modes.see; Binnen modes start empty', async () => {
    const v1 = {
      version: 1,
      state: {
        xp: 100,
        answered: 10,
        correct: 7,
        wrong: { 42: 3 },
        notes: {},
        streakDays: 1,
        mocks: [],
        knotsMastered: {},
      },
    }
    ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage
      .setItem('sbf.v1', JSON.stringify(v1))

    const { mode, persistence } = await loadFreshModules()
    mode.setMode('see')
    const see = persistence.loadState()
    expect(see.xp).toBe(100)
    expect(see.questions[42]?.mastery).toBe('weak')

    mode.setMode('binnen-motor')
    expect(persistence.loadState().xp).toBe(0)
  })

  it('empty storage yields three empty modes', async () => {
    const { mode, persistence } = await loadFreshModules()
    for (const m of ['see', 'binnen-motor', 'binnen-segeln'] as const) {
      mode.setMode(m)
      const s = persistence.loadState()
      expect(s.xp).toBe(0)
      expect(s.questions).toEqual({})
      expect(s.mocks).toEqual([])
    }
  })
})

describe('backup round-trip', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear()
  })

  it('loadAllModes / saveAllModes preserves all three slices', async () => {
    const { mode, persistence } = await loadFreshModules()

    mode.setMode('see')
    const see = persistence.loadState()
    see.xp = 100
    persistence.saveState(see)

    mode.setMode('binnen-motor')
    const bm = persistence.loadState()
    bm.xp = 200
    persistence.saveState(bm)

    mode.setMode('binnen-segeln')
    const bs = persistence.loadState()
    bs.xp = 300
    persistence.saveState(bs)

    const snapshot = persistence.loadAllModes()
    expect(snapshot.see.xp).toBe(100)
    expect(snapshot['binnen-motor'].xp).toBe(200)
    expect(snapshot['binnen-segeln'].xp).toBe(300)

    // Clear and restore
    ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear()
    persistence.saveAllModes(snapshot)

    mode.setMode('see')
    expect(persistence.loadState().xp).toBe(100)
    mode.setMode('binnen-motor')
    expect(persistence.loadState().xp).toBe(200)
    mode.setMode('binnen-segeln')
    expect(persistence.loadState().xp).toBe(300)
  })
})
