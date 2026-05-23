import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const ROBOT_COLORS = [
  '#00c8ff', '#0aff9d', '#ff6b35', '#c678dd', '#ffaa00',
  '#ff3d5a', '#61afef', '#98c379',
]

let robotCounter = 0

function makeRobot(overrides = {}) {
  robotCounter++
  return {
    id: `robot_${Date.now()}_${robotCounter}`,
    name: `Robot ${robotCounter}`,
    color: ROBOT_COLORS[(robotCounter - 1) % ROBOT_COLORS.length],
    // Position centre roues sur la table (en mètres)
    x: 0.5 + Math.random() * 2.0,
    y: 0.3 + Math.random() * 1.4,
    // Orientation initiale en degrés (0 = +X)
    heading: 0,
    // Timing
    startDelay: 0, // secondes
    speed: 0.3,    // m/s
    // Forme : 'circle' | 'rect' | 'stl' | 'svg'
    shapeType: 'rect',
    // Dimensions physiques (mètres)
    width: 0.20,
    height: 0.20,
    radius: 0.14, // pour la collision (circumradius)
    // Données géométrie importée
    stlData: null,
    svgData: null,
    // Waypoints [{x,y}] en mètres
    waypoints: [],
    ...overrides,
  }
}

export const useSimStore = create(immer((set, get) => ({
  // --- Robots ---
  robots: [],
  selectedRobotId: null,

  addRobot: (overrides) => set(s => {
    const r = makeRobot(overrides)
    s.robots.push(r)
    s.selectedRobotId = r.id
  }),

  removeRobot: (id) => set(s => {
    s.robots = s.robots.filter(r => r.id !== id)
    if (s.selectedRobotId === id) {
      s.selectedRobotId = s.robots[0]?.id ?? null
    }
  }),

  selectRobot: (id) => set(s => { s.selectedRobotId = id }),

  updateRobot: (id, patch) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) Object.assign(r, patch)
  }),

  setRobotPosition: (id, x, y) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) { r.x = x; r.y = y }
  }),

  addWaypoint: (id, x, y) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) r.waypoints.push({ x, y })
  }),

  removeWaypoint: (id, idx) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) r.waypoints.splice(idx, 1)
  }),

  clearWaypoints: (id) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) r.waypoints = []
  }),

  setStlData: (id, data) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) { r.stlData = data; r.shapeType = 'stl' }
  }),

  setSvgData: (id, data) => set(s => {
    const r = s.robots.find(r => r.id === id)
    if (r) { r.svgData = data; r.shapeType = 'svg' }
  }),

  // --- Mode interaction ---
  mode: 'draw', // 'draw' | 'move' | 'select'
  setMode: (m) => set(s => { s.mode = m }),

  // --- Simulation ---
  simTime: 0,
  simPlaying: false,
  simSpeed: 1,
  simMaxTime: 30,

  setSimTime: (t) => set(s => { s.simTime = Math.max(0, Math.min(t, s.simMaxTime)) }),
  setSimPlaying: (v) => set(s => { s.simPlaying = v }),
  setSimSpeed: (v) => set(s => { s.simSpeed = v }),
  setSimMaxTime: (v) => set(s => { s.simMaxTime = v }),

  // --- Table ---
  tableW: 3.0,
  tableH: 2.0,
  showGrid: true,
  showLabels: true,
  bgImage: null,  // URL string
  setBgImage: (url) => set(s => { s.bgImage = url }),
  setShowGrid: (v) => set(s => { s.showGrid = v }),
  setShowLabels: (v) => set(s => { s.showLabels = v }),

  // --- Collisions détectées (calculé à chaque frame) ---
  collisions: [], // [{aId, bId, t, x, y}]
  setCollisions: (c) => set(s => { s.collisions = c }),
})))

// ---- Helpers cinématique ----

/**
 * Retourne la position {x,y,heading,done} d'un robot à l'instant t.
 * Heading en degrés.
 */
export function getRobotPose(robot, t) {
  const effectiveT = t - robot.startDelay
  const origin = { x: robot.x, y: robot.y }
  const wps = robot.waypoints

  if (effectiveT <= 0 || wps.length === 0) {
    return { x: robot.x, y: robot.y, heading: robot.heading, done: false, segIdx: -1 }
  }

  let elapsed = 0
  let prevX = robot.x, prevY = robot.y
  let heading = robot.heading

  for (let i = 0; i < wps.length; i++) {
    const dx = wps[i].x - prevX
    const dy = wps[i].y - prevY
    const dist = Math.hypot(dx, dy)
    if (dist < 1e-6) { prevX = wps[i].x; prevY = wps[i].y; continue }
    const dt = dist / robot.speed
    const segHeading = Math.atan2(dy, dx) * (180 / Math.PI)

    if (elapsed + dt >= effectiveT) {
      const frac = (effectiveT - elapsed) / dt
      return {
        x: prevX + dx * frac,
        y: prevY + dy * frac,
        heading: segHeading,
        done: false,
        segIdx: i,
      }
    }
    elapsed += dt
    prevX = wps[i].x
    prevY = wps[i].y
    heading = segHeading
  }

  return { x: prevX, y: prevY, heading, done: true, segIdx: wps.length }
}

/**
 * Calcule les segments d'une trajectoire avec distances et angles.
 * Retourne [{from, to, dist, angle, duration}]
 */
export function computeSegments(robot) {
  const points = [{ x: robot.x, y: robot.y }, ...robot.waypoints]
  const segs = []
  let cumTime = robot.startDelay

  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i+1].x - points[i].x
    const dy = points[i+1].y - points[i].y
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    const duration = dist / robot.speed
    // Angle relatif au segment précédent
    let relAngle = null
    if (i > 0) {
      const pdx = points[i].x - points[i-1].x
      const pdy = points[i].y - points[i-1].y
      const prevAngle = Math.atan2(pdy, pdx) * (180 / Math.PI)
      relAngle = angle - prevAngle
      if (relAngle > 180) relAngle -= 360
      if (relAngle < -180) relAngle += 360
    }
    segs.push({
      from: points[i],
      to: points[i+1],
      dist: Math.round(dist * 1000), // mm
      angle: Math.round(angle * 10) / 10,
      relAngle: relAngle !== null ? Math.round(relAngle * 10) / 10 : null,
      startTime: Math.round(cumTime * 100) / 100,
      duration: Math.round(duration * 100) / 100,
    })
    cumTime += duration
  }
  return segs
}

/**
 * Détecte les collisions entre robots sur l'intervalle de simulation.
 * Retourne liste des instants de première collision par paire.
 */
export function detectCollisions(robots, maxTime, step = 0.05) {
  const events = []
  const pairs = []
  for (let i = 0; i < robots.length; i++)
    for (let j = i+1; j < robots.length; j++)
      pairs.push([robots[i], robots[j]])

  for (const [a, b] of pairs) {
    let colliding = false
    for (let t = 0; t <= maxTime; t += step) {
      const pa = getRobotPose(a, t)
      const pb = getRobotPose(b, t)
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y)
      const minDist = a.radius + b.radius
      if (dist < minDist && !colliding) {
        events.push({ aId: a.id, bId: b.id, t: Math.round(t*100)/100, x: (pa.x+pb.x)/2, y: (pa.y+pb.y)/2 })
        colliding = true
      }
      if (dist >= minDist) colliding = false
    }
  }
  return events
}
