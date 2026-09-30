import './ui/styles.css'
import { show } from './ui/router'
import { registerPwa } from './pwa/register'

const app = document.getElementById('app')
if (!app) throw new Error('#app not found')
app.innerHTML = `
  <main>
    <section id="home" class="screen active"></section>
    <section id="quiz" class="screen"></section>
    <section id="knots" class="screen"></section>
    <section id="nav" class="screen"></section>
    <section id="mock" class="screen"></section>
    <section id="guide" class="screen"></section>
    <footer class="muted">
      <p>
        <b>v1.3 Crew Edition — foundation.</b> Unofficial study tool.
        Content coverage is displayed honestly on the Bridge; the mock exam
        is locked until the app-authored translations and explanations are complete.
      </p>
    </footer>
  </main>
`

show('home')

// First-run: auto-open the Guide on the very first visit
if (!localStorage.getItem('sbf.guideSeen')) {
  localStorage.setItem('sbf.guideSeen', '1')
  show('guide')
}

registerPwa()
