import appJson from '../../../data/catalogue.app.json'
import { CATALOGUE } from '../../data/catalogue'
import { computeCoverage } from '../../engine/coverage'
import { rankForXp, xpProgressInCurrentRank } from '../../engine/xp'
import { exportBackup, importBackup } from '../../services/backup'
import { loadState, saveState } from '../../services/persistence'
import type { AppCatalogue } from '../../data/types'
import { show } from '../router'

export function renderHome(): void {
  const state = loadState()
  const cov = computeCoverage(CATALOGUE, appJson as AppCatalogue)
  const rank = rankForXp(state.xp)
  const progress = xpProgressInCurrentRank(state.xp)
  const accuracy = state.answered
    ? Math.round((state.correct / state.answered) * 100)
    : 0
  const wrongCount = Object.keys(state.wrong).length
  const readiness = computeReadiness(cov.translatedPct, accuracy, state.mocks)

  const root = document.getElementById('home')
  if (!root) return
  root.innerHTML = `
    <div class="top">
      <div>
        <small class="muted">SBF SEE • CAPTAIN TRAINER</small>
        <h1>⚓ Your Bridge / Deine Brücke</h1>
      </div>
      <span class="pill">🔥 <b>${state.streakDays}</b> days</span>
    </div>

    <div class="hero">
      <div class="gold">${rank}</div>
      <div class="big"><span>${state.xp}</span> XP</div>
      <div class="bar"><i style="width:${progress.progressPct}%"></i></div>
      <h2><span>${readiness}</span>% Exam readiness</h2>
      <div class="coverage">
        <div class="stat pill ${cov.officialTotal === 285 ? 'ok' : 'warn'}">
          <b>${cov.officialTotal} / 285</b> official catalogue
        </div>
        <div class="stat pill ${cov.translatedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.translated} / ${cov.officialTotal}</b> translated (EN)
        </div>
        <div class="stat pill ${cov.explainedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.explained} / ${cov.officialTotal}</b> explained
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>⚓ Continue learning</h3>
        <p class="muted">Bilingual adaptive practice.</p>
        <button data-action="learn">Start voyage</button>
      </div>
      <div class="card">
        <h3>🛢 The Bilge</h3>
        <p><b>${wrongCount}</b> weak questions</p>
        <button data-action="bilge"${wrongCount === 0 ? ' disabled' : ''}>Review</button>
      </div>
      <div class="card">
        <h3>📝 Mock exam</h3>
        <p class="muted">60 min · 7 Basis · 23 See · 9 navigation answers</p>
        <button data-action="mock">Captain's Challenge</button>
      </div>
      <div class="card">
        <h3>🧭 Navigation Academy</h3>
        <p class="muted">Structured written answers + Exam Desk mode.</p>
        <button data-action="nav">Open chart room</button>
      </div>
    </div>

    <div class="card">
      <h3>🪢 Knoten / Knots</h3>
      <p class="muted">All 9 practical-exam knot skills · bilingual instructions.</p>
      <button data-action="knots">Open knot deck</button>
    </div>

    <div class="card">
      <h3>🏆 Captain's Cup</h3>
      <p class="muted">Leaderboard-ready. Shared rankings activate once the Crew backend ships (Milestone F).</p>
      <div class="row"><span>You / Du</span><b>${state.xp} XP</b></div>
    </div>

    <div class="card">
      <h3>💾 Backup</h3>
      <button class="secondary" data-action="export">Export progress</button>
      <button class="secondary" data-action="import">Import progress</button>
      <input id="import-file" type="file" accept="application/json" hidden />
    </div>
  `

  const fileInput = document.getElementById('import-file') as HTMLInputElement | null
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    try {
      await importBackup(file)
      saveState(loadState()) // ensure persisted
      renderHome()
    } catch (e) {
      alert('Invalid backup: ' + (e as Error).message)
    }
  })

  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action
      switch (action) {
        case 'learn':
          startLearn(false)
          break
        case 'bilge':
          startLearn(true)
          break
        case 'mock':
          show('mock')
          break
        case 'nav':
          show('nav')
          break
        case 'knots':
          show('knots')
          break
        case 'export':
          exportBackup()
          break
        case 'import':
          fileInput?.click()
          break
      }
    })
  })
}

function computeReadiness(translatedPct: number, accuracyPct: number, mocks: number[]): number {
  // Milestone A readiness: honest and cautious. Blends coverage (30%),
  // accuracy (35%), and mock average (35%). Cap at coverage so a user with
  // 0% translated content can never show 100% ready.
  const avgMock = mocks.length
    ? mocks.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, mocks.length)
    : 0
  const raw = translatedPct * 0.3 + accuracyPct * 0.35 + avgMock * 0.35
  return Math.min(Math.round(raw), Math.round(translatedPct))
}

function startLearn(bilgeOnly: boolean): void {
  ;(window as unknown as { __quizMode?: 'learn' | 'bilge' }).__quizMode =
    bilgeOnly ? 'bilge' : 'learn'
  show('quiz')
}
