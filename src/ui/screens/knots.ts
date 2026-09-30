import { KNOTS } from '../../data/knots'
import { ACHIEVEMENTS, checkAchievements } from '../../engine/achievements'
import { joinedQuestions } from '../../data/catalogue'
import { loadState, saveState } from '../../services/persistence'
import { show } from '../router'

const stepIndex: Record<number, number> = {}

export function renderKnots(): void {
  const root = document.getElementById('knots')
  if (!root) return
  const state = loadState()
  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill">🪢 Knoten / Knots</span>
    </div>
    <div class="hero">
      <h2>Knotenprüfung / Knot Practice</h2>
      <p>
        <b>Prüfungsziel / Exam target:</b> Von maximal sieben verlangten Knoten müssen sechs
        ausreichend ausgeführt <b>und ihre Verwendung richtig erklärt</b> werden. /
        Of up to seven requested knots, six must be tied adequately
        <b>and their use correctly explained</b>.
      </p>
    </div>
    <div id="knotlist">
      ${KNOTS.map((k) => renderKnotCard(k.id, state.knotsMastered[k.id] ?? false)).join('')}
    </div>
  `
  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))

  KNOTS.forEach((k) => {
    stepIndex[k.id] = 0
    paintStep(k.id)
    document
      .getElementById(`k-prev-${k.id}`)!
      .addEventListener('click', () => stepDelta(k.id, -1))
    document
      .getElementById(`k-next-${k.id}`)!
      .addEventListener('click', () => stepDelta(k.id, +1))
    document
      .getElementById(`k-play-${k.id}`)!
      .addEventListener('click', () => play(k.id))
    document
      .getElementById(`k-restart-${k.id}`)!
      .addEventListener('click', () => restart(k.id))
    document
      .getElementById(`k-master-${k.id}`)!
      .addEventListener('change', (ev) => {
        const on = (ev.target as HTMLInputElement).checked
        const s = loadState()
        s.knotsMastered[k.id] = on
        // Check knot_master achievement
        const all = joinedQuestions()
        const unlocked = checkAchievements(all, s)
        s.achievements = s.achievements ?? {}
        for (const id of unlocked) {
          if (!s.achievements[id]) {
            s.achievements[id] = new Date().toISOString()
            const ach = ACHIEVEMENTS.find((a) => a.id === id)
            if (ach) s.xp += ach.xpReward
          }
        }
        saveState(s)
      })
  })
}

function renderKnotCard(id: number, mastered: boolean): string {
  const k = KNOTS.find((x) => x.id === id)!
  return `
    <div class="card">
      <h2>${id}. ${escapeHtml(k.de.name)} <span class="muted">/ ${escapeHtml(k.en.name)}</span></h2>
      <div class="knotviz">
        <svg viewBox="0 0 390 250" role="img" aria-label="Animated rope path">
          <path class="ghost" d="${k.svg.ghostPath}" />
          <path id="rope-${id}" class="rope" d="${k.svg.ghostPath}" />
          <text x="18" y="235" fill="#9db0c2">Working end / loses Ende →</text>
        </svg>
        <div class="stepbox" id="ks-${id}"></div>
        <div class="kcontrols">
          <button id="k-prev-${id}">←</button>
          <button id="k-play-${id}">▶ Animate</button>
          <button id="k-next-${id}">Next →</button>
          <button class="secondary" id="k-restart-${id}">↻ Restart</button>
        </div>
      </div>
      <div class="grid">
        <div>
          <h3>🇩🇪 Verwendung</h3>
          <p>${escapeHtml(k.de.use)}</p>
          <h3>Schritt für Schritt</h3>
          <ol>${k.de.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
          <p><b>Prüfungssatz:</b> ${escapeHtml(k.de.examSentence)}</p>
        </div>
        <div class="en pane">
          <h3>🇬🇧 Use</h3>
          <p>${escapeHtml(k.en.use)}</p>
          <h3>Step by step</h3>
          <ol>${k.en.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
          <p><b>Exam sentence:</b> ${escapeHtml(k.en.examSentence)}</p>
        </div>
      </div>
      <div class="practice">
        <h3>🧪 Practice / Üben</h3>
        <p>
          Hide the instructions, tie the knot with real rope, then say the German use sentence aloud. /
          Anleitung abdecken, Knoten mit echter Leine knüpfen und den deutschen Verwendungssatz laut erklären.
        </p>
        <label>
          <input id="k-master-${id}" type="checkbox" style="width:auto" ${mastered ? 'checked' : ''} />
          Mastered: I can tie it AND explain its use / Beherrscht
        </label>
      </div>
    </div>
  `
}

function paintStep(id: number): void {
  const k = KNOTS.find((x) => x.id === id)!
  const i = stepIndex[id] ?? 0
  const box = document.getElementById(`ks-${id}`)
  if (!box) return
  box.innerHTML = `<b>Step ${i + 1} / ${k.de.steps.length}</b><br>🇩🇪 ${escapeHtml(k.de.steps[i]!)}<br>🇬🇧 ${escapeHtml(k.en.steps[i]!)}`
}

function stepDelta(id: number, delta: number): void {
  const k = KNOTS.find((x) => x.id === id)!
  const max = k.de.steps.length - 1
  stepIndex[id] = Math.max(0, Math.min(max, (stepIndex[id] ?? 0) + delta))
  paintStep(id)
}

function play(id: number): void {
  const rope = document.getElementById(`rope-${id}`)
  if (!rope) return
  rope.classList.remove('animate')
  void (rope as unknown as HTMLElement).offsetWidth
  rope.classList.add('animate')
  stepIndex[id] = 0
  paintStep(id)
}

function restart(id: number): void {
  stepIndex[id] = 0
  paintStep(id)
  document.getElementById(`rope-${id}`)?.classList.remove('animate')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
