import { CATALOGUE } from '../../data/catalogue'
import { show } from '../router'

export function renderNav(): void {
  const root = document.getElementById('nav')
  if (!root) return
  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill">🧭 Navigation Academy</span>
    </div>
    <div class="hero">
      <h2>Navigation Academy / Navigationsakademie</h2>
      <p>
        Use these structured fields for written answers. For Exam Desk Mode, do the
        plotting on your physical D49 chart first, then enter your results.
      </p>
      <p class="muted">
        The 15 official navigation task templates (Q286–Q300) and 8 chart scenarios
        from the ELWIS catalogue are loaded. Grading against official solutions
        arrives in Milestone E — see roadmap.
      </p>
    </div>

    <div class="grid navgrid">
      <div class="card">
        <h3>📍 Coordinates</h3>
        <label>Latitude N</label><input placeholder="53° 54.2'">
        <label>Longitude E</label><input placeholder="008° 15.4'">
      </div>
      <div class="card">
        <h3>🧭 Courses</h3>
        <label>rwK °</label><input type="number">
        <label>MgK °</label><input type="number">
        <label>Peilung °</label><input type="number">
      </div>
      <div class="card">
        <h3>📏 Distance / Speed</h3>
        <label>Distance nm</label><input type="number" step=".1">
        <label>Speed kn</label><input type="number" step=".1">
        <label>Time</label><input placeholder="01:14">
      </div>
      <div class="card">
        <h3>📐 Exam Desk Scratchpad</h3>
        <textarea rows="8" placeholder="Rechenweg / scratchpad…"></textarea>
      </div>
    </div>

    <div class="card">
      <h3>📚 Official navigation task templates (Q286–Q300)</h3>
      <ol>
        ${CATALOGUE.navTemplates
          .map(
            (t) =>
              `<li><b>Q${t.id}</b> [${t.answerShape}] — ${escapeHtml(t.de)}</li>`,
          )
          .join('')}
      </ol>
    </div>

    <div class="card">
      <h3>🗺 Chart scenarios (D49)</h3>
      <ol>
        ${CATALOGUE.navScenarios
          .map(
            (s) =>
              `<li>#${s.id}: SW ${s.swCorner.lat}, ${s.swCorner.lon} → NE ${s.neCorner.lat}, ${s.neCorner.lon}</li>`,
          )
          .join('')}
      </ol>
    </div>

    <div class="card">
      <b>Training rule:</b> digital input supplements physical D49 chart practice;
      it does not replace plotting practice.
    </div>
  `
  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
