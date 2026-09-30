import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/catalogue'

describe('official catalogue integrity', () => {
  it('has 285 MCQ + 15 nav templates + 8 nav scenarios', () => {
    expect(CATALOGUE.questions).toHaveLength(285)
    expect(CATALOGUE.navTemplates).toHaveLength(15)
    expect(CATALOGUE.navScenarios).toHaveLength(8)
  })

  it('has 72 Basis + 213 See', () => {
    const basis = CATALOGUE.questions.filter((q) => q.category === 'basis')
    const see = CATALOGUE.questions.filter((q) => q.category === 'see')
    expect(basis).toHaveLength(72)
    expect(see).toHaveLength(213)
  })

  it('has contiguous IDs 1..285', () => {
    const ids = CATALOGUE.questions.map((q) => q.id)
    expect(ids).toEqual(Array.from({ length: 285 }, (_, i) => i + 1))
  })

  it('every MCQ has 4 non-empty DE answers and officialCorrectIndex 0', () => {
    for (const q of CATALOGUE.questions) {
      expect(q.de.answers).toHaveLength(4)
      for (const a of q.de.answers) {
        expect(a.length).toBeGreaterThan(0)
      }
      expect(q.de.question.length).toBeGreaterThan(0)
      expect(q.officialCorrectIndex).toBe(0)
    }
  })

  it('nav templates all have ids 286..300 and a shape', () => {
    const ids = CATALOGUE.navTemplates.map((t) => t.id)
    expect(ids).toEqual(Array.from({ length: 15 }, (_, i) => i + 286))
    for (const t of CATALOGUE.navTemplates) {
      expect(t.de.length).toBeGreaterThan(0)
      expect(t.answerShape).toBeTruthy()
    }
  })

  it('nav scenarios all have ids 1..8 with coordinate strings', () => {
    const ids = CATALOGUE.navScenarios.map((s) => s.id)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const s of CATALOGUE.navScenarios) {
      expect(s.swCorner.lat).toMatch(/^N\d+°/)
      expect(s.swCorner.lon).toMatch(/^E\d+°/)
      expect(s.neCorner.lat).toMatch(/^N\d+°/)
      expect(s.neCorner.lon).toMatch(/^E\d+°/)
    }
  })
})
