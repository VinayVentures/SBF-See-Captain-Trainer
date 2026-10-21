/**
 * Chart geometry — mercator-ish projection for the German Bight region
 * covered by the ELWIS SBF-See navigation scenarios. Keeps lat/lon as
 * the authoritative coordinate system; converts to screen pixels for
 * rendering and back for cursor readouts.
 *
 * Chart extent is roughly N53.5-N54.3, E7.0-E8.7 — covers all 8
 * official scenarios with margin.
 */

export const CHART_BOUNDS = {
  south: 53.5,
  north: 54.3,
  west: 7.0,
  east: 8.7,
} as const

export interface LatLon {
  lat: number
  lon: number
}

export interface Pixel {
  x: number
  y: number
}

/**
 * The chart viewport in SVG user units. We use a 1000-unit-wide
 * canvas and compute height from the aspect ratio of the geographic
 * region (adjusted for mercator latitude scaling so a mile of lat
 * matches a mile of lon visually).
 */
export const CHART_WIDTH = 1000
const COS_MEAN_LAT = Math.cos(((CHART_BOUNDS.south + CHART_BOUNDS.north) / 2) * Math.PI / 180)
const LON_SPAN = CHART_BOUNDS.east - CHART_BOUNDS.west
const LAT_SPAN = CHART_BOUNDS.north - CHART_BOUNDS.south
export const CHART_HEIGHT = Math.round(CHART_WIDTH * (LAT_SPAN / (LON_SPAN * COS_MEAN_LAT)))

/** lat/lon -> SVG user units (0,0 at NW corner). */
export function toPixel(latlon: LatLon): Pixel {
  const x = ((latlon.lon - CHART_BOUNDS.west) / LON_SPAN) * CHART_WIDTH
  const y = ((CHART_BOUNDS.north - latlon.lat) / LAT_SPAN) * CHART_HEIGHT
  return { x, y }
}

/** SVG user units -> lat/lon. */
export function toLatLon(p: Pixel): LatLon {
  const lon = CHART_BOUNDS.west + (p.x / CHART_WIDTH) * LON_SPAN
  const lat = CHART_BOUNDS.north - (p.y / CHART_HEIGHT) * LAT_SPAN
  return { lat, lon }
}

/** Great-circle distance between two points in nautical miles (small-angle approx). */
export function distanceNm(a: LatLon, b: LatLon): number {
  const dLat = b.lat - a.lat
  const dLon = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  // 1' of latitude = 1 nm
  return Math.sqrt(dLat * dLat + dLon * dLon) * 60
}

/** True bearing from a to b in degrees (0..360). */
export function bearingTrue(a: LatLon, b: LatLon): number {
  const dLon = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  const dLat = b.lat - a.lat
  const rad = Math.atan2(dLon, dLat)
  const deg = (rad * 180) / Math.PI
  return (deg + 360) % 360
}

/** Format latitude in Nmm°mm.m' */
export function formatLat(lat: number): string {
  const deg = Math.floor(lat)
  const min = (lat - deg) * 60
  return `N${deg}°${min.toFixed(1).padStart(4, '0')}'`
}

/** Format longitude in Emmm°mm.m' */
export function formatLon(lon: number): string {
  const deg = Math.floor(lon)
  const min = (lon - deg) * 60
  return `E${deg.toString().padStart(3, '0')}°${min.toFixed(1).padStart(4, '0')}'`
}

export function formatBearing(deg: number): string {
  return `${deg.toFixed(0).padStart(3, '0')}°`
}
