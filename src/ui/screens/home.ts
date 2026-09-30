import appJson from '../../../data/catalogue.app.json'
import { CATALOGUE, joinedQuestions } from '../../data/catalogue'
import { computeCoverage } from '../../engine/coverage'
import { bookmarkedQueue } from '../../engine/learning'
import { masterySummary } from '../../engine/learning'
import { computeReadiness } from '../../engine/readiness'
import { rankForXp, xpProgressInCurrentRank } from '../../engine/xp'
import { exportBackup, importBackup } from '../../services/backup'
import { loadState, saveState } from '../../services/persistence'
import type { AppCatalogue } from '../../data/types'
import { show } from '../router'
import { setQuizMode } from './quiz'

export function renderHome(): void {
  const state = loadState()
  const cov = computeCoverage(CATALOGUE, appJson as AppCatalogue)
  const rank = rankForXp(state.xp)
  const progress = xpProgressInCurrentRank(state.xp)
  const all = joinedQuestions()
  const summary = masterySummary(all, state)
  const readiness = computeReadiness(all, state, cov)
  const bookmarkCount = bookmarkedQueue(all, state).total()
  const bilgeCount = summary.weak

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
      <h2><span>${readiness.overall}</span>% Exam readiness</h2>
      <p class="muted" style="margin:6px 0 0">
        ${readiness.masteredCount} mastered · ${readiness.weakCount} weak ·
        mock avg ${Math.round(readiness.mockPct)}% · accuracy ${Math.round(readiness.accuracyPct)}%
        ${readiness.cappedByCoverage ? '· (capped by content coverage)' : ''}
      </p>
      <div class="coverage">
        <div class="stat pill ${cov.officialTotal === 285 ? 'ok' : 'warn'}">
          <b>${cov.officialTotal} / 285</b> official catalogue
        </div>
        <div class="stat pill ${cov.translatedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.translated} / ${cov.officialTotal}</b> translated
        </div>
        <div class="stat pill ${cov.explainedPct === 100 ? 'ok' : 'warn'}">
          <b>${cov.explained} / ${cov.officialTotal}</b> explained
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>⚓ Continue learning</h3>
        <p class="muted">SRS-prioritised: overdue → new → future.</p>
        <button data-action="learn">Start voyage</button>
      </div>
      <div class="card">
        <h3>🛢 The Bilge</h3>
        <p><b>${bilgeCount}</b> weak questions</p>
        <button data-action="bilge"${bilgeCount === 0 ? ' disabled' : ''}>Review</button>
      </div>
      <div class="card">
        <h3>★ Bookmarks</h3>
        <p><b>${bookmarkCount}</b> flagged</p>
        <button data-action="bookmarks"${bookmarkCount === 0 ? ' disabled' : ''}>Study</button>
      </div>
      <div class="card">
        <h3>📝 Mock exam</h3>
        <p class="muted">60 min · 7 Basis · 23 See · 9 nav</p>
        <button data-action="mock">Captain's Challenge</button>
      </div>
      <div class="card">
        <h3>🧭 Navigation Academy</h3>
        <p class="muted">Structured written answers + Exam Desk mode.</p>
        <button data-action="nav">Open chart room</button>
      </div>
    </div>

    <div class="card">
      <h3>📊 Mastery breakdown</h3>
      <div class="coverage">
        <div class="stat pill">
          <b>${summary.unseen}</b> unseen
        </div>
        <div class="stat pill warn">
          <b>${summary.weak}</b> weak
        </div>
        <div class="stat pill">
          <b>${summary.learning}</b> learning
        </div>
        <div class="stat pill ok">
          <b>${summary.mastered}</b> mastered
        </div>
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
      saveState(loadState())
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
          setQuizMode('learn')
          show('quiz')
          break
        case 'bilge':
          setQuizMode('bilge')
          show('quiz')
          break
        case 'bookmarks':
          setQuizMode('bookmarks')
          show('quiz')
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
