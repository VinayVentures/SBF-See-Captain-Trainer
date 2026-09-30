/**
 * Achievements + gamification — spec §12.
 *
 * Three surfaces:
 *  - Wind Streak: consecutive-correct-answer streak within a session, bonus XP
 *    for hitting milestones (5, 10, 25, 50)
 *  - Daily missions: three per day, resets at local midnight. XP reward on
 *    completion.
 *  - Topic mastery achievements: unlocked when all questions in a topic
 *    reach 'mastered'. Also a Knot Master (all 9 knots) achievement.
 */

import type { JoinedQuestion } from '../data/types'
import type { UserState } from '../services/persistence'
import { masterySummary } from './learning'

// ---------- Wind Streak ------------------------------------------------------

export interface WindStreakUpdate {
  streak: number
  crossedMilestone?: number
  bonusXp: number
}

const WIND_STREAK_MILESTONES = [5, 10, 25, 50] as const
const WIND_STREAK_BONUSES: Record<number, number> = { 5: 15, 10: 40, 25: 100, 50: 250 }

export function updateWindStreak(
  prevStreak: number,
  answeredCorrectly: boolean,
): WindStreakUpdate {
  if (!answeredCorrectly) return { streak: 0, bonusXp: 0 }
  const streak = prevStreak + 1
  const crossed = WIND_STREAK_MILESTONES.find((m) => m === streak)
  return {
    streak,
    crossedMilestone: crossed,
    bonusXp: crossed ? WIND_STREAK_BONUSES[crossed]! : 0,
  }
}

// ---------- Daily missions ---------------------------------------------------

export type MissionId =
  | 'answer_10_questions'
  | 'answer_5_correct'
  | 'clear_5_bilge'
  | 'study_new_topic'
  | 'complete_mock_section'

export interface Mission {
  id: MissionId
  title: string
  description: string
  target: number
  xpReward: number
}

export const ALL_MISSIONS: readonly Mission[] = [
  {
    id: 'answer_10_questions',
    title: '10 Questions',
    description: 'Answer any 10 questions today',
    target: 10,
    xpReward: 30,
  },
  {
    id: 'answer_5_correct',
    title: '5 Correct',
    description: 'Get 5 answers right today',
    target: 5,
    xpReward: 40,
  },
  {
    id: 'clear_5_bilge',
    title: 'Bilge Duty',
    description: 'Master 5 weak Bilge questions today',
    target: 5,
    xpReward: 50,
  },
  {
    id: 'study_new_topic',
    title: 'Explore',
    description: 'Study 3 unseen questions today',
    target: 3,
    xpReward: 25,
  },
]

export interface DailyMissionsState {
  date: string // YYYY-MM-DD (local)
  progress: Record<MissionId, number>
  claimed: Record<MissionId, boolean>
  seed: number
  missionIds: MissionId[]
}

function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function rotate<T>(arr: readonly T[], seed: number, count: number): T[] {
  // Deterministic Fisher–Yates using seed. Returns first `count` items
  // (or all of arr if count > arr.length).
  const copy = arr.slice()
  let s = seed | 0
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) | 0
    const j = Math.abs(s) % (i + 1)
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function ensureTodayMissions(
  prev: DailyMissionsState | undefined,
  now: Date = new Date(),
): DailyMissionsState {
  const today = todayKey(now)
  if (prev && prev.date === today) return prev
  // Rotate three missions per day based on epoch days.
  const seed = Math.floor(now.getTime() / (24 * 60 * 60_000))
  const picks = rotate(ALL_MISSIONS, seed, 3)
  const progress = {} as Record<MissionId, number>
  const claimed = {} as Record<MissionId, boolean>
  for (const p of picks) {
    progress[p.id] = 0
    claimed[p.id] = false
  }
  return {
    date: today,
    progress,
    claimed,
    seed,
    missionIds: picks.map((p) => p.id),
  }
}

export type MissionEvent =
  | { kind: 'question_answered'; correct: boolean; wasUnseen: boolean; wasWeak: boolean }
  | { kind: 'mock_section_passed' }

/**
 * Record a mission event and return the updated state + any XP claims that
 * fired (missions become claimable when progress hits target; claim happens
 * on next call to `claimReadyMissions`).
 */
export function recordMissionEvent(
  state: DailyMissionsState,
  event: MissionEvent,
): DailyMissionsState {
  const updated = { ...state, progress: { ...state.progress } }
  for (const id of state.missionIds) {
    const mission = ALL_MISSIONS.find((m) => m.id === id)!
    if (state.claimed[id] || state.progress[id] >= mission.target) continue
    if (event.kind === 'question_answered') {
      if (id === 'answer_10_questions') updated.progress[id]! += 1
      if (id === 'answer_5_correct' && event.correct) updated.progress[id]! += 1
      if (id === 'clear_5_bilge' && event.correct && event.wasWeak) updated.progress[id]! += 1
      if (id === 'study_new_topic' && event.wasUnseen) updated.progress[id]! += 1
    }
  }
  return updated
}

export function claimReadyMissions(
  state: DailyMissionsState,
): { state: DailyMissionsState; totalXp: number; claimedIds: MissionId[] } {
  const claimed: MissionId[] = []
  let totalXp = 0
  const newClaimed = { ...state.claimed }
  for (const id of state.missionIds) {
    if (state.claimed[id]) continue
    const mission = ALL_MISSIONS.find((m) => m.id === id)!
    if (state.progress[id] >= mission.target) {
      newClaimed[id] = true
      claimed.push(id)
      totalXp += mission.xpReward
    }
  }
  return { state: { ...state, claimed: newClaimed }, totalXp, claimedIds: claimed }
}

// ---------- Topic mastery achievements ---------------------------------------

export type AchievementId =
  | 'colreg_master'
  | 'lights_signals'
  | 'navigation_officer'
  | 'knot_master'
  | 'wind_streak_50'
  | 'first_mock_pass'
  | 'catalogue_50'
  | 'catalogue_100'

export interface Achievement {
  id: AchievementId
  title: string
  description: string
  xpReward: number
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'colreg_master',
    title: 'COLREG Master',
    description: 'Master every COLREG question',
    xpReward: 200,
  },
  {
    id: 'lights_signals',
    title: 'Lights & Signals',
    description: 'Master every Lights or Signals question',
    xpReward: 200,
  },
  {
    id: 'navigation_officer',
    title: 'Navigation Officer',
    description: 'Master every Navigation question',
    xpReward: 200,
  },
  {
    id: 'knot_master',
    title: 'Knot Master',
    description: 'Master all 9 practical knots',
    xpReward: 300,
  },
  {
    id: 'wind_streak_50',
    title: 'Fair Winds',
    description: 'Hit a 50-question wind streak',
    xpReward: 150,
  },
  {
    id: 'first_mock_pass',
    title: 'First Voyage',
    description: 'Pass your first mock exam (all three sections)',
    xpReward: 250,
  },
  {
    id: 'catalogue_50',
    title: 'Halfway Home',
    description: 'Master 50% of the catalogue',
    xpReward: 200,
  },
  {
    id: 'catalogue_100',
    title: 'Chartered',
    description: 'Master the entire 285-question catalogue',
    xpReward: 500,
  },
]

const TOPIC_ACHIEVEMENT_MATCH: Record<string, string[]> = {
  colreg_master: ['COLREG'],
  lights_signals: ['Lights', 'Signals', 'Sound Signals'],
  navigation_officer: ['Navigation', 'Charts', 'Buoyage'],
}

export function checkAchievements(
  all: readonly JoinedQuestion[],
  state: UserState,
): AchievementId[] {
  const unlocked: AchievementId[] = []
  const summary = masterySummary(all, state)

  // Topic mastery achievements
  for (const [achievementId, topics] of Object.entries(TOPIC_ACHIEVEMENT_MATCH)) {
    const inScope = all.filter((q) => q.app.topic && topics.includes(q.app.topic))
    if (inScope.length === 0) continue
    const mastered = inScope.every(
      (q) => state.questions[q.id]?.mastery === 'mastered',
    )
    if (mastered) unlocked.push(achievementId as AchievementId)
  }

  // Knot Master
  const allKnotsMastered = Array.from({ length: 9 }, (_, i) => i + 1)
    .every((id) => state.knotsMastered[id])
  if (allKnotsMastered) unlocked.push('knot_master')

  // First mock pass
  if (state.mocks.some((m) => m.passed)) unlocked.push('first_mock_pass')

  // Catalogue milestones
  const pct = summary.mastered / (all.length || 1)
  if (pct >= 0.5) unlocked.push('catalogue_50')
  if (pct >= 1.0) unlocked.push('catalogue_100')

  return unlocked
}
