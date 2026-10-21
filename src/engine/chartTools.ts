/**
 * Chart tool state + geometry helpers.
 *
 * Each tool has a self-contained state object; the rendering layer reads
 * these to draw the instrument on top of the chart, and the controller
 * updates them in response to pointer events.
 *
 * Everything stored in chart-space pixels (SVG user units) — not lat/lon
 * — so rotation math stays Euclidean. The chartGeo projector handles
 * conversions when the user needs a readout.
 */

import type { LatLon, Pixel } from './chartGeo'
import { CHART_HEIGHT, CHART_WIDTH, toLatLon, toPixel } from './chartGeo'

export type ToolId =
  | 'none'
  | 'ruler'
  | 'dividers'
  | 'triangle'
  | 'compass'
  | 'pencil'
  | 'eraser'

// ---- Triangle (Kursdreieck) -------------------------------------------------
//
// Model: an isosceles right triangle. User drags it bodily (anywhere on the
// hypotenuse or the body), rotates it by dragging the apex handle. The
// hypotenuse defines a "course line" — the readout gives rwK aligned with
// the hypotenuse direction. In real exam use the triangle is slid along a
// parallel ruler; here we approximate the end result by letting the user
// rotate and translate directly.

export interface TriangleState {
  /** Center of the hypotenuse in chart coords. */
  center: Pixel
  /** Length of each leg in chart units. */
  size: number
  /** Rotation angle in degrees — direction the apex points, 0 = north. */
  rotation: number
}

export function defaultTriangle(): TriangleState {
  return {
    center: { x: CHART_WIDTH / 2, y: CHART_HEIGHT / 2 },
    size: 220,
    rotation: 0,
  }
}

/** The three corner points of the triangle in chart coords. */
export function triangleCorners(t: TriangleState): [Pixel, Pixel, Pixel] {
  // Local coords (apex up, base along x axis):
  //   apex at (0, -s/2)   -- "north" of center in SVG y-down space
  //   base-left at (-s/2, s/2)
  //   base-right at (s/2, s/2)
  // `center` is the midpoint of the HYPOTENUSE (the degree-scale base),
  // which is what the user aligns with their course line.
  const s = t.size
  const local: [Pixel, Pixel, Pixel] = [
    { x: 0, y: -s / 2 },
    { x: -s / 2, y: s / 2 },
    { x: s / 2, y: s / 2 },
  ]
  const rad = (t.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return local.map((p) => ({
    x: t.center.x + p.x * cos - p.y * sin,
    y: t.center.y + p.x * sin + p.y * cos,
  })) as [Pixel, Pixel, Pixel]
}

/** The two hypotenuse endpoints in chart coords (used for course readout). */
export function triangleHypotenuse(t: TriangleState): [Pixel, Pixel] {
  const [, b, c] = triangleCorners(t)
  return [b, c]
}

/** Apex handle in chart coords. */
export function triangleApex(t: TriangleState): Pixel {
  return triangleCorners(t)[0]
}

/** True course along the hypotenuse direction (0..360°, 0 = north). */
export function triangleCourse(t: TriangleState): number {
  // The hypotenuse (base) runs along the local x-axis; its direction after
  // rotating by `t.rotation` degrees clockwise from +x is (cos θ, sin θ).
  // We want the compass bearing: 0 = -y (north). Translate x→east-ish, so
  // bearing = atan2(dx, -dy).
  const rad = (t.rotation * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (bearing + 360) % 360
}

// ---- Compass rose -----------------------------------------------------------
//
// Interactive compass. User positions it, enters variation (Missweisung) and
// deviation (Ablenkung); the rose shows true (black outer), magnetic (red
// middle), and compass (blue inner) scales rotated accordingly.

export interface CompassState {
  center: Pixel
  radius: number
  /** Variation (Missweisung) in degrees. East positive. */
  variation: number
  /** Deviation (Ablenkung) in degrees. East positive. */
  deviation: number
}

export function defaultCompass(): CompassState {
  return {
    center: { x: CHART_WIDTH * 0.75, y: CHART_HEIGHT * 0.6 },
    radius: 90,
    variation: 2,
    deviation: 0,
  }
}

/** Beschickungswinkel (variation + deviation) in degrees. */
export function compassTotalCorrection(c: CompassState): number {
  return c.variation + c.deviation
}

// ---- Ruler ------------------------------------------------------------------

export interface RulerState {
  from?: LatLon
  to?: LatLon
}

// ---- Dividers ---------------------------------------------------------------

export interface DividersState {
  from?: LatLon
  to?: LatLon
}

// ---- Pencil / Eraser --------------------------------------------------------
//
// Freehand drawing. Each stroke is a list of chart-space points. Multiple
// strokes keep an undo stack.

export interface Stroke {
  id: number
  points: Pixel[]
  color: string
  width: number
}

export interface PencilState {
  strokes: Stroke[]
  nextId: number
  currentColor: string
  currentWidth: number
}

export function defaultPencil(): PencilState {
  return {
    strokes: [],
    nextId: 1,
    currentColor: '#1e405b',
    currentWidth: 1.5,
  }
}

export function undoLastStroke(p: PencilState): PencilState {
  if (p.strokes.length === 0) return p
  return { ...p, strokes: p.strokes.slice(0, -1) }
}

export function eraseStrokeAt(p: PencilState, point: Pixel, hitRadius = 8): PencilState {
  // Remove any stroke whose closest point is within hitRadius of (point).
  const kept = p.strokes.filter((s) => !strokeNearPoint(s, point, hitRadius))
  if (kept.length === p.strokes.length) return p
  return { ...p, strokes: kept }
}

function strokeNearPoint(s: Stroke, pt: Pixel, r: number): boolean {
  const r2 = r * r
  for (let i = 0; i < s.points.length; i++) {
    const p = s.points[i]!
    if (!p) continue
    const dx = p.x - pt.x
    const dy = p.y - pt.y
    if (dx * dx + dy * dy <= r2) return true
    // Also check segment-to-point distance against the previous point
    if (i > 0) {
      const q = s.points[i - 1]!
      const d = segPointDist2(q, p, pt)
      if (d <= r2) return true
    }
  }
  return false
}

function segPointDist2(a: Pixel, b: Pixel, p: Pixel): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    const px = p.x - a.x
    const py = p.y - a.y
    return px * px + py * py
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = a.x + t * dx - p.x
  const cy = a.y + t * dy - p.y
  return cx * cx + cy * cy
}

// ---- Utility ----------------------------------------------------------------

export function pixelToLatLon(p: Pixel): LatLon {
  return toLatLon(p)
}
export function latLonToPixel(ll: LatLon): Pixel {
  return toPixel(ll)
}
