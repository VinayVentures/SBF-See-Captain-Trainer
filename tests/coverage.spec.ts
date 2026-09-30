import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/catalogue'
import { computeCoverage } from '../src/engine/coverage'
import type { AppCatalogue } from '../src/data/types'
import appJson from '../data/catalogue.app.json' assert { type: 'json' }

describe('honest coverage computation', () => {
  it('reports 0/285 translated and 0/285 explained on the empty app catalogue', () => {
    const empty: AppCatalogue = { questions: [] }
    const c = computeCoverage(CATALOGUE, empty)
    expect(c.officialTotal).toBe(285)
    expect(c.translated).toBe(0)
    expect(c.explained).toBe(0)
    expect(c.isExamReady).toBe(false)
  })

  it('flags exam-ready only at full translation + explanation coverage', () => {
    const app: AppCatalogue = {
      questions: CATALOGUE.questions.map((q) => ({
        id: q.id,
        en: { question: 'x', answers: ['a', 'b', 'c', 'd'] },
        explanation: { de: 'de', en: 'en' },
      })),
    }
    const c = computeCoverage(CATALOGUE, app)
    expect(c.translated).toBe(285)
    expect(c.explained).toBe(285)
    expect(c.isExamReady).toBe(true)
  })

  it('rejects whitespace-only translations as untranslated', () => {
    const app: AppCatalogue = {
      questions: [
        { id: 1, en: { question: '  ', answers: [' ', ' ', ' ', ' '] } },
      ],
    }
    const c = computeCoverage(CATALOGUE, app)
    expect(c.translated).toBe(0)
  })

  it('shipped catalogue.app.json is fully populated (all 285)', () => {
    const c = computeCoverage(CATALOGUE, appJson as AppCatalogue)
    expect(c.translated).toBe(285)
    expect(c.explained).toBe(285)
  })
})
