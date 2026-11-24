/**
 * Honest content coverage — spec §36 P0: "no claim of completeness until
 * validated". The UI reads these numbers directly onto the home screen so
 * a user always sees exactly how much of the app-authored content exists.
 *
 * Only See content (basis + see categories = 285 ids) is tracked. Binnen
 * and Segeln content ships German-only by design; including them in the
 * denominator would permanently report ~55% coverage even when the See
 * bilingual pane is fully populated.
 */

import type { AppCatalogue, OfficialCatalogue } from '../data/types'

export interface Coverage {
  /** Number of SEE-TRACKED questions (basis + see categories), not the full catalogue. */
  officialTotal: number
  translated: number
  explained: number
  translatedPct: number
  explainedPct: number
  isExamReady: boolean
}

export function computeCoverage(
  official: OfficialCatalogue,
  app: AppCatalogue,
): Coverage {
  const seeTracked = official.questions.filter(
    (q) => q.category === 'basis' || q.category === 'see',
  )
  const officialTotal = seeTracked.length
  const appById = new Map(app.questions.map((q) => [q.id, q]))
  let translated = 0
  let explained = 0
  for (const q of seeTracked) {
    const a = appById.get(q.id)
    if (a?.en && a.en.answers.every((s) => s.trim().length > 0) && a.en.question.trim())
      translated++
    if (a?.explanation && a.explanation.de.trim() && a.explanation.en.trim())
      explained++
  }
  return {
    officialTotal,
    translated,
    explained,
    translatedPct: officialTotal === 0 ? 0 : (translated / officialTotal) * 100,
    explainedPct: officialTotal === 0 ? 0 : (explained / officialTotal) * 100,
    isExamReady: translated === officialTotal && explained === officialTotal,
  }
}
