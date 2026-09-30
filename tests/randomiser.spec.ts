import { describe, expect, it } from 'vitest'
import {
  applyPermutation,
  displaySlotToCatalogueIndex,
  inversePermutation,
  isCorrect,
  permute,
} from '../src/engine/randomiser'

describe('answer randomiser', () => {
  it('produces a permutation containing exactly [0,1,2,3]', () => {
    for (let qid = 1; qid <= 300; qid++) {
      for (let seed = 0; seed < 50; seed++) {
        const p = permute(qid, seed)
        const sorted = [...p].sort()
        expect(sorted).toEqual([0, 1, 2, 3])
      }
    }
  })

  it('is deterministic for the same (questionId, seed)', () => {
    expect(permute(42, 12345)).toEqual(permute(42, 12345))
    // Different seed sets *usually* produce different permutations. There
    // are only 24 permutations of length 4, so collisions are expected —
    // just assert that *not every* neighbouring seed collides.
    let differences = 0
    for (let s = 0; s < 50; s++) {
      if (JSON.stringify(permute(1, s)) !== JSON.stringify(permute(1, s + 1)))
        differences++
    }
    expect(differences).toBeGreaterThan(20)
  })

  it('applies the same permutation to DE and EN arrays', () => {
    const de = ['DE_A', 'DE_B', 'DE_C', 'DE_D'] as const
    const en = ['EN_A', 'EN_B', 'EN_C', 'EN_D'] as const
    for (let seed = 0; seed < 500; seed++) {
      const p = permute(7, seed)
      const shuffledDe = applyPermutation(de, p)
      const shuffledEn = applyPermutation(en, p)
      // shuffled[i] must correspond to the same catalogue index in both.
      for (let i = 0; i < 4; i++) {
        expect(shuffledDe[i]!.slice(-1)).toEqual(shuffledEn[i]!.slice(-1))
      }
    }
  })

  it('grading finds the correct catalogue-index-0 answer at its display slot', () => {
    for (let seed = 0; seed < 500; seed++) {
      const p = permute(101, seed)
      const correctSlot = p.indexOf(0)
      expect(isCorrect(correctSlot, p, 0)).toBe(true)
      // every wrong slot must grade wrong
      for (let slot = 0; slot < 4; slot++) {
        if (slot === correctSlot) continue
        expect(isCorrect(slot, p, 0)).toBe(false)
      }
    }
  })

  it('inverse permutation round-trips', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = permute(200, seed)
      const inv = inversePermutation(p)
      for (let i = 0; i < 4; i++) {
        expect(displaySlotToCatalogueIndex(inv[i]!, p)).toBe(i)
      }
    }
  })

  it('at least sometimes shuffles away from identity (not always A=A)', () => {
    let nonIdentity = 0
    for (let seed = 0; seed < 200; seed++) {
      const p = permute(3, seed)
      if (p[0] !== 0) nonIdentity++
    }
    // Should shuffle away from position 0 much more often than trivially.
    expect(nonIdentity).toBeGreaterThan(100)
  })
})
