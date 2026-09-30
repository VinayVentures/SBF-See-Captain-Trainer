import { renderHome } from './screens/home'
import { renderQuiz } from './screens/quiz'
import { renderKnots } from './screens/knots'
import { renderNav } from './screens/nav'
import { renderMock } from './screens/mock'

export type ScreenId = 'home' | 'quiz' | 'knots' | 'nav' | 'mock'

const renderers: Record<ScreenId, () => void> = {
  home: renderHome,
  quiz: renderQuiz,
  knots: renderKnots,
  nav: renderNav,
  mock: renderMock,
}

export function show(id: ScreenId): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((el) => {
    el.classList.remove('active')
  })
  const el = document.getElementById(id)
  if (!el) return
  el.classList.add('active')
  renderers[id]()
  window.scrollTo(0, 0)
}
