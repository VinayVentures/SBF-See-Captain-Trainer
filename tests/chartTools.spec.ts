import { describe, expect, it } from 'vitest'
import {
  compassTotalCorrection,
  defaultCompass,
  defaultPencil,
  defaultTriangle,
  eraseStrokeAt,
  triangleApex,
  triangleCorners,
  triangleCourse,
  undoLastStroke,
  type Stroke,
} from '../src/engine/chartTools'

describe('triangle', () => {
  it('rotation=0 => apex straight up, course along hypotenuse points east', () => {
    const t = defaultTriangle()
    t.rotation = 0
    const apex = triangleApex(t)
    expect(apex.x).toBeCloseTo(t.center.x, 3)
    expect(apex.y).toBeLessThan(t.center.y)
    // In SVG y-down space, apex-up = north → course along hypotenuse = 90°
    expect(triangleCourse(t)).toBeCloseTo(90, 3)
  })

  it('rotation=90 => apex to the right, course along hypotenuse points south', () => {
    const t = defaultTriangle()
    t.rotation = 90
    const [a, b, c] = triangleCorners(t)
    expect(a.x).toBeGreaterThan(t.center.x)
    expect(triangleCourse(t)).toBeCloseTo(180, 3)
    // hypotenuse endpoints equidistant from center
    const db = Math.hypot(b.x - t.center.x, b.y - t.center.y)
    const dc = Math.hypot(c.x - t.center.x, c.y - t.center.y)
    expect(db).toBeCloseTo(dc, 3)
  })

  it('triangleCorners returns three distinct points', () => {
    const t = defaultTriangle()
    const corners = triangleCorners(t)
    expect(corners).toHaveLength(3)
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const a = corners[i]!
        const b = corners[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1)
      }
    }
  })
})

describe('compass', () => {
  it('totalCorrection = variation + deviation', () => {
    const c = defaultCompass()
    c.variation = 3.5
    c.deviation = -1.2
    expect(compassTotalCorrection(c)).toBeCloseTo(2.3, 3)
  })

  it('default places compass inside chart extent', () => {
    const c = defaultCompass()
    expect(c.center.x).toBeGreaterThan(0)
    expect(c.center.y).toBeGreaterThan(0)
    expect(c.radius).toBeGreaterThan(0)
  })
})

describe('pencil undo', () => {
  it('undoLastStroke removes the last stroke', () => {
    const p = defaultPencil()
    const s1: Stroke = { id: 1, points: [{ x: 10, y: 10 }], color: '#000', width: 1 }
    const s2: Stroke = { id: 2, points: [{ x: 20, y: 20 }], color: '#000', width: 1 }
    const after = undoLastStroke({ ...p, strokes: [s1, s2] })
    expect(after.strokes).toHaveLength(1)
    expect(after.strokes[0]!.id).toBe(1)
  })

  it('undoLastStroke is a no-op on empty', () => {
    const p = defaultPencil()
    const after = undoLastStroke(p)
    expect(after.strokes).toEqual([])
  })
})

describe('eraser', () => {
  it('erases strokes within hitRadius', () => {
    const stroke: Stroke = {
      id: 1,
      points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
      color: '#000',
      width: 1,
    }
    const p = { ...defaultPencil(), strokes: [stroke] }
    const after = eraseStrokeAt(p, { x: 15, y: 10 }, 5)
    expect(after.strokes).toHaveLength(0)
  })

  it('keeps strokes outside hitRadius', () => {
    const stroke: Stroke = {
      id: 1,
      points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
      color: '#000',
      width: 1,
    }
    const p = { ...defaultPencil(), strokes: [stroke] }
    const after = eraseStrokeAt(p, { x: 100, y: 100 }, 5)
    expect(after.strokes).toHaveLength(1)
  })
})
