import { joinedQuestions } from '../../data/catalogue'
import {
  bilgeQueue,
  bookmarkedQueue,
  learnQueue,
  toggleBookmark,
  updateQuestionState,
  type QuestionQueue,
} from '../../engine/learning'
import {
  applyPermutation,
  isCorrect,
  newSessionSeed,
  permute,
  type Permutation,
} from '../../engine/randomiser'
import { XP_REWARDS } from '../../engine/xp'
import {
  checkAchievements,
  ACHIEVEMENTS,
  ensureTodayMissions,
  recordMissionEvent,
  claimReadyMissions,
  updateWindStreak,
} from '../../engine/achievements'
import { loadState, questionStateFor, saveState } from '../../services/persistence'
import type { JoinedQuestion } from '../../data/types'
import { show } from '../router'

export type QuizMode = 'learn' | 'bilge' | 'bookmarks'

interface QuizContext {
  mode: QuizMode
  queue: QuestionQueue
  seed: number
  current?: { question: JoinedQuestion; perm: Permutation }
  locked: boolean
}

let ctx: QuizContext | null = null

export function setQuizMode(mode: QuizMode): void {
  ;(window as unknown as { __quizMode?: QuizMode }).__quizMode = mode
  ctx = null
}

export function renderQuiz(): void {
  if (!ctx) startQuiz()
  const root = document.getElementById('quiz')
  if (!root) return
  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill" id="quiz-cat"></span>
    </div>
    <div class="pane">
      <small>🇩🇪 DEUTSCH • PRÜFUNGSSPRACHE</small>
      <div class="row" style="align-items:flex-start">
        <h2 id="qde" style="flex:1;margin:0"></h2>
        <button class="secondary" id="bookmark-btn" title="Bookmark"></button>
      </div>
      <div id="ade" class="answers" style="margin-top:12px"></div>
    </div>
    <div class="notes">
      <b>📝 Meine Notizen / My Notes</b>
      <textarea id="note" rows="3"></textarea>
    </div>
    <div id="why" class="card" hidden></div>
    <div class="pane en">
      <small>🇬🇧 ENGLISH • APP-AUTHORED STUDY AID (not official exam text)</small>
      <h2 id="qen"></h2>
      <div id="aen" class="answers"></div>
      <p class="muted" id="en-missing" hidden>
        English translation not yet authored for this question.
      </p>
    </div>
    <div class="nav">
      <span id="pos"></span>
      <div>
        <button class="secondary" data-action="explain">ⓘ Explain</button>
        <button data-action="next" hidden>Next →</button>
      </div>
    </div>
  `
  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => {
      ctx = null
      show('home')
    })
  root
    .querySelector<HTMLButtonElement>('[data-action=explain]')!
    .addEventListener('click', toggleExplain)
  root
    .querySelector<HTMLButtonElement>('[data-action=next]')!
    .addEventListener('click', nextQuestion)
  root
    .querySelector<HTMLButtonElement>('#bookmark-btn')!
    .addEventListener('click', handleBookmarkToggle)
  const note = root.querySelector<HTMLTextAreaElement>('#note')!
  note.addEventListener('input', () => {
    if (!ctx?.current) return
    const state = loadState()
    state.notes[ctx.current.question.id] = note.value
    saveState(state)
  })
  drawCurrent()
}

function startQuiz(): void {
  const mode = (window as unknown as { __quizMode?: QuizMode }).__quizMode ??
    'learn'
  const all = joinedQuestions()
  const state = loadState()
  let queue: QuestionQueue
  switch (mode) {
    case 'bilge':
      queue = bilgeQueue(all, state)
      break
    case 'bookmarks':
      queue = bookmarkedQueue(all, state)
      break
    case 'learn':
    default:
      queue = learnQueue(all, state)
      break
  }
  if (queue.total() === 0) {
    const messages: Record<QuizMode, string> = {
      learn: 'No questions available.',
      bilge: 'Bilge cleared. Nothing to review.',
      bookmarks: 'No bookmarked questions yet — bookmark from the Bridge or during learn.',
    }
    alert(messages[mode])
    show('home')
    return
  }
  ctx = { mode, queue, seed: newSessionSeed(), locked: false }
  advance()
}

function advance(): void {
  if (!ctx) return
  const q = ctx.queue.next()
  if (!q) {
    ctx = null
    show('home')
    return
  }
  ctx.current = { question: q, perm: permute(q.id, ctx.seed) }
  ctx.locked = false
}

function drawCurrent(): void {
  if (!ctx?.current) return
  const { question, perm } = ctx.current
  const state = loadState()
  const qState = questionStateFor(state, question.id)

  const cat = document.getElementById('quiz-cat')!
  cat.textContent = `${question.category.toUpperCase()} • Q${question.id} • ${qState.mastery}`

  const qde = document.getElementById('qde')!
  qde.textContent = question.de.question

  const bookmarkBtn = document.getElementById('bookmark-btn') as HTMLButtonElement
  bookmarkBtn.textContent = qState.bookmarked ? '★' : '☆'

  const ade = document.getElementById('ade')!
  const shuffledDe = applyPermutation(question.de.answers, perm)
  ade.innerHTML = shuffledDe
    .map(
      (a, i) =>
        `<button class="answer" data-slot="${i}">${String.fromCharCode(
          65 + i,
        )}. ${escapeHtml(a)}</button>`,
    )
    .join('')
  ade.querySelectorAll<HTMLButtonElement>('.answer').forEach((btn) => {
    btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.slot)))
  })

  const qen = document.getElementById('qen')!
  const aen = document.getElementById('aen')!
  const enMissing = document.getElementById('en-missing')!
  if (question.app.en) {
    qen.textContent = question.app.en.question
    const shuffledEn = applyPermutation(question.app.en.answers, perm)
    aen.innerHTML = shuffledEn
      .map(
        (a, i) =>
          `<button class="answer" disabled>${String.fromCharCode(65 + i)}. ${escapeHtml(a)}</button>`,
      )
      .join('')
    enMissing.hidden = true
  } else {
    qen.textContent = '—'
    aen.innerHTML = ''
    enMissing.hidden = false
  }

  const note = document.getElementById('note') as HTMLTextAreaElement
  note.value = state.notes[question.id] ?? ''

  const why = document.getElementById('why') as HTMLElement
  why.hidden = true
  ;(document.querySelector('[data-action=next]') as HTMLElement).hidden = true

  const pos = document.getElementById('pos')!
  pos.textContent = `${ctx.queue.position()} / ${ctx.queue.total()}`
}

function handleAnswer(slot: number): void {
  if (!ctx?.current || ctx.locked) return
  ctx.locked = true
  const { question, perm } = ctx.current
  const correct = isCorrect(slot, perm, question.officialCorrectIndex)
  const state = loadState()

  const prevQState = state.questions[question.id]
  const wasWeak = prevQState?.mastery === 'weak' || (prevQState?.wrongStreak ?? 0) > 0
  const wasUnseen = !prevQState || prevQState.seen === 0

  state.answered += 1
  if (correct) {
    state.correct += 1
    state.xp += XP_REWARDS.correctAnswer
  } else {
    state.xp += XP_REWARDS.wrongAnswer
  }
  state.questions[question.id] = updateQuestionState(prevQState, correct)

  // Wind streak
  const wind = updateWindStreak(state.windStreak ?? 0, correct)
  state.windStreak = wind.streak
  state.windStreakBest = Math.max(state.windStreakBest ?? 0, wind.streak)
  state.xp += wind.bonusXp

  // Daily missions
  state.dailyMissions = ensureTodayMissions(state.dailyMissions as never)
  state.dailyMissions = recordMissionEvent(state.dailyMissions as never, {
    kind: 'question_answered',
    correct,
    wasUnseen,
    wasWeak,
  })
  const claimResult = claimReadyMissions(state.dailyMissions as never)
  state.dailyMissions = claimResult.state
  state.xp += claimResult.totalXp

  // Achievements
  const all = joinedQuestions()
  const unlocked = checkAchievements(all, state)
  state.achievements = state.achievements ?? {}
  const newlyUnlocked: string[] = []
  for (const id of unlocked) {
    if (!state.achievements[id]) {
      state.achievements[id] = new Date().toISOString()
      const ach = ACHIEVEMENTS.find((a) => a.id === id)
      if (ach) {
        state.xp += ach.xpReward
        newlyUnlocked.push(ach.title + ' (+' + ach.xpReward + ' XP)')
      }
    }
  }
  // Also unlock wind_streak_50 if hit
  if (wind.crossedMilestone === 50 && !state.achievements['wind_streak_50']) {
    state.achievements['wind_streak_50'] = new Date().toISOString()
    state.xp += ACHIEVEMENTS.find((a) => a.id === 'wind_streak_50')!.xpReward
    newlyUnlocked.push('Fair Winds (+150 XP)')
  }

  saveState(state)

  const buttons = document.querySelectorAll<HTMLButtonElement>('#ade .answer')
  const correctSlot = perm.indexOf(question.officialCorrectIndex)
  buttons.forEach((b, i) => {
    if (i === correctSlot) b.classList.add('correct')
    if (i === slot && !correct) b.classList.add('wrong')
  })
  const enButtons = document.querySelectorAll<HTMLButtonElement>('#aen .answer')
  enButtons.forEach((b, i) => {
    if (i === correctSlot) b.classList.add('correct')
    if (i === slot && !correct) b.classList.add('wrong')
  })

  const why = document.getElementById('why') as HTMLElement
  const explanation = question.app.explanation
  const bonusLine = wind.bonusXp > 0
    ? `<p class="gold">🌬 Wind Streak ${wind.streak}! +${wind.bonusXp} XP</p>`
    : wind.streak >= 3
      ? `<p class="muted">🌬 Wind streak: ${wind.streak}</p>`
      : ''
  const missionsLine = claimResult.totalXp > 0
    ? `<p class="gold">🎯 Mission complete! +${claimResult.totalXp} XP</p>`
    : ''
  const achievementsLine = newlyUnlocked.length > 0
    ? `<p class="gold">🏆 ${newlyUnlocked.join(', ')}</p>`
    : ''
  why.innerHTML =
    `<b>${correct ? '✓ Correct +' + XP_REWARDS.correctAnswer + ' XP' : '✕ Not yet +' + XP_REWARDS.wrongAnswer + ' XP'}</b>` +
    bonusLine + missionsLine + achievementsLine +
    (explanation
      ? `<p>${escapeHtml(explanation.de)}</p><p class="muted">${escapeHtml(explanation.en)}</p>` +
        (explanation.memoryAid
          ? `<p><b>💡</b> ${escapeHtml(explanation.memoryAid)}</p>`
          : '')
      : `<p class="muted">Explanation not yet authored for this question.</p>`)
  why.hidden = false
  ;(document.querySelector('[data-action=next]') as HTMLElement).hidden = false

  // Update mastery pill in the category label
  const state2 = loadState()
  const cat = document.getElementById('quiz-cat')!
  const newMastery = questionStateFor(state2, question.id).mastery
  cat.textContent = `${question.category.toUpperCase()} • Q${question.id} • ${newMastery}`
}

function handleBookmarkToggle(): void {
  if (!ctx?.current) return
  const state = loadState()
  const id = ctx.current.question.id
  state.questions[id] = toggleBookmark(state.questions[id])
  saveState(state)
  const btn = document.getElementById('bookmark-btn') as HTMLButtonElement
  btn.textContent = state.questions[id]!.bookmarked ? '★' : '☆'
}

function toggleExplain(): void {
  if (!ctx?.current) return
  const why = document.getElementById('why') as HTMLElement
  const explanation = ctx.current.question.app.explanation
  why.innerHTML = explanation
    ? `<b>ⓘ Erklärung / Explanation</b><p>${escapeHtml(explanation.de)}</p><p class="muted">${escapeHtml(explanation.en)}</p>` +
      (explanation.memoryAid
        ? `<p><b>💡</b> ${escapeHtml(explanation.memoryAid)}</p>`
        : '')
    : `<b>ⓘ Erklärung / Explanation</b><p class="muted">Explanation not yet authored.</p>`
  why.hidden = !why.hidden
}

function nextQuestion(): void {
  if (!ctx) return
  advance()
  if (!ctx) return
  drawCurrent()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
