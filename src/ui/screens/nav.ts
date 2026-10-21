/**
 * Navigation Chart room — full tool kit.
 *
 * Interactive SVG chart with pan + wheel/pinch zoom, overlayed draggable
 * instruments (triangle / parallel ruler / dividers / compass rose),
 * freehand pencil + eraser, live coordinate + bearing + distance readouts,
 * and all 8 ELWIS scenarios selectable from a scenario picker.
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
import {
  compassTotalCorrection,
  defaultCompass,
  defaultPencil,
  defaultTriangle,
  eraseStrokeAt,
  pixelToLatLon,
  triangleApex,
  triangleCorners,
  triangleCourse,
  triangleHypotenuse,
  undoLastStroke,
  type CompassState,
  type DividersState,
  type PencilState,
  type RulerState,
  type ToolId,
  type TriangleState,
  type Stroke,
} from '../../engine/chartTools'
import { BUOYS, CHART_METADATA, COASTLINES, DEPTH_CONTOURS } from '../../data/chartData'
import { CATALOGUE } from '../../data/catalogue'

interface ChartView {
  tool: ToolId
  // Pan / zoom
  tx: number
  ty: number
  scale: number
  // Tool state
  ruler: RulerState
  dividers: DividersState
  triangle: TriangleState
  compass: CompassState
  pencil: PencilState
  // Active drawing stroke
  activeStrokeId?: number
  // Pointer state
  isPanning: boolean
  panStart?: { x: number; y: number; tx: number; ty: number }
  // Which tool element the pointer grabbed, and the drag offset
  grab?: {
    kind:
      | 'ruler-line'
      | 'dividers-line'
      | 'triangle-body'
      | 'triangle-apex'
      | 'compass-body'
      | 'compass-rot'
      | 'pencil'
      | 'eraser'
    offset: { x: number; y: number }
  }
  // Pinch
  pinch?: { d: number; cx: number; cy: number; scale: number; tx: number; ty: number }
  pointers: Map<number, { x: number; y: number }>
  // Scenario selection
  activeScenario: number
}

let view: ChartView = freshView()

function freshView(): ChartView {
  return {
    tool: 'none',
    tx: 0,
    ty: 0,
    scale: 1,
    ruler: {},
    dividers: {},
    triangle: defaultTriangle(),
    compass: defaultCompass(),
    pencil: defaultPencil(),
    isPanning: false,
    pointers: new Map(),
    activeScenario: 1,
  }
}

export function renderNav(): void {
  const root = document.getElementById('nav')
  if (!root) return

  root.innerHTML = `
    <div class="top">
      <button class="secondary" data-action="back">← Bridge</button>
      <span class="pill">🧭 Chart Room</span>
    </div>

    <div class="hero">
      <h2>Interactive Chart Room</h2>
      <p class="muted" style="font-size:13px">
        ${escapeHtml(CHART_METADATA.warning)}
      </p>
    </div>

    <div class="card">
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <button data-tool="none" class="toolbtn" title="Pan the chart">🖐 Pan</button>
        <button data-tool="ruler" class="toolbtn" title="Parallel ruler — bearing">📐 Ruler</button>
        <button data-tool="triangle" class="toolbtn" title="Course triangle (Kursdreieck)">📐 Triangle</button>
        <button data-tool="dividers" class="toolbtn" title="Dividers — distance">📏 Dividers</button>
        <button data-tool="compass" class="toolbtn" title="Compass rose — variation & deviation">🧭 Compass</button>
        <button data-tool="pencil" class="toolbtn" title="Freehand pencil">✏️ Pencil</button>
        <button data-tool="eraser" class="toolbtn" title="Erase strokes">🧽 Eraser</button>
      </div>

      <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <button class="secondary" data-action="undo" title="Undo last pencil stroke">↶ Undo</button>
        <button class="secondary" data-action="clear" title="Clear all tool traces">Clear plot</button>
        <button class="secondary" data-action="zoomin">+</button>
        <button class="secondary" data-action="zoomout">−</button>
        <button class="secondary" data-action="fit">⤢ Fit</button>
        <span class="pill" id="chart-coord" style="min-width:170px;text-align:center">—</span>
      </div>

      <div id="chart-container" style="position:relative;background:#cfe3ec;border-radius:12px;overflow:hidden;touch-action:none">
        <svg id="chart-svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" style="width:100%;height:auto;display:block;cursor:grab" preserveAspectRatio="xMidYMid meet">
          <g id="chart-root"></g>
        </svg>
      </div>

      <div id="chart-readout" class="row" style="flex-wrap:wrap;gap:12px;margin-top:12px">
        <span class="pill" id="ruler-readout" hidden></span>
        <span class="pill" id="dividers-readout" hidden></span>
        <span class="pill" id="triangle-readout" hidden></span>
        <span class="pill" id="compass-readout" hidden></span>
      </div>
    </div>

    <div class="card">
      <h3>🧭 Compass settings</h3>
      <div class="row" style="flex-wrap:wrap;gap:12px">
        <label style="flex:1;min-width:150px">
          Variation (Missweisung) °
          <input type="number" step="0.1" id="compass-var" value="${view.compass.variation}" />
        </label>
        <label style="flex:1;min-width:150px">
          Deviation (Ablenkung) °
          <input type="number" step="0.1" id="compass-dev" value="${view.compass.deviation}" />
        </label>
      </div>
      <p class="muted" style="font-size:13px;margin-bottom:0">
        Positive = east. Beschickung total = <b id="compass-total">${(view.compass.variation + view.compass.deviation).toFixed(1)}°</b>.
        Use <b>Kompass → Magnet → Kurs</b> conversion by subtracting / adding this on the rose.
      </p>
    </div>

    <div class="card">
      <h3>📚 Scenarios</h3>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${CATALOGUE.navScenarios.map((s) => `
          <button class="toolbtn ${s.id === view.activeScenario ? 'active' : ''}" data-scenario="${s.id}">Scenario ${s.id}</button>
        `).join('')}
      </div>
      <p class="muted" style="font-size:13px" id="scenario-detail"></p>
      <h4 style="margin-top:12px">Nav templates (Q286–Q300)</h4>
      <ol style="margin:4px 0 0 0;padding-left:22px">
        ${CATALOGUE.navTemplates.map((t) => `
          <li><b>Q${t.id}</b> [${t.answerShape}] — ${escapeHtml(t.de)}</li>
        `).join('')}
      </ol>
    </div>

    <div class="card">
      <h3>🗺 Chart provenance</h3>
      <p class="muted">${escapeHtml(CHART_METADATA.derivedFrom)}</p>
    </div>
  `

  attachHandlers()
  updateScenarioDetail()
  drawChart()
}

function updateScenarioDetail(): void {
  const el = document.getElementById('scenario-detail')
  const s = CATALOGUE.navScenarios.find((x) => x.id === view.activeScenario)
  if (!el || !s) return
  el.innerHTML = `
    <b>Scenario ${s.id}:</b> SW ${escapeHtml(s.swCorner.lat)} / ${escapeHtml(s.swCorner.lon)}
    &nbsp;→&nbsp; NE ${escapeHtml(s.neCorner.lat)} / ${escapeHtml(s.neCorner.lon)}
  `
}

function attachHandlers(): void {
  const root = document.getElementById('nav')!

  root.querySelector<HTMLButtonElement>('[data-action=back]')!
    .addEventListener('click', () => show('home'))

  root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.tool = btn.dataset.tool as ToolId
      updateToolButtons()
      drawChart()
    })
  })
  updateToolButtons()

  root.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.activeScenario = Number(btn.dataset.scenario)
      updateScenarioButtons()
      updateScenarioDetail()
      drawChart()
    })
  })

  root.querySelector<HTMLButtonElement>('[data-action=undo]')!
    .addEventListener('click', () => {
      view.pencil = undoLastStroke(view.pencil)
      drawChart()
    })

  root.querySelector<HTMLButtonElement>('[data-action=clear]')!
    .addEventListener('click', () => {
      view.ruler = {}
      view.dividers = {}
      view.pencil = defaultPencil()
      drawChart()
    })

  root.querySelector<HTMLButtonElement>('[data-action=zoomin]')!
    .addEventListener('click', () => { zoom(1.25); drawChart() })
  root.querySelector<HTMLButtonElement>('[data-action=zoomout]')!
    .addEventListener('click', () => { zoom(1 / 1.25); drawChart() })
  root.querySelector<HTMLButtonElement>('[data-action=fit]')!
    .addEventListener('click', () => { view.tx = 0; view.ty = 0; view.scale = 1; drawChart() })

  const varInput = document.getElementById('compass-var') as HTMLInputElement
  const devInput = document.getElementById('compass-dev') as HTMLInputElement
  const updateCompass = () => {
    view.compass.variation = Number(varInput.value) || 0
    view.compass.deviation = Number(devInput.value) || 0
    const total = document.getElementById('compass-total')
    if (total) total.textContent = `${compassTotalCorrection(view.compass).toFixed(1)}°`
    drawChart()
  }
  varInput.addEventListener('input', updateCompass)
  devInput.addEventListener('input', updateCompass)

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
    btn.className = btn.dataset.tool === view.tool ? 'toolbtn active' : 'toolbtn'
  })
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement | null
  if (svg) svg.style.cursor = view.tool === 'none' ? 'grab' : 'crosshair'
}

function updateScenarioButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((btn) => {
    const on = Number(btn.dataset.scenario) === view.activeScenario
    btn.className = on ? 'toolbtn active' : 'toolbtn'
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
  return {
    x: (inv.x - view.tx) / view.scale,
    y: (inv.y - view.ty) / view.scale,
  }
}

function distance(a: Pixel, b: Pixel): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/**
 * Pick which (if any) tool element the pointer is grabbing. Priority:
 * explicit tool first (triangle apex > triangle body if the triangle tool
 * is active), then anything draggable regardless of tool.
 */
function pickGrab(p: Pixel): ChartView['grab'] {
  // Triangle handles (always draggable so user can position without
  // reselecting the tool each time)
  const apex = triangleApex(view.triangle)
  if (distance(p, apex) < 14 / view.scale) {
    return { kind: 'triangle-apex', offset: { x: 0, y: 0 } }
  }
  if (pointInTriangle(p, triangleCorners(view.triangle))) {
    return { kind: 'triangle-body', offset: { x: p.x - view.triangle.center.x, y: p.y - view.triangle.center.y } }
  }
  // Compass handles
  const cDist = distance(p, view.compass.center)
  if (cDist < 10 / view.scale) {
    return { kind: 'compass-body', offset: { x: 0, y: 0 } }
  }
  if (Math.abs(cDist - view.compass.radius) < 10 / view.scale) {
    return { kind: 'compass-rot', offset: { x: 0, y: 0 } }
  }
  return undefined
}

function pointInTriangle(p: Pixel, tri: [Pixel, Pixel, Pixel]): boolean {
  const [a, b, c] = tri
  const d1 = sign(p, a, b)
  const d2 = sign(p, b, c)
  const d3 = sign(p, c, a)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}
function sign(p: Pixel, a: Pixel, b: Pixel): number {
  return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y)
}

function onPointerDown(ev: PointerEvent): void {
  view.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  ;(ev.target as Element).setPointerCapture(ev.pointerId)

  // Two-finger pinch
  if (view.pointers.size === 2) {
    startPinch()
    return
  }

  const p = svgCoords(ev)
  const latlon = toLatLon(p)

  // Pencil / eraser take precedence when selected
  if (view.tool === 'pencil') {
    const stroke: Stroke = {
      id: view.pencil.nextId,
      points: [p],
      color: view.pencil.currentColor,
      width: view.pencil.currentWidth,
    }
    view.pencil = {
      ...view.pencil,
      strokes: [...view.pencil.strokes, stroke],
      nextId: view.pencil.nextId + 1,
    }
    view.activeStrokeId = stroke.id
    view.grab = { kind: 'pencil', offset: { x: 0, y: 0 } }
    drawChart()
    return
  }
  if (view.tool === 'eraser') {
    view.pencil = eraseStrokeAt(view.pencil, p)
    view.grab = { kind: 'eraser', offset: { x: 0, y: 0 } }
    drawChart()
    return
  }

  // Then check if we're grabbing a draggable instrument
  const grab = pickGrab(p)
  if (grab) {
    view.grab = grab
    drawChart()
    return
  }

  // Then tool-specific drag-to-place behavior
  if (view.tool === 'ruler') {
    view.ruler = { from: latlon, to: latlon }
    view.grab = { kind: 'ruler-line', offset: { x: 0, y: 0 } }
    drawChart()
    return
  }
  if (view.tool === 'dividers') {
    view.dividers = { from: latlon, to: latlon }
    view.grab = { kind: 'dividers-line', offset: { x: 0, y: 0 } }
    drawChart()
    return
  }

  // Fallback: pan
  view.isPanning = true
  view.panStart = { x: ev.clientX, y: ev.clientY, tx: view.tx, ty: view.ty }
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement
  svg.style.cursor = 'grabbing'
}

function onPointerMove(ev: PointerEvent): void {
  if (view.pointers.has(ev.pointerId)) {
    view.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  }

  if (view.pointers.size === 2 && view.pinch) {
    updatePinch()
    drawChart()
    return
  }

  const p = svgCoords(ev)
  const latlon = toLatLon(p)
  const coord = document.getElementById('chart-coord')
  if (coord) coord.textContent = `${formatLat(latlon.lat)}  ${formatLon(latlon.lon)}`

  if (view.grab) {
    switch (view.grab.kind) {
      case 'ruler-line':
        view.ruler.to = latlon
        break
      case 'dividers-line':
        view.dividers.to = latlon
        break
      case 'triangle-body':
        view.triangle.center = {
          x: p.x - view.grab.offset.x,
          y: p.y - view.grab.offset.y,
        }
        break
      case 'triangle-apex': {
        // Rotation: angle from triangle center to pointer, offset by -90°
        // so dragging the apex straight up (-y) gives rotation=0 (north).
        const dx = p.x - view.triangle.center.x
        const dy = p.y - view.triangle.center.y
        view.triangle.rotation = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
        break
      }
      case 'compass-body':
        view.compass.center = p
        break
      case 'compass-rot':
        view.compass.radius = Math.max(
          30,
          Math.min(
            300,
            Math.hypot(p.x - view.compass.center.x, p.y - view.compass.center.y),
          ),
        )
        break
      case 'pencil': {
        const stroke = view.pencil.strokes[view.pencil.strokes.length - 1]
        if (stroke && stroke.id === view.activeStrokeId) {
          stroke.points.push(p)
        }
        break
      }
      case 'eraser':
        view.pencil = eraseStrokeAt(view.pencil, p)
        break
    }
    drawChart()
    return
  }

  if (view.isPanning && view.panStart) {
    const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const scale = ctm.a
    view.tx = view.panStart.tx + (ev.clientX - view.panStart.x) / scale
    view.ty = view.panStart.ty + (ev.clientY - view.panStart.y) / scale
    drawChart()
  }
}

function onPointerUp(ev: PointerEvent): void {
  view.pointers.delete(ev.pointerId)
  if (view.pointers.size < 2) {
    view.pinch = undefined
  }
  view.grab = undefined
  view.activeStrokeId = undefined
  view.isPanning = false
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement | null
  if (svg) svg.style.cursor = view.tool === 'none' ? 'grab' : 'crosshair'
  ;(ev.target as Element).releasePointerCapture?.(ev.pointerId)
}

function startPinch(): void {
  const pts = Array.from(view.pointers.values())
  if (pts.length < 2) return
  const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }]
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  view.pinch = {
    d,
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
    scale: view.scale,
    tx: view.tx,
    ty: view.ty,
  }
}

function updatePinch(): void {
  if (!view.pinch) return
  const pts = Array.from(view.pointers.values())
  if (pts.length < 2) return
  const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }]
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const factor = d / view.pinch.d
  const target = Math.max(0.3, Math.min(8, view.pinch.scale * factor))
  const svg = document.getElementById('chart-svg') as unknown as SVGSVGElement
  const pt = svg.createSVGPoint()
  pt.x = view.pinch.cx
  pt.y = view.pinch.cy
  const inv = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  const anchorX = (inv.x - view.pinch.tx) / view.pinch.scale
  const anchorY = (inv.y - view.pinch.ty) / view.pinch.scale
  view.scale = target
  view.tx = inv.x - anchorX * target
  view.ty = inv.y - anchorY * target
}

function zoom(factor: number, anchor?: Pixel): void {
  const newScale = Math.max(0.3, Math.min(8, view.scale * factor))
  const effective = newScale / view.scale
  if (anchor) {
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

// ---- Drawing ---------------------------------------------------------------

function drawChart(): void {
  const g = document.getElementById('chart-root')
  if (!g) return
  const parts: string[] = []
  parts.push(`<g transform="translate(${view.tx} ${view.ty}) scale(${view.scale})">`)

  parts.push(`<rect x="0" y="0" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#cfe3ec"/>`)

  for (const c of DEPTH_CONTOURS) {
    parts.push(polyline(c.points, c.stroke ?? '#9dc0d0', 1, '4 3'))
  }

  for (const c of COASTLINES) {
    const d = polygonPath(c.points)
    parts.push(`<path d="${d}" fill="${c.fill ?? '#d7e5c7'}" stroke="${c.stroke ?? '#8db99a'}" stroke-width="1.5"/>`)
  }

  // Scenario overlay
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

  // Graticule
  parts.push(drawGraticule())

  // Buoys
  for (const b of BUOYS) {
    parts.push(drawBuoy(b))
  }

  // Pencil strokes
  for (const s of view.pencil.strokes) {
    parts.push(drawStroke(s))
  }

  // Tools (drawn last so they're on top)
  if (view.ruler.from && view.ruler.to) {
    parts.push(drawRuler(view.ruler.from, view.ruler.to))
  }
  if (view.dividers.from && view.dividers.to) {
    parts.push(drawDividers(view.dividers.from, view.dividers.to))
  }
  // Triangle and compass are always visible if their tool was ever selected
  // — once you place them, they stay on the chart.
  parts.push(drawTriangle(view.triangle))
  parts.push(drawCompass(view.compass))

  parts.push('</g>')
  g.innerHTML = parts.join('')

  updateReadouts()
}

function drawGraticule(): string {
  const out: string[] = []
  for (let lat = 53.5; lat <= 54.3 + 1e-6; lat += 1 / 60) {
    const a = toPixel({ lat, lon: 7.0 })
    const b = toPixel({ lat, lon: 8.7 })
    const latMinRounded = Math.round(lat * 60)
    const major = Math.abs(lat * 60 - latMinRounded) < 0.01 && latMinRounded % 5 === 0
    out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${major ? '#7a98a8' : '#a3c0cf'}" stroke-width="${major ? 0.6 : 0.3}" />`)
    if (major) {
      out.push(`<text x="2" y="${a.y - 2}" fill="#406070" font-size="8">${formatLat(lat)}</text>`)
    }
  }
  for (let lon = 7.0; lon <= 8.7 + 1e-6; lon += 1 / 60) {
    const a = toPixel({ lat: 53.5, lon })
    const b = toPixel({ lat: 54.3, lon })
    const lonMinRounded = Math.round(lon * 60)
    const major = Math.abs(lon * 60 - lonMinRounded) < 0.01 && lonMinRounded % 5 === 0
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
    <text x="${p.x + r + 2}" y="${p.y + 3}" fill="#1e405b" font-size="9" font-weight="bold">${escapeHtml(b.name)}</text>
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
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const o = 10
  return `
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#1e405b" stroke-width="1.5"/>
    <line x1="${a.x + nx * o}" y1="${a.y + ny * o}" x2="${b.x + nx * o}" y2="${b.y + ny * o}" stroke="#1e405b" stroke-width="0.8" opacity="0.5"/>
    <line x1="${a.x - nx * o}" y1="${a.y - ny * o}" x2="${b.x - nx * o}" y2="${b.y - ny * o}" stroke="#1e405b" stroke-width="0.8" opacity="0.5"/>
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

function drawTriangle(t: TriangleState): string {
  const [apex, left, right] = triangleCorners(t)
  const [hA, hB] = triangleHypotenuse(t)
  const pts = `${apex.x},${apex.y} ${left.x},${left.y} ${right.x},${right.y}`
  // Degree ticks along the hypotenuse — simplified representation
  const steps = 10
  const ticks: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t2 = i / steps
    const x = hA.x + (hB.x - hA.x) * t2
    const y = hA.y + (hB.y - hA.y) * t2
    ticks.push(`<circle cx="${x}" cy="${y}" r="1.5" fill="#1e405b" />`)
  }
  // Course arrow from midpoint of hypotenuse toward apex
  const midX = (hA.x + hB.x) / 2
  const midY = (hA.y + hB.y) / 2
  return `
    <polygon points="${pts}" fill="rgba(251, 191, 36, 0.15)" stroke="#b06d00" stroke-width="1.5"/>
    <line x1="${hA.x}" y1="${hA.y}" x2="${hB.x}" y2="${hB.y}" stroke="#b06d00" stroke-width="2.5"/>
    ${ticks.join('')}
    <line x1="${midX}" y1="${midY}" x2="${apex.x}" y2="${apex.y}" stroke="#b06d00" stroke-width="1" stroke-dasharray="3 2"/>
    <circle cx="${apex.x}" cy="${apex.y}" r="7" fill="#fbbf24" stroke="#b06d00" stroke-width="1.5"/>
    <text x="${apex.x}" y="${apex.y + 3}" text-anchor="middle" fill="#1e405b" font-size="9" font-weight="bold">↻</text>
  `
}

function drawCompass(c: CompassState): string {
  const r = c.radius
  const cx = c.center.x
  const cy = c.center.y
  const ticks: string[] = []
  for (let deg = 0; deg < 360; deg += 10) {
    const long = deg % 30 === 0
    const rad = (deg - 90) * Math.PI / 180
    const inner = r - (long ? 10 : 5)
    const outer = r
    const x1 = cx + Math.cos(rad) * inner
    const y1 = cy + Math.sin(rad) * inner
    const x2 = cx + Math.cos(rad) * outer
    const y2 = cy + Math.sin(rad) * outer
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e405b" stroke-width="${long ? 1 : 0.5}"/>`)
    if (long) {
      const lx = cx + Math.cos(rad) * (r - 20)
      const ly = cy + Math.sin(rad) * (r - 20) + 3
      ticks.push(`<text x="${lx}" y="${ly}" text-anchor="middle" fill="#1e405b" font-size="9">${deg}</text>`)
    }
  }
  // Magnetic rose offset by variation (red)
  const magTicks: string[] = []
  const varRad = (-c.variation) * Math.PI / 180
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg - 90) * Math.PI / 180 + varRad
    const inner = r * 0.75
    const outer = r * 0.85
    const x1 = cx + Math.cos(rad) * inner
    const y1 = cy + Math.sin(rad) * inner
    const x2 = cx + Math.cos(rad) * outer
    const y2 = cy + Math.sin(rad) * outer
    magTicks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d61e1e" stroke-width="1"/>`)
  }
  // Compass rose offset by variation + deviation (blue)
  const compTicks: string[] = []
  const totalRad = (-(c.variation + c.deviation)) * Math.PI / 180
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg - 90) * Math.PI / 180 + totalRad
    const inner = r * 0.55
    const outer = r * 0.65
    const x1 = cx + Math.cos(rad) * inner
    const y1 = cy + Math.sin(rad) * inner
    const x2 = cx + Math.cos(rad) * outer
    const y2 = cy + Math.sin(rad) * outer
    compTicks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1a53a8" stroke-width="1"/>`)
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.3)" stroke="#1e405b" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.85}" fill="none" stroke="#d61e1e" stroke-width="0.5" opacity="0.6"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.65}" fill="none" stroke="#1a53a8" stroke-width="0.5" opacity="0.6"/>
    ${ticks.join('')}
    ${magTicks.join('')}
    ${compTicks.join('')}
    <text x="${cx}" y="${cy - r + 14}" text-anchor="middle" fill="#1e405b" font-size="10" font-weight="bold">N</text>
    <circle cx="${cx}" cy="${cy}" r="3" fill="#1e405b"/>
    <circle cx="${cx + r}" cy="${cy}" r="4" fill="#fbbf24" stroke="#b06d00" stroke-width="1"/>
  `
}

function drawStroke(s: Stroke): string {
  if (s.points.length === 0) return ''
  const d = s.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function updateReadouts(): void {
  const rulerEl = document.getElementById('ruler-readout') as HTMLElement
  if (view.ruler.from && view.ruler.to) {
    const bearing = bearingTrue(view.ruler.from, view.ruler.to)
    const dist = distanceNm(view.ruler.from, view.ruler.to)
    rulerEl.hidden = false
    rulerEl.textContent = `📐 rwK ${formatBearing(bearing)} · ${dist.toFixed(2)} nm`
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
  const triEl = document.getElementById('triangle-readout') as HTMLElement
  const triCourse = triangleCourse(view.triangle)
  triEl.hidden = false
  triEl.textContent = `△ rwK ${formatBearing(triCourse)}`
  const compassEl = document.getElementById('compass-readout') as HTMLElement
  compassEl.hidden = false
  const total = compassTotalCorrection(view.compass)
  compassEl.textContent = `🧭 var ${view.compass.variation.toFixed(1)}° / dev ${view.compass.deviation.toFixed(1)}° / total ${total.toFixed(1)}°`
  // Compass center lat/lon
  const latlon = pixelToLatLon(view.compass.center)
  compassEl.title = `Rose center ${formatLat(latlon.lat)} ${formatLon(latlon.lon)}`
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
