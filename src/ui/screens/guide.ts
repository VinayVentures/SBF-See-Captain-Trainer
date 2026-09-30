import { show } from '../router'

export function renderGuide(): void {
  const root = document.getElementById('guide')
  if (!root) return
  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill">📖 Guide</span>
    </div>

    <div class="hero">
      <h2>SBF-See Captain Trainer — Quick Guide</h2>
      <p>Bilingual (Deutsch / English) study companion for the German Sportbootführerschein See exam. Free, no signup, works offline.</p>
    </div>

    <div class="card">
      <h3>📲 Install as a PWA</h3>
      <p><b>iPhone / iPad:</b> Open in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.</p>
      <p><b>Android:</b> Open in <b>Chrome</b> → <b>⋮ menu</b> → <b>Install app</b>.</p>
      <p><b>Desktop:</b> Chrome/Edge → install icon (⊕) in the address bar. Once installed it works offline.</p>
    </div>

    <div class="card">
      <h3>🏛 The Bridge (home)</h3>
      <ul>
        <li><b>Rank</b> — Deckhand → Captain, 750 XP per rank</li>
        <li><b>🔥 Streak</b> — days in a row you've studied</li>
        <li><b>Exam readiness %</b> — blend of coverage, mastery, recent accuracy, and mock performance</li>
        <li><b>Content coverage</b> — should be 285/285 green across the board</li>
      </ul>
    </div>

    <div class="card">
      <h3>🎓 Study modes</h3>
      <p><b>⚓ Continue learning</b> — smart queue: overdue → new → future. Answer in German, English mirror shows below. Take notes, bookmark, tap ⓘ Explain after each answer.</p>
      <p><b>🛢 The Bilge</b> — drill only questions you got wrong until you master them.</p>
      <p><b>★ Bookmarks</b> — study only questions you flagged with the star.</p>
      <p><b>📝 Mock exam</b> — 60-min timer, 7 Basis (≥5/7) + 23 See (≥18/23) + 9 navigation (≥7/9). No feedback during exam. Full review after submit.</p>
      <p><b>🧭 Navigation Academy</b> — all 15 nav templates + 8 D49 scenarios with structured inputs.</p>
    </div>

    <div class="card">
      <h3>🪢 Knoten Academy</h3>
      <p>All 9 practical-exam knots with bilingual step-by-step + animated visualization. Tick <i>Mastered</i> when you can tie AND explain each one.</p>
      <p class="muted">⚠ Animated diagrams are schematic — practise with real rope and cross-check against a knot book.</p>
    </div>

    <div class="card">
      <h3>🎮 Gamification</h3>
      <ul>
        <li><b>XP:</b> +10 correct, +2 wrong (effort counts)</li>
        <li><b>🌬 Wind Streak:</b> +15/+40/+100/+250 XP bonus at streaks of 5/10/25/50</li>
        <li><b>🎯 Daily Missions:</b> 3 new challenges every day, resets at midnight</li>
        <li><b>🏆 8 Achievements:</b> COLREG Master, Lights &amp; Signals, Navigation Officer, Knot Master, Fair Winds, First Voyage, Halfway Home, Chartered</li>
      </ul>
    </div>

    <div class="card">
      <h3>💾 Backing up your progress</h3>
      <p>Bridge → <b>Export progress</b> saves a JSON file. Keep it if you switch devices or clear your browser. Bridge → <b>Import progress</b> restores from that file.</p>
      <p class="muted">No cloud sync in this release. Email the JSON to yourself occasionally if you're serious about not losing progress.</p>
    </div>

    <div class="card">
      <h3>💡 Study tips</h3>
      <ol>
        <li><b>Take a mock exam early</b> — get a baseline. Don't worry about the score.</li>
        <li><b>Focus on the Bilge</b> — the app already knows what you're weak on.</li>
        <li><b>Daily missions keep the streak alive</b> — 10 questions a day beats cramming.</li>
        <li><b>Bookmark tricky wording</b> — 0,5‰ vs 0,8‰, "vor Anker" vs "festgemacht" etc.</li>
        <li><b>Nav on a real D49 chart</b> — digital scratchpad only supplements.</li>
        <li><b>Aim for 100% in your weakest topic</b> before the real mock.</li>
      </ol>
    </div>

    <div class="card">
      <h3>⚠ Honest disclaimers</h3>
      <ul>
        <li><b>Unofficial study aid.</b> Official source: <a href="https://www.elwis.de/" target="_blank" rel="noopener">elwis.de</a></li>
        <li><b>German exam text</b> is quoted verbatim from the official ELWIS catalogue (Stand 01.08.2023). © Wasserstraßen- und Schifffahrtsverwaltung des Bundes.</li>
        <li><b>English translations and explanations</b> are AI-authored study aids — occasional imperfections possible, especially specific regulatory citations. Always confirm against the German original.</li>
        <li>This app is a helper, not a substitute for a certified course.</li>
      </ul>
    </div>

    <div class="card">
      <h3>🐛 Found a bug or wrong answer?</h3>
      <p>Open an issue: <a href="https://github.com/VinayVentures/SBF-See-Captain-Trainer/issues" target="_blank" rel="noopener">github.com/VinayVentures/SBF-See-Captain-Trainer/issues</a></p>
      <p class="muted">Include the question number (e.g. "SEE • Q142") and what looked wrong.</p>
    </div>

    <div class="hero" style="text-align:center">
      <h3>Fair winds and following seas! ⛵</h3>
    </div>
  `
  root
    .querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))
}
