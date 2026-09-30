import { joinedQuestions } from '../../data/catalogue'
import { bilgeQueue, learnQueue, type QuestionQueue } from '../../engine/learning'
import {
  applyPermutation,
  isCorrect,
  newSessionSeed,
  permute,
  type Permutation,
} from '../../engine/randomiser'
import { XP_REWARDS } from '../../engine/xp'
import { loadState, saveState } from '../../services/persistence'
import type { JoinedQuestion } from '../../data/types'
import { show } from '../router'

interface QuizContext {
  queue: QuestionQueue
  seed: number
  current?: { question: JoinedQuestion; perm: Permutation }
  locked: boolean
}

let ctx: QuizContext | null = null

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
      <h2 id="qde"></h2>
      <div id="ade" class="answers"></div>
    </div>
    <div class="notes">
      <b>📝 Meine Notizen / My Notes</b>
      <textarea id="note" rows="3"></textarea>
    </div>
    <div id="why" class="card" hidden></div>
    <div class="pane en">
      <small>🇬🇧 ENGLISH • MIRROR</small>
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
  const mode = (window as unknown as { __quizMode?: 'learn' | 'bilge' }).__quizMode ??
    'learn'
  const all = joinedQuestions()
  const state = loadState()
  const wrongIds = Object.keys(state.wrong).map((k) => Number(k))
  const queue =
    mode === 'bilge' ? bilgeQueue(all, wrongIds) : learnQueue(all)
  if (queue.total() === 0) {
    alert(mode === 'bilge' ? 'Bilge cleared. Nothing to review.' : 'No questions.')
    show('home')
    return
  }
  ctx = { queue, seed: newSessionSeed(), locked: false }
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
  const cat = document.getElementById('quiz-cat')!
  cat.textContent = `${question.category.toUpperCase()} • Q${question.id}`

  const qde = document.getElementById('qde')!
  qde.textContent = question.de.question

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
  const state = loadState()
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
  state.answered += 1
  if (correct) {
    state.correct += 1
    state.xp += XP_REWARDS.correctAnswer
    delete state.wrong[question.id]
  } else {
    state.xp += XP_REWARDS.wrongAnswer
    state.wrong[question.id] = (state.wrong[question.id] ?? 0) + 1
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
  why.innerHTML =
    `<b>${correct ? '✓ Correct +' + XP_REWARDS.correctAnswer + ' XP' : '✕ Not yet +' + XP_REWARDS.wrongAnswer + ' XP'}</b>` +
    (explanation
      ? `<p>${escapeHtml(explanation.de)}</p><p class="muted">${escapeHtml(explanation.en)}</p>`
      : `<p class="muted">Explanation not yet authored for this question.</p>`)
  why.hidden = false
  ;(document.querySelector('[data-action=next]') as HTMLElement).hidden = false
}

function toggleExplain(): void {
  if (!ctx?.current) return
  const why = document.getElementById('why') as HTMLElement
  const explanation = ctx.current.question.app.explanation
  why.innerHTML = explanation
    ? `<b>ⓘ Erklärung / Explanation</b><p>${escapeHtml(explanation.de)}</p><p class="muted">${escapeHtml(explanation.en)}</p>`
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
