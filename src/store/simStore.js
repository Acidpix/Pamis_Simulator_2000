import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// STL data stored outside Zustand to avoid immer issues with ArrayBuffer
export const stlCache = new Map()

const ROBOT_COLORS = [
  '#e03131', '#2f9e44', '#1971c2', '#f08c00',
  '#7048e8', '#0c8599', '#d6336c', '#5c7cfa',
]

let robotCounter = 0

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
    speed: 0.3,      // m/s
    shapeType: 'rect',
    width:  0.20,    // m
    height: 0.20,    // m
    radius: 0.14,    // m circumradius
    hasStl: false,
    waypoints: [],
    ...overrides,
  }
}

export const useSimStore = create(immer((set) => ({
  robots: [],
  selectedRobotId: null,

  addRobot: (overrides) => set(s => {
    const r = makeRobot(overrides)
    s.robots.push(r)
    s.selectedRobotId = r.id
  }),
  removeRobot: (id) => set(s => {
    stlCache.delete(id)
    s.robots = s.robots.filter(r => r.id !== id)
    if (s.selectedRobotId === id) s.selectedRobotId = s.robots[0]?.id ?? null
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

  loadState: (savedRobots, meta = {}) => set(s => {
    robotCounter = 0
    s.robots = savedRobots.map(r => {
      robotCounter++
      return { ...makeRobot(), ...r }
    })
    s.selectedRobotId = s.robots[0]?.id ?? null
    if (meta.simMaxTime) s.simMaxTime = meta.simMaxTime
    if (meta.simSpeed)   s.simSpeed   = meta.simSpeed
    s.simTime = 0
    s.simPlaying = false
    s.collisions = []
  }),

  setStlData: (id, arrayBuffer) => {
    stlCache.set(id, arrayBuffer)
    set(s => {
      const r = s.robots.find(r => r.id === id)
      if (r) { r.hasStl = true; r.shapeType = 'stl' }
    })
  },

  mode: 'draw',
  setMode: (m) => set(s => { s.mode = m }),

  simTime: 0,
  simPlaying: false,
  simSpeed: 1,
  simMaxTime: 30,
  setSimTime: (t) => set(s => { s.simTime = Math.max(0, Math.min(t, s.simMaxTime)) }),
  setSimPlaying: (v) => set(s => { s.simPlaying = v }),
  setSimSpeed: (v) => set(s => { s.simSpeed = v }),
  setSimMaxTime: (v) => set(s => { s.simMaxTime = v }),

  tableW: 3.0,
  tableH: 2.0,
  showGrid: true,
  bgImage: null,
  viewMode: '2d',   // '2d' | '3d'
  setBgImage: (url) => set(s => { s.bgImage = url }),
  setShowGrid: (v) => set(s => { s.showGrid = v }),
  setViewMode: (v) => set(s => { s.viewMode = v }),

  collisions: [],
  setCollisions: (c) => set(s => { s.collisions = c }),
})))

// ---- Cinématique ----
export function getRobotPose(robot, t) {
  const effectiveT = t - robot.startDelay
  const wps = robot.waypoints
  if (effectiveT <= 0 || wps.length === 0)
    return { x: robot.x, y: robot.y, heading: robot.heading, done: false }

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
      return { x: prevX + dx * frac, y: prevY + dy * frac, heading: segHeading, done: false }
    }
    elapsed += dt
    prevX = wps[i].x; prevY = wps[i].y
    heading = segHeading
  }
  return { x: prevX, y: prevY, heading, done: true }
}

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
    let relAngle = null
    if (i > 0) {
      const pdx = points[i].x - points[i-1].x
      const pdy = points[i].y - points[i-1].y
      relAngle = angle - Math.atan2(pdy, pdx) * (180 / Math.PI)
      if (relAngle > 180) relAngle -= 360
      if (relAngle < -180) relAngle += 360
    }
    segs.push({
      from: points[i], to: points[i+1],
      dist: Math.round(dist * 100),         // cm
      angle: Math.round(angle * 10) / 10,
      relAngle: relAngle !== null ? Math.round(relAngle * 10) / 10 : null,
      startTime: Math.round(cumTime * 100) / 100,
      duration: Math.round(duration * 100) / 100,
    })
    cumTime += duration
  }
  return segs
}

export function detectCollisions(robots, maxTime, step = 0.05) {
  const events = []
  for (let i = 0; i < robots.length; i++) {
    for (let j = i + 1; j < robots.length; j++) {
      const a = robots[i], b = robots[j]
      let colliding = false
      for (let t = 0; t <= maxTime; t += step) {
        const pa = getRobotPose(a, t)
        const pb = getRobotPose(b, t)
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y)
        if (dist < a.radius + b.radius && !colliding) {
          events.push({ aId: a.id, bId: b.id, t: Math.round(t*100)/100, x: (pa.x+pb.x)/2, y: (pa.y+pb.y)/2 })
          colliding = true
        }
        if (dist >= a.radius + b.radius) colliding = false
      }
    }
  }
  return events
}
