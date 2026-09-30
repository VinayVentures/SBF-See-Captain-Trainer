import { describe, expect, it } from 'vitest'
import { rankForXp, xpProgressInCurrentRank, RANKS, XP_PER_RANK } from '../src/engine/xp'

describe('XP → rank ladder', () => {
  it('starts at Deckhand', () => {
    expect(rankForXp(0)).toBe('Deckhand')
    expect(rankForXp(749)).toBe('Deckhand')
  })

  it('advances at 750 XP boundaries', () => {
    expect(rankForXp(750)).toBe('Able Seaman')
    expect(rankForXp(1500)).toBe('Helmsman')
    expect(rankForXp(2250)).toBe('Navigator')
    expect(rankForXp(3000)).toBe('First Officer')
    expect(rankForXp(3750)).toBe('Captain')
  })

  it('caps at Captain', () => {
    expect(rankForXp(999999)).toBe('Captain')
    expect(RANKS[RANKS.length - 1]).toBe('Captain')
  })

  it('reports progress within the current rank', () => {
    const p = xpProgressInCurrentRank(1000) // 1000 = Able Seaman + 250/750
    expect(p.currentXp).toBe(250)
    expect(p.neededXp).toBe(XP_PER_RANK)
    expect(Math.round(p.progressPct)).toBe(33)
  })

  it('shows 100% when at Captain', () => {
    const p = xpProgressInCurrentRank(10_000)
    expect(p.progressPct).toBe(100)
  })
})
