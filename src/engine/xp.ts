/**
 * XP + Captain's Rank ladder (spec §12).
 *
 * The rank thresholds match the spec: 6 ranks, 750 XP per rank. This is
 * deliberately kept simple in Milestone A; the anti-grind logic that
 * weights mock XP more than repeat drills lives in the learning engine
 * (Milestone C).
 */

export const RANKS = [
  'Deckhand',
  'Able Seaman',
  'Helmsman',
  'Navigator',
  'First Officer',
  'Captain',
] as const

export type Rank = (typeof RANKS)[number]

export const XP_PER_RANK = 750

export function rankForXp(xp: number): Rank {
  const idx = Math.min(RANKS.length - 1, Math.max(0, Math.floor(xp / XP_PER_RANK)))
  return RANKS[idx]!
}

export function xpProgressInCurrentRank(xp: number): {
  currentXp: number
  neededXp: number
  progressPct: number
} {
  if (xp >= XP_PER_RANK * (RANKS.length - 1)) {
    return { currentXp: XP_PER_RANK, neededXp: XP_PER_RANK, progressPct: 100 }
  }
  const currentXp = xp % XP_PER_RANK
  return {
    currentXp,
    neededXp: XP_PER_RANK,
    progressPct: (currentXp / XP_PER_RANK) * 100,
  }
}

export const XP_REWARDS = {
  correctAnswer: 10,
  wrongAnswer: 2,
} as const
