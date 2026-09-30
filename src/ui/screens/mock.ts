import appJson from '../../../data/catalogue.app.json'
import { CATALOGUE } from '../../data/catalogue'
import { computeCoverage } from '../../engine/coverage'
import type { AppCatalogue } from '../../data/types'
import { show } from '../router'

export function renderMock(): void {
  const root = document.getElementById('mock')
  if (!root) return
  const cov = computeCoverage(CATALOGUE, appJson as AppCatalogue)
  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill warn">📝 Mock exam — LOCKED</span>
    </div>
    <div class="hero">
      <h2>Captain's Challenge — 60 min mock exam</h2>
      <p>
        The realistic 60-minute mock exam (7 Basis · 23 See · 9 Navigation) is
        deliberately gated until the app-authored content — English translations
        and DE/EN explanations — reaches 100% coverage. This prevents a partial
        catalogue from being presented as a realistic exam (spec §36 P0).
      </p>
    </div>

    <div class="card">
      <h3>Content coverage</h3>
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
      <p class="muted" style="margin-top:14px">
        Mock exam unlocks when translated and explained both reach 100%.
      </p>
      <button disabled>Start mock exam (locked)</button>
    </div>

    <div class="card">
      <h3>Exam rules (reference)</h3>
      <ul>
        <li>7 Basis questions — pass ≥ 5/7</li>
        <li>23 See-specific questions — pass ≥ 18/23</li>
        <li>9 navigation answers — pass ≥ 7/9</li>
        <li>60 minutes total, all three sections independently</li>
      </ul>
    </div>
  `
  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))
}
