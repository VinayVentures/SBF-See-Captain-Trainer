import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/catalogue'
import {
  evaluate,
  generateMock,
  MOCK_COUNTS,
  MOCK_THRESHOLDS,
} from '../src/engine/exam'

describe('mock exam generator', () => {
  it('produces exactly 7 Basis + 23 See + 9 nav answers', () => {
    for (let i = 0; i < 20; i++) {
      const paper = generateMock(CATALOGUE.questions, CATALOGUE.navTemplates)
      expect(paper.basis).toHaveLength(MOCK_COUNTS.basis)
      expect(paper.see).toHaveLength(MOCK_COUNTS.see)
      expect(paper.navigation).toHaveLength(MOCK_COUNTS.navigation)
      expect(paper.basis.every((q) => q.category === 'basis')).toBe(true)
      expect(paper.see.every((q) => q.category === 'see')).toBe(true)
    }
  })

  it('never picks duplicate questions in a single paper', () => {
    for (let i = 0; i < 10; i++) {
      const paper = generateMock(CATALOGUE.questions, CATALOGUE.navTemplates)
      const basisIds = new Set(paper.basis.map((q) => q.id))
      const seeIds = new Set(paper.see.map((q) => q.id))
      const navIds = new Set(paper.navigation.map((t) => t.id))
      expect(basisIds.size).toBe(MOCK_COUNTS.basis)
      expect(seeIds.size).toBe(MOCK_COUNTS.see)
      expect(navIds.size).toBe(MOCK_COUNTS.navigation)
    }
  })

  it('evaluates with independent section thresholds 5/7, 18/23, 7/9', () => {
    expect(
      evaluate({
        basis: MOCK_THRESHOLDS.basis,
        see: MOCK_THRESHOLDS.see,
        navigation: MOCK_THRESHOLDS.navigation,
      }).passed,
    ).toBe(true)
    expect(evaluate({ basis: 7, see: 23, navigation: 6 }).passed).toBe(false)
    expect(evaluate({ basis: 4, see: 23, navigation: 9 }).passed).toBe(false)
    expect(evaluate({ basis: 7, see: 17, navigation: 9 }).passed).toBe(false)
    const r = evaluate({ basis: 4, see: 17, navigation: 6 })
    expect(r.passedBasis).toBe(false)
    expect(r.passedSee).toBe(false)
    expect(r.passedNavigation).toBe(false)
  })
})
