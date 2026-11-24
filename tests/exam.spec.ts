import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/catalogue'
import {
  countsFor,
  evaluate,
  generateMock,
  thresholdsFor,
} from '../src/engine/exam'

describe('mock exam generator (See mode)', () => {
  it('produces the See composition: 7 Basis + 23 See + 9 nav', () => {
    const counts = countsFor('see')
    for (let i = 0; i < 20; i++) {
      const paper = generateMock('see', CATALOGUE.questions, CATALOGUE.navTemplates)
      expect(paper.basis).toHaveLength(counts.basis)
      expect(paper.specific).toHaveLength(counts.specific)
      expect(paper.navigation).toHaveLength(counts.navigation)
      expect(paper.segeln).toHaveLength(0)
      expect(paper.basis.every((q) => q.category === 'basis')).toBe(true)
      expect(paper.specific.every((q) => q.category === 'see')).toBe(true)
    }
  })

  it('never picks duplicate questions in a single paper', () => {
    const counts = countsFor('see')
    for (let i = 0; i < 10; i++) {
      const paper = generateMock('see', CATALOGUE.questions, CATALOGUE.navTemplates)
      const basisIds = new Set(paper.basis.map((q) => q.id))
      const specificIds = new Set(paper.specific.map((q) => q.id))
      const navIds = new Set(paper.navigation.map((t) => t.id))
      expect(basisIds.size).toBe(counts.basis)
      expect(specificIds.size).toBe(counts.specific)
      expect(navIds.size).toBe(counts.navigation)
    }
  })

  it('evaluates with independent section thresholds', () => {
    const thr = thresholdsFor('see')
    // Passing baseline
    expect(
      evaluate('see', {
        basis: thr.basis,
        specific: thr.specific,
        navigation: thr.navigation,
        segeln: 0,
      }).passed,
    ).toBe(true)
    // One short in each section separately → fails that section
    expect(
      evaluate('see', {
        basis: thr.basis,
        specific: thr.specific,
        navigation: thr.navigation - 1,
        segeln: 0,
      }).passed,
    ).toBe(false)
    expect(
      evaluate('see', {
        basis: thr.basis - 1,
        specific: thr.specific,
        navigation: thr.navigation,
        segeln: 0,
      }).passed,
    ).toBe(false)
    expect(
      evaluate('see', {
        basis: thr.basis,
        specific: thr.specific - 1,
        navigation: thr.navigation,
        segeln: 0,
      }).passed,
    ).toBe(false)
    const r = evaluate('see', {
      basis: thr.basis - 1,
      specific: thr.specific - 1,
      navigation: thr.navigation - 1,
      segeln: 0,
    })
    expect(r.passedBasis).toBe(false)
    expect(r.passedSpecific).toBe(false)
    expect(r.passedNavigation).toBe(false)
  })
})

describe('mock exam generator (Binnen modes)', () => {
  it('Binnen-Motor draws ONLY Binnen-specific (Basis is waived for See holders)', () => {
    const paper = generateMock('binnen-motor', CATALOGUE.questions, CATALOGUE.navTemplates)
    const counts = countsFor('binnen-motor')
    expect(counts.basis).toBe(0)
    expect(paper.basis).toHaveLength(0)
    expect(paper.specific).toHaveLength(counts.specific)
    expect(paper.navigation).toHaveLength(0)
    expect(paper.segeln).toHaveLength(0)
    expect(paper.specific.every((q) => q.category === 'binnen')).toBe(true)
  })

  it('Binnen-Segeln draws ONLY Binnen-specific + Segeln (Basis is waived)', () => {
    const paper = generateMock('binnen-segeln', CATALOGUE.questions, CATALOGUE.navTemplates)
    const counts = countsFor('binnen-segeln')
    expect(counts.basis).toBe(0)
    expect(paper.basis).toHaveLength(0)
    expect(paper.specific).toHaveLength(counts.specific)
    expect(paper.segeln).toHaveLength(counts.segeln)
    expect(paper.navigation).toHaveLength(0)
    expect(paper.specific.every((q) => q.category === 'binnen')).toBe(true)
    expect(paper.segeln.every((q) => q.category === 'segeln')).toBe(true)
  })

  it('Binnen-Motor passes on Specific alone (Basis + nav + Segeln all vacuous)', () => {
    const thr = thresholdsFor('binnen-motor')
    const r = evaluate('binnen-motor', {
      basis: 0,
      specific: thr.specific,
      navigation: 0,
      segeln: 0,
    })
    expect(r.passed).toBe(true)
    expect(r.passedBasis).toBe(true)
    expect(r.passedNavigation).toBe(true)
    expect(r.passedSegeln).toBe(true)
  })
})
