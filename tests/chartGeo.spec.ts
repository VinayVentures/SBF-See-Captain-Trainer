import { describe, expect, it } from 'vitest'
import {
  bearingTrue,
  distanceNm,
  formatBearing,
  formatLat,
  formatLon,
  toLatLon,
  toPixel,
  CHART_WIDTH,
  CHART_HEIGHT,
} from '../src/engine/chartGeo'

describe('chart geometry', () => {
  it('projects + un-projects round-trip', () => {
    const points = [
      { lat: 53.9, lon: 7.5 },
      { lat: 54.0, lon: 8.0 },
      { lat: 53.6, lon: 8.4 },
    ]
    for (const p of points) {
      const px = toPixel(p)
      const back = toLatLon(px)
      expect(back.lat).toBeCloseTo(p.lat, 4)
      expect(back.lon).toBeCloseTo(p.lon, 4)
    }
  })

  it('respects chart bounds', () => {
    const nw = toPixel({ lat: 54.3, lon: 7.0 })
    const se = toPixel({ lat: 53.5, lon: 8.7 })
    expect(nw.x).toBeCloseTo(0, 1)
    expect(nw.y).toBeCloseTo(0, 1)
    expect(se.x).toBeCloseTo(CHART_WIDTH, 1)
    expect(se.y).toBeCloseTo(CHART_HEIGHT, 1)
  })

  it('distance in nautical miles — 1 minute of latitude ≈ 1 nm', () => {
    const d = distanceNm({ lat: 54.0, lon: 8.0 }, { lat: 54.0 + 1 / 60, lon: 8.0 })
    expect(d).toBeCloseTo(1, 2)
  })

  it('bearing — due north = 0°', () => {
    const b = bearingTrue({ lat: 53.9, lon: 8.0 }, { lat: 54.0, lon: 8.0 })
    expect(b).toBeCloseTo(0, 1)
  })

  it('bearing — due east ≈ 90°', () => {
    const b = bearingTrue({ lat: 54.0, lon: 8.0 }, { lat: 54.0, lon: 8.2 })
    expect(b).toBeCloseTo(90, 1)
  })

  it('bearing — due south = 180°', () => {
    const b = bearingTrue({ lat: 54.0, lon: 8.0 }, { lat: 53.9, lon: 8.0 })
    expect(b).toBeCloseTo(180, 1)
  })

  it('formatLat / formatLon produce ELWIS-style strings', () => {
    expect(formatLat(53.9)).toBe("N53°54.0'")
    expect(formatLon(8.1)).toBe("E008°06.0'")
  })

  it('formatBearing zero-pads to 3 digits', () => {
    expect(formatBearing(7)).toBe('007°')
    expect(formatBearing(247)).toBe('247°')
    expect(formatBearing(0)).toBe('000°')
  })
})
