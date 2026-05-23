import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export const stlCache = new Map() // id -> ArrayBuffer (hors immer)

// ── Undo / Redo (pile de snapshots JSON des robots+obstacles) ──
const undoStack = []
const redoStack = []
const MAX_HISTORY = 50

export function pushHistory(state) {
  undoStack.push(JSON.stringify({ robots: state.robots, obstacles: state.obstacles }))
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack.length = 0 // toute nouvelle action efface le redo
}

export function canUndo() { return undoStack.length > 0 }
export function canRedo() { return redoStack.length > 0 }

const ROBOT_COLORS = ['#e03131','#2f9e44','#1971c2','#f08c00','#7048e8','#0c8599','#d6336c','#5c7cfa']
let robotCounter = 0
let obsCounter   = 0

function makeRobot(overrides = {}) {
  robotCounter++
  return {
    id: `robot_${Date.now()}_${robotCounter}`,
    name: `Robot ${robotCounter}`,
    color: ROBOT_COLORS[(robotCounter - 1) % ROBOT_COLORS.length],
    x: 0.5 + Math.random() * 2.0,
    y: 0.3 + Math.random() * 1.4,
    heading: 0,
    startDelay: 0,
    speed: 0.30,
    shapeType: 'rect',
    width:  0.200,
    height: 0.200,
    radius: 0.140,
    hasStl: false,
    stlRotX: -90, stlRotY: 0, stlRotZ: 0, // rotation STL en degrés
    waypoints: [],
    ...overrides,
  }
}

function makeObstacle(overrides = {}) {
  obsCounter++
  return {
    id: `obs_${Date.now()}_${obsCounter}`,
    name: `Obstacle ${obsCounter}`,
    color: '#64748b',
    x: 1.5, y: 1.0,
    width:  0.200,
    height: 0.200,
    radius: 0.140,
    shape: 'rect',    // 'rect' | 'circle'
    ...overrides,
  }
}

export const useSimStore = create(immer((set) => ({
  // ── Robots ──
  robots: [],
  selectedRobotId: null,
  addRobot:    (ov)      => set(s => { const r = makeRobot(ov); s.robots.push(r); s.selectedRobotId = r.id }),
  removeRobot: (id)      => set(s => { stlCache.delete(id); s.robots = s.robots.filter(r => r.id !== id); if (s.selectedRobotId === id) s.selectedRobotId = s.robots[0]?.id ?? null }),
  selectRobot: (id)      => set(s => { s.selectedRobotId = id }),
  updateRobot: (id, patch) => set(s => { const r = s.robots.find(r => r.id === id); if (r) Object.assign(r, patch) }),
  setRobotPosition: (id, x, y) => set(s => { const r = s.robots.find(r => r.id === id); if (r) { r.x = x; r.y = y } }),
  addWaypoint:    (id, x, y) => set(s => { const r = s.robots.find(r => r.id === id); if (r) r.waypoints.push({ x, y }) }),
  removeWaypoint: (id, idx)  => set(s => { const r = s.robots.find(r => r.id === id); if (r) r.waypoints.splice(idx, 1) }),
  clearWaypoints: (id)       => set(s => { const r = s.robots.find(r => r.id === id); if (r) r.waypoints = [] }),
  moveWaypoint: (id, idx, x, y) => set(s => { const r = s.robots.find(r => r.id === id); if (r && r.waypoints[idx]) { r.waypoints[idx].x = x; r.waypoints[idx].y = y } }),
  setStlData: (id, buf) => { stlCache.set(id, buf); set(s => { const r = s.robots.find(r => r.id === id); if (r) { r.hasStl = true; r.shapeType = 'stl' } }) },

  // ── Undo / Redo ──
  undo: () => set(s => {
    if (undoStack.length === 0) return
    redoStack.push(JSON.stringify({ robots: s.robots, obstacles: s.obstacles }))
    const prev = JSON.parse(undoStack.pop())
    s.robots    = prev.robots
    s.obstacles = prev.obstacles
    s.collisions = []; s.obsCollisions = []
  }),
  redo: () => set(s => {
    if (redoStack.length === 0) return
    undoStack.push(JSON.stringify({ robots: s.robots, obstacles: s.obstacles }))
    const next = JSON.parse(redoStack.pop())
    s.robots    = next.robots
    s.obstacles = next.obstacles
    s.collisions = []; s.obsCollisions = []
  }),

  // ── Obstacles statiques ──
  obstacles: [],
  selectedObsId: null,
  addObstacle:    (ov)      => set(s => { const o = makeObstacle(ov); s.obstacles.push(o); s.selectedObsId = o.id }),
  removeObstacle: (id)      => set(s => { s.obstacles = s.obstacles.filter(o => o.id !== id); if (s.selectedObsId === id) s.selectedObsId = s.obstacles[0]?.id ?? null }),
  selectObstacle: (id)      => set(s => { s.selectedObsId = id }),
  updateObstacle: (id, patch) => set(s => { const o = s.obstacles.find(o => o.id === id); if (o) Object.assign(o, patch) }),
  setObstaclePosition: (id, x, y) => set(s => { const o = s.obstacles.find(o => o.id === id); if (o) { o.x = x; o.y = y } }),

  // ── Mode & simulation ──
  mode: 'draw',
  setMode: (m) => set(s => { s.mode = m }),

  simTime: 0, simPlaying: false, simSpeed: 1, simMaxTime: 30,
  setSimTime:    (t) => set(s => { s.simTime    = Math.max(0, Math.min(t, s.simMaxTime)) }),
  setSimPlaying: (v) => set(s => { s.simPlaying = v }),
  setSimSpeed:   (v) => set(s => { s.simSpeed   = v }),
  setSimMaxTime: (v) => set(s => { s.simMaxTime = v }),

  // ── Table & affichage ──
  tableW: 3.0, tableH: 2.0,
  showGrid: true,
  gridColor:      '#ffffff',
  gridMinorStep:  10,   // cm
  gridMajorStep:  50,   // cm
  bgImage: null,
  viewMode: '2d',
  darkMode: false,
  setBgImage:      (u) => set(s => { s.bgImage      = u }),
  setShowGrid:     (v) => set(s => { s.showGrid     = v }),
  setGridColor:    (v) => set(s => { s.gridColor    = v }),
  setGridMinorStep:(v) => set(s => { s.gridMinorStep = v }),
  setGridMajorStep:(v) => set(s => { s.gridMajorStep = v }),
  setViewMode:     (v) => set(s => { s.viewMode     = v }),
  setDarkMode:     (v) => set(s => { s.darkMode     = v }),

  // ── Collisions ──
  collisions: [],
  obsCollisions: [],
  setCollisions:    (c) => set(s => { s.collisions    = c }),
  setObsCollisions: (c) => set(s => { s.obsCollisions = c }),

  // ── Sauvegarde / chargement ──
  loadState: (savedRobots, savedObstacles = [], meta = {}) => set(s => {
    robotCounter = 0; obsCounter = 0
    s.robots     = savedRobots.map(r => { robotCounter++; return { ...makeRobot(), ...r } })
    s.obstacles  = savedObstacles.map(o => { obsCounter++; return { ...makeObstacle(), ...o } })
    s.selectedRobotId = s.robots[0]?.id ?? null
    s.selectedObsId   = null
    if (meta.simMaxTime)  s.simMaxTime  = meta.simMaxTime
    if (meta.simSpeed)    s.simSpeed    = meta.simSpeed
    if (meta.gridColor)   s.gridColor   = meta.gridColor
    if (meta.gridMinorStep) s.gridMinorStep = meta.gridMinorStep
    if (meta.gridMajorStep) s.gridMajorStep = meta.gridMajorStep
    s.simTime = 0; s.simPlaying = false; s.collisions = []; s.obsCollisions = []
  }),
})))

// ── Cinématique ──
export function getRobotPose(robot, t) {
  const et = t - robot.startDelay
  const wps = robot.waypoints
  if (et <= 0 || wps.length === 0) return { x: robot.x, y: robot.y, heading: robot.heading, done: false }
  let elapsed = 0, px = robot.x, py = robot.y, heading = robot.heading
  for (let i = 0; i < wps.length; i++) {
    const dx = wps[i].x - px, dy = wps[i].y - py
    const dist = Math.hypot(dx, dy)
    if (dist < 1e-6) { px = wps[i].x; py = wps[i].y; continue }
    const dt = dist / robot.speed
    const sh = Math.atan2(dy, dx) * (180 / Math.PI)
    if (elapsed + dt >= et) {
      const f = (et - elapsed) / dt
      return { x: px + dx * f, y: py + dy * f, heading: sh, done: false }
    }
    elapsed += dt; px = wps[i].x; py = wps[i].y; heading = sh
  }
  return { x: px, y: py, heading, done: true }
}

export function computeSegments(robot) {
  const pts = [{ x: robot.x, y: robot.y }, ...robot.waypoints]
  const segs = []; let cum = robot.startDelay
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    const dur = dist / robot.speed
    let rel = null
    if (i > 0) {
      const pdx = pts[i].x - pts[i-1].x, pdy = pts[i].y - pts[i-1].y
      rel = angle - Math.atan2(pdy, pdx) * (180 / Math.PI)
      if (rel > 180) rel -= 360; if (rel < -180) rel += 360
    }
    segs.push({
      from: pts[i], to: pts[i+1],
      dist: Math.round(dist * 1000), // mm
      angle: Math.round(angle * 10) / 10,
      relAngle: rel !== null ? Math.round(rel * 10) / 10 : null,
      startTime: Math.round(cum * 100) / 100,
      duration:  Math.round(dur  * 100) / 100,
    })
    cum += dur
  }
  return segs
}

export function detectCollisions(robots, maxTime, step = 0.05) {
  const events = []
  for (let i = 0; i < robots.length; i++)
    for (let j = i + 1; j < robots.length; j++) {
      const a = robots[i], b = robots[j]; let col = false
      for (let t = 0; t <= maxTime; t += step) {
        const pa = getRobotPose(a, t), pb = getRobotPose(b, t)
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y)
        if (d < a.radius + b.radius && !col) { events.push({ aId: a.id, bId: b.id, t: Math.round(t*100)/100, x: (pa.x+pb.x)/2, y: (pa.y+pb.y)/2 }); col = true }
        if (d >= a.radius + b.radius) col = false
      }
    }
  return events
}

export function detectObstacleCollisions(robots, obstacles, maxTime, step = 0.05) {
  const events = []
  for (const robot of robots)
    for (const obs of obstacles) {
      let col = false
      for (let t = 0; t <= maxTime; t += step) {
        const p = getRobotPose(robot, t)
        const d = Math.hypot(p.x - obs.x, p.y - obs.y)
        if (d < robot.radius + obs.radius && !col) {
          events.push({ robotId: robot.id, obsId: obs.id, t: Math.round(t*100)/100, x: (p.x+obs.x)/2, y: (p.y+obs.y)/2 })
          col = true
        }
        if (d >= robot.radius + obs.radius) col = false
      }
    }
  return events
}
