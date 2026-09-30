/**
 * Answer randomiser.
 *
 * The ELWIS catalogue always stores the correct answer at index 0. If we
 * rendered questions in catalogue order the correct answer would always be
 * position A — the spec (§6) explicitly forbids that.
 *
 * This module produces a permutation for a question that:
 *  - preserves the same permutation across DE and EN sides, so the mirror
 *    stays in sync (spec §7)
 *  - lets the engine grade a user's chosen display slot by mapping it back
 *    to the catalogue index and comparing against `officialCorrectIndex`
 */

export type Permutation = readonly [number, number, number, number]

export const IDENTITY: Permutation = [0, 1, 2, 3]

/**
 * Fisher-Yates shuffle over `[0,1,2,3]` using a deterministic PRNG seeded
 * by (questionId, sessionSeed). Determinism means the same question in the
 * same session always shuffles the same way — important so a user can't
 * work around it by reloading, and so tests can assert behaviour.
 */
export function permute(questionId: number, sessionSeed: number): Permutation {
  const rng = mulberry32(hashCombine(questionId, sessionSeed))
  const a: number[] = [0, 1, 2, 3]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a as unknown as Permutation
}

/**
 * Apply a permutation to a length-4 tuple. Both DE and EN answer arrays
 * MUST call this with the same permutation so their display order matches.
 */
export function applyPermutation<T>(
  values: readonly [T, T, T, T],
  perm: Permutation,
): [T, T, T, T] {
  return [values[perm[0]], values[perm[1]], values[perm[2]], values[perm[3]]]
}

/**
 * Given the display slot the user picked (0..3) and the permutation used to
 * render, return the corresponding catalogue index. Grading: display slot
 * is correct iff its catalogue index === officialCorrectIndex.
 */
export function displaySlotToCatalogueIndex(
  displaySlot: number,
  perm: Permutation,
): number {
  return perm[displaySlot]!
}

export function isCorrect(
  displaySlot: number,
  perm: Permutation,
  officialCorrectIndex: number,
): boolean {
  return displaySlotToCatalogueIndex(displaySlot, perm) === officialCorrectIndex
}

/**
 * The permutation that maps catalogue index -> its display slot.
 * `inverse[catalogueIndex] === displaySlot`. Useful for highlighting the
 * correct button after a wrong answer.
 */
export function inversePermutation(perm: Permutation): Permutation {
  const inv: number[] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) inv[perm[i]!] = i
  return inv as unknown as Permutation
}

/** Freshly generated per app session. */
export function newSessionSeed(): number {
  return (Math.random() * 0x7fffffff) | 0
}

// ---- Internal deterministic PRNG helpers -----------------------------------

function hashCombine(a: number, b: number): number {
  let h = 2166136261 ^ (a | 0)
  h = Math.imul(h ^ (b | 0), 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 2654435761)
  h ^= h >>> 16
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
