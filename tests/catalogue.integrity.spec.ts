import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/catalogue'

describe('official catalogue integrity', () => {
  it('has 513 MCQ + 15 nav templates + 8 nav scenarios', () => {
    expect(CATALOGUE.questions).toHaveLength(513)
    expect(CATALOGUE.navTemplates).toHaveLength(15)
    expect(CATALOGUE.navScenarios).toHaveLength(8)
  })

  it('has 72 Basis + 213 See + 181 Binnen + 47 Segeln', () => {
    const basis = CATALOGUE.questions.filter((q) => q.category === 'basis')
    const see = CATALOGUE.questions.filter((q) => q.category === 'see')
    const binnen = CATALOGUE.questions.filter((q) => q.category === 'binnen')
    const segeln = CATALOGUE.questions.filter((q) => q.category === 'segeln')
    expect(basis).toHaveLength(72)
    expect(see).toHaveLength(213)
    expect(binnen).toHaveLength(181)
    expect(segeln).toHaveLength(47)
  })

  it('every question id is globally unique', () => {
    const ids = CATALOGUE.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every question has a non-empty displayId', () => {
    for (const q of CATALOGUE.questions) {
      expect(q.displayId).toMatch(/^\d{1,3}$/)
    }
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

  it('questions with images reference well-formed filenames', () => {
    const withImages = CATALOGUE.questions.filter((q) => q.images && q.images.length > 0)
    expect(withImages.length).toBeGreaterThan(50)
    for (const q of withImages) {
      for (const filename of q.images!) {
        // See images: q{displayId}.png; Binnen/Segeln images: b{displayId}.png
        expect(filename).toMatch(/^[qb]\d{3}(-\d+)?\.png$/)
        // filename must reference this question's own displayId
        const expectedPrefix = (filename.startsWith('b') ? 'b' : 'q')
          + q.displayId.padStart(3, '0')
        expect(filename.startsWith(expectedPrefix)).toBe(true)
        // See-source questions use q-prefix; Binnen/Segeln use b-prefix
        if (q.category === 'binnen' || q.category === 'segeln') {
          expect(filename.startsWith('b')).toBe(true)
        } else {
          expect(filename.startsWith('q')).toBe(true)
        }
      }
    }
  })
})
