import appJson from '../../../data/catalogue.app.json'
import { CATALOGUE } from '../../data/catalogue'
import { resolveImageUrl } from '../../data/images'
import { computeCoverage } from '../../engine/coverage'
import { countsFor, MOCK_DURATION_MINUTES, thresholdsFor } from '../../engine/exam'
import {
  grade,
  newMockSession,
  permutationFor,
  timeRemainingMs,
  type MockSession,
} from '../../engine/mockSession'
import { applyPermutation } from '../../engine/randomiser'
import { XP_PER_RANK } from '../../engine/xp'
import { ACHIEVEMENTS } from '../../engine/achievements'
import { joinedQuestionsForMode } from '../../data/catalogue'
import { checkAchievements } from '../../engine/achievements'
import { loadState, saveState } from '../../services/persistence'
import { currentMode, MODE_LABELS, onModeChange } from '../../services/mode'
import type { AppCatalogue, NavTemplate, OfficialQuestion } from '../../data/types'
import { show } from '../router'

type Phase = 'intro' | 'running' | 'reviewing'

interface ViewState {
  phase: Phase
  session?: MockSession
  currentIndex: number
  navSelfGrades: Record<number, boolean>
  gradeResult?: ReturnType<typeof grade>
  timerHandle?: number
}

let view: ViewState = { phase: 'intro', currentIndex: 0, navSelfGrades: {} }

// Abandon any in-flight mock when the licence mode changes.
onModeChange(() => {
  if (view.timerHandle) window.clearInterval(view.timerHandle)
  view = { phase: 'intro', currentIndex: 0, navSelfGrades: {} }
})

interface OrderedItem {
  kind: 'mcq' | 'nav'
  question?: OfficialQuestion
  navTemplate?: NavTemplate
}

function orderedItems(session: MockSession): OrderedItem[] {
  return [
    ...session.paper.basis.map((q) => ({ kind: 'mcq' as const, question: q })),
    ...session.paper.specific.map((q) => ({ kind: 'mcq' as const, question: q })),
    ...session.paper.segeln.map((q) => ({ kind: 'mcq' as const, question: q })),
    ...session.paper.navigation.map((t) => ({ kind: 'nav' as const, navTemplate: t })),
  ]
}

export function renderMock(): void {
  switch (view.phase) {
    case 'intro':
      renderIntro()
      break
    case 'running':
      renderRunning()
      break
    case 'reviewing':
      renderReviewing()
      break
  }
}

function stopTimer(): void {
  if (view.timerHandle !== undefined) {
    clearInterval(view.timerHandle)
    view.timerHandle = undefined
  }
}

function renderIntro(): void {
  stopTimer()
  const root = document.getElementById('mock')
  if (!root) return
  const cov = computeCoverage(CATALOGUE, appJson as AppCatalogue)
  const state = loadState()
  const mode = currentMode()
  const canStart = mode === 'see'
    ? (cov.translatedPct === 100 && cov.explainedPct === 100)
    : true  // Binnen modes are German-only — no translation gate.
  const recentMocks = state.mocks.slice(-5).reverse()
  const counts = countsFor(mode)
  const thr = thresholdsFor(mode)
  const specificLabel = mode === 'see' ? 'See' : 'Binnen'
  const thirdLabel = counts.navigation > 0 ? 'Nav' : counts.segeln > 0 ? 'Segeln' : ''
  const thirdCount = counts.navigation || counts.segeln
  const thirdThr = counts.navigation ? thr.navigation : thr.segeln

  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill ${canStart ? 'ok' : 'warn'}">📝 Mock exam ${canStart ? '' : '— LOCKED'}</span>
    </div>
    <div class="hero">
      <h2>Captain's Challenge — ${MODE_LABELS[mode].long}</h2>
      <p class="muted" style="margin:4px 0 12px">${MOCK_DURATION_MINUTES} minutes</p>
      <p>
        ${counts.basis > 0 ? `${counts.basis} Basis (pass ≥ ${thr.basis}/${counts.basis}) · ` : ''}${counts.specific} ${specificLabel} (pass ≥ ${thr.specific}/${counts.specific})${
          thirdCount
            ? ` · ${thirdCount} ${thirdLabel} (pass ≥ ${thirdThr}/${thirdCount})`
            : ''
        }
      </p>
      <p class="muted">
        During the exam: no explanations, no mastery indicators, no XP popups.
        ${counts.navigation > 0
          ? 'Navigation answers are self-graded on submission (spec §19 Exam Desk mode).'
          : ''}
      </p>
    </div>

    ${mode === 'see' ? `
    <div class="card">
      <h3>Content coverage</h3>
      <div class="coverage">
        <div class="stat pill ok">
          <b>${cov.officialTotal}</b> See catalogue total
        </div>
        <div class="stat pill ${cov.translatedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.translated} / ${cov.officialTotal}</b> translated
        </div>
        <div class="stat pill ${cov.explainedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.explained} / ${cov.officialTotal}</b> explained
        </div>
      </div>
      <p class="muted" style="margin-top:12px">
        ${canStart
          ? 'Content ready. Start when you have 60 uninterrupted minutes.'
          : 'Mock exam unlocks when translated and explained both reach 100%.'}
      </p>
      <button data-action="start"${canStart ? '' : ' disabled'}>Start mock exam</button>
    </div>
    ` : `
    <div class="card">
      <p class="muted" style="margin:0 0 12px">
        German-only — no translation gate. Start when you have 60 uninterrupted minutes.
      </p>
      <button data-action="start">Start mock exam</button>
    </div>
    `}

    ${recentMocks.length > 0 ? `
    <div class="card">
      <h3>Recent mocks</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:var(--muted)">
          <th>Date</th>${counts.basis > 0 ? '<th>Basis</th>' : ''}<th>${specificLabel}</th>${thirdCount ? `<th>${thirdLabel}</th>` : ''}<th>Overall</th><th>Result</th>
        </tr></thead>
        <tbody>
          ${recentMocks.map((m) => `
            <tr>
              <td>${new Date(m.at).toLocaleDateString()}</td>
              ${counts.basis > 0 ? `<td>${m.score.basis}/${counts.basis}${m.passedBasis ? ' ✓' : ''}</td>` : ''}
              <td>${m.score.specific}/${counts.specific}${m.passedSpecific ? ' ✓' : ''}</td>
              ${thirdCount
                ? `<td>${m.score.navigation ?? 0}/${thirdCount}${m.passedNavigation ? ' ✓' : ''}</td>`
                : ''}
              <td>${Math.round(m.overallPct)}%</td>
              <td><b class="${m.passed ? 'gold' : ''}">${m.passed ? 'PASSED' : 'not yet'}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `

  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => {
      view = { phase: 'intro', currentIndex: 0, navSelfGrades: {} }
      show('home')
    })
  root
    .querySelector<HTMLButtonElement>('[data-action=start]')!
    .addEventListener('click', () => {
      if (!canStart) return
      const mode = currentMode()
      const pool = joinedQuestionsForMode(mode)
      const session = newMockSession(mode, pool, CATALOGUE.navTemplates)
      view = { phase: 'running', session, currentIndex: 0, navSelfGrades: {} }
      renderMock()
    })
}

function renderRunning(): void {
  stopTimer()
  const session = view.session!
  const root = document.getElementById('mock')
  if (!root) return
  const items = orderedItems(session)
  const idx = view.currentIndex

  const remaining = timeRemainingMs(session)
  if (remaining === 0 && !session.submitted) {
    submitExam()
    return
  }

  root.innerHTML = `
    <div class="top">
      <span class="pill warn">📝 Exam in progress</span>
      <span class="pill" id="mock-timer"></span>
    </div>
    <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:6px;margin:14px 0">
      ${items.map((it, i) => {
        const answered = it.kind === 'mcq'
          ? session.answers[it.question!.id] !== undefined
          : (session.navAnswers[it.navTemplate!.id] ?? '').trim().length > 0
        const cls = i === idx ? 'ok' : answered ? '' : 'warn'
        return `<button class="pill ${cls}" data-jump="${i}" style="cursor:pointer">${i + 1}</button>`
      }).join('')}
    </div>
    <div id="mock-body"></div>
    <div class="nav">
      <button class="secondary" data-action="prev"${idx === 0 ? ' disabled' : ''}>← Prev</button>
      <div>
        ${idx === items.length - 1
          ? '<button data-action="submit">Submit exam</button>'
          : '<button data-action="next">Next →</button>'}
      </div>
    </div>
  `

  drawItem(items[idx]!)
  root.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((b) => {
    b.addEventListener('click', () => {
      view.currentIndex = Number(b.dataset.jump)
      renderMock()
    })
  })
  root
    .querySelector<HTMLButtonElement>('[data-action=prev]')
    ?.addEventListener('click', () => {
      view.currentIndex = Math.max(0, view.currentIndex - 1)
      renderMock()
    })
  root
    .querySelector<HTMLButtonElement>('[data-action=next]')
    ?.addEventListener('click', () => {
      view.currentIndex = Math.min(items.length - 1, view.currentIndex + 1)
      renderMock()
    })
  root
    .querySelector<HTMLButtonElement>('[data-action=submit]')
    ?.addEventListener('click', () => {
      if (confirm('Submit exam? Unanswered questions count as wrong.')) submitExam()
    })

  const paintTimer = () => {
    if (!view.session) return
    const rem = timeRemainingMs(view.session)
    const m = Math.floor(rem / 60_000)
    const s = Math.floor((rem % 60_000) / 1000)
    const el = document.getElementById('mock-timer')
    if (el) el.textContent = `⏱ ${m}:${s.toString().padStart(2, '0')}`
    if (rem === 0 && !view.session.submitted) submitExam()
  }
  paintTimer()
  view.timerHandle = window.setInterval(paintTimer, 1000)
}

function drawItem(item: OrderedItem): void {
  const body = document.getElementById('mock-body')
  if (!body) return
  const session = view.session!
  if (item.kind === 'mcq') {
    const q = item.question!
    const perm = permutationFor(session, q.id)
    const shuffled = applyPermutation(q.de.answers, perm)
    const selected = session.answers[q.id]
    const imagesHtml = (q.images ?? [])
      .map((filename) => {
        const url = resolveImageUrl(filename)
        return url ? `<img src="${url}" alt="Figure for Q${q.displayId}" loading="lazy" />` : ''
      })
      .join('')
    body.innerHTML = `
      <div class="pane">
        <small>${q.category.toUpperCase()} • Q${q.displayId}</small>
        <h2>${escapeHtml(q.de.question)}</h2>
        ${imagesHtml ? `<div class="qimages">${imagesHtml}</div>` : ''}
        <div class="answers">
          ${shuffled.map((a, i) =>
            `<button class="answer ${selected === i ? 'correct' : ''}" data-pick="${i}">${String.fromCharCode(65 + i)}. ${escapeHtml(a)}</button>`,
          ).join('')}
        </div>
      </div>
      <p class="muted">During the exam no feedback is shown. You can jump back and change your answer.</p>
    `
    body.querySelectorAll<HTMLButtonElement>('.answer').forEach((btn) => {
      btn.addEventListener('click', () => {
        session.answers[q.id] = Number(btn.dataset.pick)
        renderMock()
      })
    })
  } else {
    const t = item.navTemplate!
    body.innerHTML = `
      <div class="pane">
        <small>NAVIGATION • Q${t.id} • ${t.answerShape}</small>
        <h2>${escapeHtml(t.de)}</h2>
        <p class="muted">
          Work the answer on your physical D49 chart. Enter your final answer here.
          On submission you'll self-grade against the official solution.
        </p>
        <textarea id="nav-input" rows="3" placeholder="Your answer…">${escapeHtml(session.navAnswers[t.id] ?? '')}</textarea>
      </div>
    `
    const ta = document.getElementById('nav-input') as HTMLTextAreaElement
    ta.addEventListener('input', () => {
      session.navAnswers[t.id] = ta.value
    })
  }
}

function submitExam(): void {
  stopTimer()
  const session = view.session!
  if (session.submitted) return
  session.submitted = true
  view.phase = 'reviewing'
  renderMock()
}

function renderReviewing(): void {
  const session = view.session!
  const root = document.getElementById('mock')
  if (!root) return
  const gradeResult = view.gradeResult ?? grade(session, view.navSelfGrades)
  view.gradeResult = gradeResult
  const cov = computeCoverage(CATALOGUE, appJson as AppCatalogue)
  const mode = session.paper.mode
  const counts = countsFor(mode)
  const thr = thresholdsFor(mode)
  const specificLabel = mode === 'see' ? 'See' : 'Binnen'
  const thirdLabel = counts.navigation > 0 ? 'Navigation' : 'Segeln'
  const thirdCount = counts.navigation || counts.segeln
  const thirdThr = counts.navigation ? thr.navigation : thr.segeln
  const thirdCorrect = gradeResult.correctByCategory.navigation
    || gradeResult.correctByCategory.segeln

  root.innerHTML = `
    <div class="top">
      <span class="pill ${gradeResult.record.passed ? 'ok' : 'warn'}">
        📝 Mock result: ${gradeResult.record.passed ? 'PASSED ✓' : 'not yet'}
      </span>
      <button class="secondary" data-action="home">← Bridge</button>
    </div>
    <div class="hero">
      <h2>${Math.round(gradeResult.record.overallPct)}% overall</h2>
      <div class="coverage">
        ${counts.basis > 0 ? `
        <div class="stat pill ${gradeResult.record.passedBasis ? 'ok' : 'warn'}">
          <b>${gradeResult.record.score.basis} / ${counts.basis}</b>
          Basis (need ${thr.basis})
        </div>
        ` : ''}
        <div class="stat pill ${gradeResult.record.passedSpecific ? 'ok' : 'warn'}">
          <b>${gradeResult.record.score.specific} / ${counts.specific}</b>
          ${specificLabel} (need ${thr.specific})
        </div>
        ${thirdCount ? `
        <div class="stat pill ${gradeResult.record.passedNavigation ? 'ok' : 'warn'}">
          <b>${thirdCorrect} / ${thirdCount}</b>
          ${thirdLabel} (need ${thirdThr})
        </div>
        ` : ''}
      </div>
    </div>

    ${counts.navigation > 0 ? `
    <div class="card">
      <h3>Navigation self-grading</h3>
      <p class="muted">
        Compare your answer to the official solution (from your D49 chart work).
        Tick each item you got right. Nav score updates as you tick.
      </p>
      ${session.paper.navigation.map((t) => `
        <div class="pane" style="margin:8px 0">
          <b>Q${t.id}</b> — ${escapeHtml(t.de)}
          <p style="margin:6px 0"><i>Your answer:</i> ${escapeHtml(session.navAnswers[t.id] ?? '(blank)')}</p>
          <label>
            <input type="checkbox" style="width:auto" data-nav-grade="${t.id}"
              ${view.navSelfGrades[t.id] ? 'checked' : ''}>
            I got this right
          </label>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="card">
      <h3>MCQ review</h3>
      ${[...session.paper.basis, ...session.paper.specific, ...session.paper.segeln].map((q) => {
        const perm = permutationFor(session, q.id)
        const displaySlot = session.answers[q.id]
        const correctSlot = perm.indexOf(0)
        const gotIt = displaySlot === correctSlot
        return `
          <div class="pane" style="margin:8px 0;border-left:4px solid ${gotIt ? 'var(--ok)' : 'var(--bad)'}">
            <small>${q.category.toUpperCase()} • Q${q.displayId} · ${gotIt ? '✓ correct' : '✕ wrong'}</small>
            <p><b>${escapeHtml(q.de.question)}</b></p>
            <p class="muted">
              You picked: ${displaySlot === undefined ? '(blank)' : escapeHtml(applyPermutation(q.de.answers, perm)[displaySlot]!)}
              <br>Correct: ${escapeHtml(q.de.answers[0])}
            </p>
          </div>
        `
      }).join('')}
    </div>

    <div class="card">
      <p class="muted">
        Wrong MCQ answers have been added to your Bilge for review.
        Nav answers are self-graded — accuracy depends on honest reflection against your chart work.
      </p>
      ${cov.explainedPct < 100
        ? '<p class="warn">Some questions in this exam may lack complete explanations — see the Bilge.</p>'
        : ''}
      <button data-action="home">Back to Bridge</button>
    </div>
  `

  root.querySelectorAll<HTMLInputElement>('[data-nav-grade]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.navGrade)
      view.navSelfGrades[id] = cb.checked
      view.gradeResult = grade(view.session!, view.navSelfGrades)
      // Re-render to update the header + section scores. Preserve scroll pos.
      const y = window.scrollY
      renderMock()
      window.scrollTo(0, y)
    })
  })
  const homeBtn = () => {
    persistResult()
    view = { phase: 'intro', currentIndex: 0, navSelfGrades: {} }
    show('home')
  }
  root
    .querySelector<HTMLButtonElement>('[data-action=home]')
    ?.addEventListener('click', homeBtn)
}

function persistResult(): void {
  if (!view.gradeResult || !view.session) return
  const state = loadState()
  // Save mock record
  state.mocks.push(view.gradeResult.record)
  // Wrong MCQ answers go into per-question state as wrong-streak++
  // (SRS engine downstream — imports updateQuestionState). Keep it here
  // as a light "one incorrect attempt".
  for (const qid of view.gradeResult.wrongMcqIds) {
    const prev = state.questions[qid]
    state.questions[qid] = {
      seen: (prev?.seen ?? 0) + 1,
      correct: prev?.correct ?? 0,
      wrong: (prev?.wrong ?? 0) + 1,
      correctStreak: 0,
      wrongStreak: (prev?.wrongStreak ?? 0) + 1,
      lastAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      mastery: 'weak',
      bookmarked: prev?.bookmarked ?? false,
    }
  }
  // XP: 5 per correct, +200 pass bonus, +50 partial-pass bonus.
  const g = view.gradeResult
  const totalCorrect = g.record.score.basis + g.record.score.specific + (g.record.score.navigation ?? 0)
  const passBonus = g.record.passed ? 200 : (g.record.passedBasis || g.record.passedSpecific || g.record.passedNavigation) ? 50 : 0
  state.xp += totalCorrect * 5 + passBonus
  // Counters
  state.answered += totalCorrect + view.gradeResult.wrongMcqIds.length
  state.correct += totalCorrect

  // Achievements check post-mock (First Voyage, catalogue milestones, etc.)
  const all = joinedQuestionsForMode(currentMode())
  const unlocked = checkAchievements(all, state)
  state.achievements = state.achievements ?? {}
  for (const id of unlocked) {
    if (!state.achievements[id]) {
      state.achievements[id] = new Date().toISOString()
      const ach = ACHIEVEMENTS.find((a) => a.id === id)
      if (ach) state.xp += ach.xpReward
    }
  }

  saveState(state)
  // Approach XP rank cap gracefully
  void XP_PER_RANK
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
