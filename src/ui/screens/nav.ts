/**
 * Interactive navigation chart screen.
 *
 * Renders the derivative teaching chart as an SVG with pan + zoom,
 * provides a parallel ruler (for courses + bearings) and dividers (for
 * distance measurement). Live lat/lon readout updates on hover.
 *
 * This is an MVP. Still-to-ship tools: triangle (Kursdreieck),
 * rotating compass rose, pencil/eraser, multi-stroke undo, all 8
 * scenarios wired up.
 */

import { show } from '../router'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  bearingTrue,
  distanceNm,
  formatBearing,
  formatLat,
  formatLon,
  toLatLon,
  toPixel,
  type LatLon,
  type Pixel,
} from '../../engine/chartGeo'
import { BUOYS, CHART_METADATA, COASTLINES, DEPTH_CONTOURS } from '../../data/chartData'
import { CATALOGUE } from '../../data/catalogue'

type ToolId = 'none' | 'ruler' | 'dividers'

interface RulerState {
  from?: LatLon
  to?: LatLon
}

interface DividersState {
  from?: LatLon
  to?: LatLon
}

interface ChartView {
  tool: ToolId
  ruler: RulerState
  dividers: DividersState
  // Pan/zoom
  tx: number
  ty: number
  scale: number
  // Transient drag state
  isPanning: boolean
  panStart?: { x: number; y: number; tx: number; ty: number }
  activeScenario: number
}

let view: ChartView = {
  tool: 'none',
  ruler: {},
  dividers: {},
  tx: 0,
  ty: 0,
  scale: 1,
  isPanning: false,
  activeScenario: 1,
}

export function renderNav(): void {
  const root = document.getElementById('nav')
  if (!root) return

  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill">🧭 Navigation Chart</span>
    </div>

    <div class="hero">
      <h2>Interactive Chart — MVP</h2>
      <p>
        Pan with mouse/finger drag · zoom with wheel or pinch · pick a tool from the toolbar.
        <b>Parallel ruler</b> gives you true bearing and plot course lines; <b>dividers</b> measure
        distance in nautical miles.
      </p>
      <p class="muted" style="font-size:13px">
        ${escapeHtml(CHART_METADATA.warning)}
      </p>
    </div>

    <div class="card">
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <button data-tool="none" class="toolbtn">Pan</button>
        <button data-tool="ruler" class="toolbtn">📐 Parallel ruler</button>
        <button data-tool="dividers" class="toolbtn">📏 Dividers</button>
        <button class="secondary" data-action="clear">Clear plot</button>
        <button class="secondary" data-action="zoomin">+</button>
        <button class="secondary" data-action="zoomout">−</button>
        <button class="secondary" data-action="fit">⤢ Fit</button>
        <span class="pill" id="chart-coord">—</span>
      </div>

      <div id="chart-container" style="position:relative;background:#cfe3ec;border-radius:12px;overflow:hidden;touch-action:none">
        <svg id="chart-svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" style="width:100%;height:auto;display:block;cursor:grab" preserveAspectRatio="xMidYMid meet">
          <g id="chart-root"></g>
        </svg>
      </div>

      <div id="chart-readout" class="row" style="flex-wrap:wrap;gap:12px;margin-top:12px">
        <span class="pill" id="ruler-readout" hidden></span>
        <span class="pill" id="dividers-readout" hidden></span>
      </div>
    </div>

    <div class="card">
      <h3>📚 Scenario #${view.activeScenario} (demo)</h3>
      ${renderScenarioList()}
      <p class="muted">
        MVP shows scenario 1 — the full 8 scenarios will be wired in a follow-up. The chart extent
        covers all 8 scenario corners from the ELWIS catalogue.
      </p>
    </div>

    <div class="card">
      <h3>🗺 Chart provenance</h3>
      <p class="muted">${escapeHtml(CHART_METADATA.derivedFrom)}</p>
    </div>
  `

  attachHandlers()
  drawChart()
}

function renderScenarioList(): string {
  return `
    <ol>
      ${CATALOGUE.navScenarios.map((s) => `
        <li>
          <b>Scenario ${s.id}:</b> SW ${escapeHtml(s.swCorner.lat)}, ${escapeHtml(s.swCorner.lon)}
          → NE ${escapeHtml(s.neCorner.lat)}, ${escapeHtml(s.neCorner.lon)}
        </li>
      `).join('')}
    </ol>
  `
}

function attachHandlers(): void {
  const root = document.getElementById('nav')!
  root.querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))

  root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.tool = btn.dataset.tool as ToolId
      // Reset the active drag of the previous tool
      if (view.tool !== 'ruler') view.ruler = {}
      if (view.tool !== 'dividers') view.dividers = {}
      updateToolButtons()
      drawChart()
    })
  })
  updateToolButtons()

  root.querySelector<HTMLButtonElement>('[data-action=clear]')!
    .addEventListener('click', () => {
      view.ruler = {}
      view.dividers = {}
      drawChart()
    })
  root.querySelector<HTMLButtonElement>('[data-action=zoomin]')!
    .addEventListener('click', () => { zoom(1.25); drawChart() })
  root.querySelector<HTMLButtonElement>('[data-action=zoomout]')!
    .addEventListener('click', () => { zoom(1 / 1.25); drawChart() })
  root.querySelector<HTMLButtonElement>('[data-action=fit]')!
    .addEventListener('click', () => { view.tx = 0; view.ty = 0; view.scale = 1; drawChart() })

  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement | null
  if (!svg) return

  svg.addEventListener('pointerdown', onPointerDown)
  svg.addEventListener('pointermove', onPointerMove)
  svg.addEventListener('pointerup', onPointerUp)
  svg.addEventListener('pointercancel', onPointerUp)
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const delta = ev.deltaY < 0 ? 1.1 : 1 / 1.1
    zoom(delta, svgCoords(ev))
    drawChart()
  }, { passive: false })
}

function updateToolButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
    const active = btn.dataset.tool === view.tool
    btn.className = active ? 'toolbtn active' : 'toolbtn'
  })
}

function svgCoords(ev: { clientX: number; clientY: number }): Pixel {
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement
  const pt = svg.createSVGPoint()
  pt.x = ev.clientX
  pt.y = ev.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const inv = pt.matrixTransform(ctm.inverse())
  // Undo our pan/zoom to get the chart-space coords
  return {
    x: (inv.x - view.tx) / view.scale,
    y: (inv.y - view.ty) / view.scale,
  }
}

function onPointerDown(ev: PointerEvent): void {
  const p = svgCoords(ev)
  const latlon = toLatLon(p)
  if (view.tool === 'ruler') {
    view.ruler = { from: latlon, to: latlon }
  } else if (view.tool === 'dividers') {
    view.dividers = { from: latlon, to: latlon }
  } else {
    view.isPanning = true
    view.panStart = {
      x: ev.clientX,
      y: ev.clientY,
      tx: view.tx,
      ty: view.ty,
    }
    const svg = document.getElementById('chart-svg')! as unknown as SVGSVGElement
    svg.style.cursor = 'grabbing'
  }
  ;(ev.target as Element).setPointerCapture(ev.pointerId)
  drawChart()
}

function onPointerMove(ev: PointerEvent): void {
  const p = svgCoords(ev)
  const latlon = toLatLon(p)
  const coord = document.getElementById('chart-coord')
  if (coord) coord.textContent = `${formatLat(latlon.lat)}  ${formatLon(latlon.lon)}`

  if (view.tool === 'ruler' && view.ruler.from) {
    view.ruler.to = latlon
    drawChart()
  } else if (view.tool === 'dividers' && view.dividers.from) {
    view.dividers.to = latlon
    drawChart()
  } else if (view.isPanning && view.panStart) {
    // Translate in screen-space delta but keep in SVG user units via CTM
    const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const scale = ctm.a // uniform scale factor
    view.tx = view.panStart.tx + (ev.clientX - view.panStart.x) / scale
    view.ty = view.panStart.ty + (ev.clientY - view.panStart.y) / scale
    drawChart()
  }
}

function onPointerUp(ev: PointerEvent): void {
  view.isPanning = false
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement | null
  if (svg) svg.style.cursor = view.tool === 'none' ? 'grab' : 'crosshair'
  ;(ev.target as Element).releasePointerCapture?.(ev.pointerId)
}

function zoom(factor: number, anchor?: Pixel): void {
  const newScale = Math.max(0.3, Math.min(8, view.scale * factor))
  const effective = newScale / view.scale
  if (anchor) {
    // Zoom around the given chart-space anchor point
    const anchorScreenX = anchor.x * view.scale + view.tx
    const anchorScreenY = anchor.y * view.scale + view.ty
    view.tx = anchorScreenX - anchor.x * newScale
    view.ty = anchorScreenY - anchor.y * newScale
  } else {
    const cx = CHART_WIDTH / 2
    const cy = CHART_HEIGHT / 2
    view.tx = cx - (cx - view.tx) * effective
    view.ty = cy - (cy - view.ty) * effective
  }
  view.scale = newScale
}

function drawChart(): void {
  const g = document.getElementById('chart-root')
  if (!g) return
  const parts: string[] = []
  parts.push(`<g transform="translate(${view.tx} ${view.ty}) scale(${view.scale})">`)

  // Background water
  parts.push(`<rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#cfe3ec"/>`)

  // Depth contours
  for (const c of DEPTH_CONTOURS) {
    parts.push(polyline(c.points, c.stroke ?? '#9dc0d0', 1, '4 3'))
  }

  // Coastline fills + strokes
  for (const c of COASTLINES) {
    const d = polygonPath(c.points)
    parts.push(`<path d="${d}" fill="${c.fill ?? '#d7e5c7'}" stroke="${c.stroke ?? '#8db99a'}" stroke-width="1.5"/>`)
  }

  // Scenario #1 corners (demo)
  const scn = CATALOGUE.navScenarios.find((s) => s.id === view.activeScenario)
  if (scn) {
    const sw = parseLatLon(scn.swCorner.lat, scn.swCorner.lon)
    const ne = parseLatLon(scn.neCorner.lat, scn.neCorner.lon)
    if (sw && ne) {
      const pSw = toPixel(sw)
      const pNe = toPixel(ne)
      const x = Math.min(pSw.x, pNe.x)
      const y = Math.min(pSw.y, pNe.y)
      const w = Math.abs(pSw.x - pNe.x)
      const h = Math.abs(pSw.y - pNe.y)
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(251, 191, 36, 0.08)" stroke="#fbbf24" stroke-width="1" stroke-dasharray="6 4"/>`)
      parts.push(`<text x="${x + 4}" y="${y + 14}" fill="#b06d00" font-size="10" font-weight="bold">Scenario ${scn.id}</text>`)
    }
  }

  // Lat/lon graticule at whole-minute intervals
  parts.push(drawGraticule())

  // Buoys
  for (const b of BUOYS) {
    parts.push(drawBuoy(b))
  }

  // Tool overlays
  if (view.ruler.from && view.ruler.to) {
    parts.push(drawRuler(view.ruler.from, view.ruler.to))
  }
  if (view.dividers.from && view.dividers.to) {
    parts.push(drawDividers(view.dividers.from, view.dividers.to))
  }

  parts.push('</g>')
  g.innerHTML = parts.join('')

  // Update readouts
  updateReadouts()
}

function drawGraticule(): string {
  const out: string[] = []
  // 1' latitude lines
  for (let lat = Math.ceil(53.5 * 60) / 60; lat <= 54.3; lat += 1 / 60) {
    const a = toPixel({ lat, lon: 7.0 })
    const b = toPixel({ lat, lon: 8.7 })
    const major = Math.abs(lat * 60 - Math.round(lat * 60)) < 0.01 && Math.round(lat * 60) % 5 === 0
    out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${major ? '#7a98a8' : '#a3c0cf'}" stroke-width="${major ? 0.6 : 0.3}" />`)
    if (major) {
      out.push(`<text x="2" y="${a.y - 2}" fill="#406070" font-size="8">${formatLat(lat)}</text>`)
    }
  }
  // 1' longitude lines
  for (let lon = 7.0; lon <= 8.7; lon += 1 / 60) {
    const a = toPixel({ lat: 53.5, lon })
    const b = toPixel({ lat: 54.3, lon })
    const major = Math.abs(lon * 60 - Math.round(lon * 60)) < 0.01 && Math.round(lon * 60) % 5 === 0
    out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${major ? '#7a98a8' : '#a3c0cf'}" stroke-width="${major ? 0.6 : 0.3}" />`)
    if (major) {
      out.push(`<text x="${a.x + 2}" y="10" fill="#406070" font-size="8">${formatLon(lon)}</text>`)
    }
  }
  return out.join('')
}

function drawBuoy(b: { id: string; name: string; type: string; position: LatLon }): string {
  const p = toPixel(b.position)
  const r = 4
  const color = buoyColor(b.type)
  const shape = buoyShape(b.type, p, r)
  return `
    ${shape.replace('{{color}}', color)}
    <text x="${p.x + r + 2}" y="${p.y + 3}" fill="#1e405b" font-size="9" font-weight="bold">${b.name}</text>
  `
}

function buoyColor(type: string): string {
  switch (type) {
    case 'lateral-port': return '#d61e1e'
    case 'lateral-starboard': return '#1ea84c'
    case 'cardinal-n':
    case 'cardinal-e':
    case 'cardinal-s':
    case 'cardinal-w': return '#333'
    case 'safe-water': return '#d61e1e'
    case 'isolated-danger': return '#333'
    case 'special': return '#fbbf24'
    default: return '#333'
  }
}

function buoyShape(type: string, p: Pixel, r: number): string {
  if (type.startsWith('cardinal')) {
    return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#fde047" stroke="{{color}}" stroke-width="1.5"/>`
  }
  if (type === 'safe-water') {
    return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="white" stroke="{{color}}" stroke-width="1.5"/>`
  }
  if (type === 'lateral-port') {
    return `<rect x="${p.x - r}" y="${p.y - r}" width="${r * 2}" height="${r * 2}" fill="{{color}}" stroke="#333" stroke-width="0.5"/>`
  }
  if (type === 'lateral-starboard') {
    return `<polygon points="${p.x},${p.y - r} ${p.x + r},${p.y + r} ${p.x - r},${p.y + r}" fill="{{color}}" stroke="#333" stroke-width="0.5"/>`
  }
  return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="{{color}}"/>`
}

function drawRuler(from: LatLon, to: LatLon): string {
  const a = toPixel(from)
  const b = toPixel(to)
  // The ruler is a thick translucent line with parallel guide lines on either side
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const offset = 10
  return `
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#1e405b" stroke-width="1.5"/>
    <line x1="${a.x + nx * offset}" y1="${a.y + ny * offset}" x2="${b.x + nx * offset}" y2="${b.y + ny * offset}" stroke="#1e405b" stroke-width="0.8" opacity="0.5"/>
    <line x1="${a.x - nx * offset}" y1="${a.y - ny * offset}" x2="${b.x - nx * offset}" y2="${b.y - ny * offset}" stroke="#1e405b" stroke-width="0.8" opacity="0.5"/>
    <circle cx="${a.x}" cy="${a.y}" r="3" fill="#fbbf24"/>
    <circle cx="${b.x}" cy="${b.y}" r="3" fill="#fbbf24"/>
  `
}

function drawDividers(from: LatLon, to: LatLon): string {
  const a = toPixel(from)
  const b = toPixel(to)
  return `
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#9c3cff" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle cx="${a.x}" cy="${a.y}" r="4" fill="none" stroke="#9c3cff" stroke-width="1.5"/>
    <circle cx="${b.x}" cy="${b.y}" r="4" fill="none" stroke="#9c3cff" stroke-width="1.5"/>
  `
}

function updateReadouts(): void {
  const rulerEl = document.getElementById('ruler-readout') as HTMLElement
  if (view.ruler.from && view.ruler.to) {
    const bearing = bearingTrue(view.ruler.from, view.ruler.to)
    rulerEl.hidden = false
    rulerEl.textContent = `📐 rwK ${formatBearing(bearing)}`
  } else {
    rulerEl.hidden = true
  }
  const divEl = document.getElementById('dividers-readout') as HTMLElement
  if (view.dividers.from && view.dividers.to) {
    const d = distanceNm(view.dividers.from, view.dividers.to)
    divEl.hidden = false
    divEl.textContent = `📏 ${d.toFixed(2)} nm`
  } else {
    divEl.hidden = true
  }
}

function polyline(points: LatLon[], stroke: string, width: number, dash?: string): string {
  const pts = points.map((p) => {
    const px = toPixel(p)
    return `${px.x},${px.y}`
  }).join(' ')
  return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function polygonPath(points: LatLon[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => {
      const px = toPixel(p)
      return `${i === 0 ? 'M' : 'L'} ${px.x} ${px.y}`
    })
    .join(' ') + ' Z'
}

/** Parse "N53°46.06'" style strings coming from the catalogue. */
function parseLatLon(latStr: string, lonStr: string): LatLon | undefined {
  const latMatch = latStr.match(/N(\d+)°(\d+\.\d+)/)
  const lonMatch = lonStr.match(/E(\d+)°(\d+\.\d+)/)
  if (!latMatch || !lonMatch) return undefined
  return {
    lat: parseInt(latMatch[1]!, 10) + parseFloat(latMatch[2]!) / 60,
    lon: parseInt(lonMatch[1]!, 10) + parseFloat(lonMatch[2]!) / 60,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
