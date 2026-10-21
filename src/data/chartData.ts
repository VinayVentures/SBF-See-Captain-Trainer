/**
 * Derivative teaching chart for the German Bight (Jade/Weser/Elbe
 * approaches). Hand-drawn simplified coastline + a few named marks.
 * Not a reproduction of D49 — we drew our own stylized geometry from
 * public-domain coordinate data (Wikipedia OSM coastline, BSH buoyage
 * public register). Legally clean for a public PWA.
 *
 * All coordinates are in lat/lon (WGS84); the chartGeo projector
 * converts them to SVG user units at render time.
 */

import type { LatLon } from '../engine/chartGeo'

export interface ChartFeature {
  kind: 'coast' | 'shoal' | 'depth' | 'landmark'
  name?: string
  points: LatLon[]
  fill?: string
  stroke?: string
}

export interface Buoy {
  id: string
  name: string
  type: 'cardinal-n' | 'cardinal-e' | 'cardinal-s' | 'cardinal-w' | 'lateral-port' | 'lateral-starboard' | 'safe-water' | 'isolated-danger' | 'special'
  position: LatLon
}

/**
 * Simplified coastline polylines. These are hand-sampled from the
 * public OpenStreetMap coastline at the ~1:300k generalization level,
 * rounded to 0.01° so they're clearly stylized rather than copies.
 */
export const COASTLINES: ChartFeature[] = [
  // Ostfriesland + East Frisian islands (very simplified)
  {
    kind: 'coast',
    name: 'East Frisian coast',
    points: [
      { lat: 53.60, lon: 7.00 },
      { lat: 53.62, lon: 7.20 },
      { lat: 53.63, lon: 7.40 },
      { lat: 53.64, lon: 7.60 },
      { lat: 53.63, lon: 7.80 },
      { lat: 53.65, lon: 8.00 },
      { lat: 53.60, lon: 8.10 },
      { lat: 53.52, lon: 8.12 },
      { lat: 53.50, lon: 8.14 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Wangerooge island
  {
    kind: 'coast',
    name: 'Wangerooge',
    points: [
      { lat: 53.78, lon: 7.86 },
      { lat: 53.80, lon: 7.92 },
      { lat: 53.80, lon: 7.95 },
      { lat: 53.78, lon: 7.94 },
      { lat: 53.78, lon: 7.86 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Spiekeroog
  {
    kind: 'coast',
    name: 'Spiekeroog',
    points: [
      { lat: 53.76, lon: 7.70 },
      { lat: 53.78, lon: 7.78 },
      { lat: 53.77, lon: 7.80 },
      { lat: 53.76, lon: 7.72 },
      { lat: 53.76, lon: 7.70 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Langeoog
  {
    kind: 'coast',
    name: 'Langeoog',
    points: [
      { lat: 53.73, lon: 7.47 },
      { lat: 53.76, lon: 7.60 },
      { lat: 53.74, lon: 7.62 },
      { lat: 53.73, lon: 7.47 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Jade peninsula to Wesermündung (shortened approximation)
  {
    kind: 'coast',
    name: 'Butjadingen',
    points: [
      { lat: 53.60, lon: 8.10 },
      { lat: 53.56, lon: 8.14 },
      { lat: 53.55, lon: 8.20 },
      { lat: 53.52, lon: 8.26 },
      { lat: 53.52, lon: 8.35 },
      { lat: 53.55, lon: 8.40 },
      { lat: 53.60, lon: 8.42 },
      { lat: 53.65, lon: 8.44 },
      { lat: 53.72, lon: 8.46 },
      { lat: 53.80, lon: 8.48 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Weser mouth to Cuxhaven
  {
    kind: 'coast',
    name: 'Elbe-Weser-Dreieck',
    points: [
      { lat: 53.80, lon: 8.48 },
      { lat: 53.85, lon: 8.52 },
      { lat: 53.88, lon: 8.60 },
      { lat: 53.87, lon: 8.68 },
      { lat: 53.86, lon: 8.70 },
      { lat: 53.85, lon: 8.68 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
  // Nordfriesland (very simplified — north bank beyond Cuxhaven)
  {
    kind: 'coast',
    name: 'Nordfriesland',
    points: [
      { lat: 54.00, lon: 8.70 },
      { lat: 54.05, lon: 8.68 },
      { lat: 54.15, lon: 8.65 },
      { lat: 54.25, lon: 8.65 },
      { lat: 54.30, lon: 8.70 },
    ],
    stroke: '#8db99a',
    fill: '#d7e5c7',
  },
]

/** Depth contours (illustrative — not surveyed). Stylized to help orient. */
export const DEPTH_CONTOURS: ChartFeature[] = [
  // 10 m contour (indicative)
  {
    kind: 'depth',
    name: '10 m',
    points: [
      { lat: 53.70, lon: 7.00 },
      { lat: 53.75, lon: 7.40 },
      { lat: 53.80, lon: 7.80 },
      { lat: 53.90, lon: 8.00 },
      { lat: 54.00, lon: 8.20 },
      { lat: 54.10, lon: 8.40 },
    ],
    stroke: '#9dc0d0',
  },
  // 20 m contour
  {
    kind: 'depth',
    name: '20 m',
    points: [
      { lat: 53.90, lon: 7.00 },
      { lat: 54.00, lon: 7.40 },
      { lat: 54.10, lon: 7.80 },
      { lat: 54.15, lon: 8.00 },
      { lat: 54.20, lon: 8.20 },
      { lat: 54.25, lon: 8.40 },
    ],
    stroke: '#9dc0d0',
  },
]

/**
 * A sample of buoys/marks around the Jade/Weser approaches.
 * Positions approximated from the public BSH buoyage listing but
 * rounded to 0.01' as a visibility-only subset for teaching.
 */
export const BUOYS: Buoy[] = [
  // Jade approach fairway marks
  { id: 'jade-1', name: 'Jade1', type: 'safe-water', position: { lat: 53.9500, lon: 8.0583 } },
  { id: 'jade-2', name: 'Jade2', type: 'lateral-port', position: { lat: 53.8700, lon: 8.1000 } },
  { id: 'jade-3', name: 'Jade3', type: 'lateral-starboard', position: { lat: 53.8300, lon: 8.1300 } },
  // Weser approach
  { id: 'weser-a', name: 'A/Weser', type: 'safe-water', position: { lat: 54.0167, lon: 8.1250 } },
  { id: 'weser-1', name: 'W1', type: 'lateral-starboard', position: { lat: 53.9500, lon: 8.1667 } },
  // Cardinal marks (illustrative)
  { id: 'tw-ems', name: 'TW/Ems', type: 'cardinal-n', position: { lat: 53.9833, lon: 7.0000 } },
  { id: 'knb', name: 'KnB', type: 'cardinal-w', position: { lat: 53.9000, lon: 7.5000 } },
  { id: 'rz', name: 'RZ', type: 'cardinal-s', position: { lat: 53.8333, lon: 7.9000 } },
  // Elbe approach
  { id: 'elbe-1', name: 'Elbe1', type: 'safe-water', position: { lat: 54.0000, lon: 8.1167 } },
]

export const CHART_METADATA = {
  title: 'Teaching chart — German Bight (derivative, not for navigation)',
  derivedFrom:
    'Simplified from public coastline data (OpenStreetMap) and public BSH buoyage register. ' +
    'Not a reproduction of BSH chart D49.',
  warning:
    'This chart is a stylized teaching aid. Positions and depths are approximations and must ' +
    'not be used for real navigation. For the official exam you will work on the physical ' +
    'BSH Übungskarte D49.',
} as const
