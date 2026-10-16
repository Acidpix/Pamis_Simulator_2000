import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export const stlCache = new Map()
export const obsStlCache = new Map()
export const AUTOSAVE_KEY = 'pamis_autosave'
export const GIT_CONFIG_KEY = 'pamis_git_config'

function loadGitConfigFromStorage() {
  try {
    const raw = localStorage.getItem(GIT_CONFIG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── Undo / Redo ──
const undoStack = [], redoStack = []
const MAX_HISTORY = 60
export function pushHistory(state) {
  undoStack.push(JSON.stringify({ robots: state.robots, obstacles: state.obstacles }))
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack.length = 0
}
export const canUndo = () => undoStack.length > 0
export const canRedo = () => redoStack.length > 0

// ── Couleurs ──
const COLORS = ['#e03131','#2f9e44','#1971c2','#f08c00','#7048e8','#0c8599','#d6336c','#5c7cfa']
let rCount = 0, oCount = 0, wCount = 0

// ── Waypoints : type 'point' | 'bezier' | 'pass' ──
const newWpId = () => `w_${Date.now()}_${++wCount}`

// prev = point précédent de la trajectoire ({x,y}) — sert à placer les poignées d'une courbe de Bézier
function makeWaypoint(prev, x, y, type = 'point') {
  const wp = { id: newWpId(), type, x, y, pause: 0 }
  if (type === 'bezier') Object.assign(wp, defaultHandles(prev, wp))
  if (type === 'pass') delete wp.pause
  return wp
}
function defaultHandles(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy)
  if (L < 1e-6) return { c1: { x: a.x, y: a.y }, c2: { x: b.x, y: b.y } }
  const nx = -dy / L * 0.2 * L, ny = dx / L * 0.2 * L   // décalage perpendiculaire : la courbe est visible d'emblée
  return {
    c1: { x: a.x + dx / 3 + nx, y: a.y + dy / 3 + ny },
    c2: { x: a.x + 2 * dx / 3 + nx, y: a.y + 2 * dy / 3 + ny },
  }
}
// Anciennes sauvegardes : ajoute id + type
const normWp = w => ({ ...w, id: w.id ?? newWpId(), type: w.type ?? 'point' })

function makeRobot(ov = {}) {
  rCount++
  return {
    id: `r_${Date.now()}_${rCount}`,
    name: `Robot ${rCount}`,
    color: COLORS[(rCount-1) % COLORS.length],
    x: 0.5 + Math.random()*2.0, y: 0.3 + Math.random()*1.4,
    heading: 0,
    startDelay: 0,
    speed: 0.30,        // m/s
    accel: 1.0,         // m/s²
    rotSpeed: 90,       // deg/s  (vitesse de rotation)
    rotAccel: 360,      // deg/s² (accélération angulaire)
    holonomic: false,   // si true, ne tourne pas avant de se déplacer
    lookahead: 0.15,    // m — distance d'anticipation du pure pursuit (waypoints « passage »)
    waypointMode: 'stop',
    shapeType: 'rect',
    collisionShape: 'circle',
    width: 0.200, height: 0.200, radius: 0.140,
    collisionW: 0.200, collisionH: 0.200,
    opacity: 1.0,
    hasStl: false,
    stlRotX: -90, stlRotY: 0, stlRotZ: 0,
    waypoints: [],
    ...ov,
  }
}
function makeObs(ov = {}) {
  oCount++
  return {
    id: `o_${Date.now()}_${oCount}`,
    name: `Obstacle ${oCount}`,
    color: '#64748b',
    x: 1.5, y: 1.0,
    heading: 0,
    width: 0.200, height: 0.200, radius: 0.140,
    shape: 'rect',
    collisionShape: 'rect',
    opacity: 1.0,
    hasStl: false,
    stlRotX: -90, stlRotY: 0, stlRotZ: 0,
    ...ov,
  }
}

// ── Cinématique linéaire (trapézoïdale) ──
function trapDuration(dist, speed, accel) {
  if (dist < 1e-9) return 0
  const da = speed*speed / (2*accel)
  if (2*da >= dist) { const vp = Math.sqrt(accel*dist); return 2*vp/accel }
  return 2*speed/accel + (dist - 2*da)/speed
}
function trapPos(dist, speed, accel, t) {
  if (dist < 1e-9 || t <= 0) return 0
  const da = speed*speed/(2*accel), ta = speed/accel
  if (2*da >= dist) {
    const vp = Math.sqrt(accel*dist), tT = 2*vp/accel, th = tT/2
    if (t >= tT) return dist
    if (t <= th) return 0.5*accel*t*t
    const tr = tT-t; return dist - 0.5*accel*tr*tr
  }
  const dc = dist-2*da, tc = dc/speed, tT = 2*ta+tc
  if (t >= tT) return dist
  if (t <= ta) return 0.5*accel*t*t
  if (t <= ta+tc) return da + speed*(t-ta)
  const tr = tT-t; return dist - 0.5*accel*tr*tr
}

const DEG = Math.PI / 180

function normAngle(a) { while(a>180)a-=360; while(a<-180)a+=360; return a }

// ── Géométrie des trajectoires (droite / Bézier / spline de passage) ──
const CURVE_SAMPLES = 32
const r2 = v => Math.round(v * 100) / 100

function makePath(raw) {
  const pts = [raw[0]]
  for (let i = 1; i < raw.length; i++) {
    const p = pts[pts.length - 1]
    if (Math.hypot(raw[i].x - p.x, raw[i].y - p.y) > 1e-9) pts.push(raw[i])
  }
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, len: cum[cum.length - 1] }
}

// Point + cap tangent (deg) à l'abscisse curviligne s
function pointAt(path, s) {
  const { pts, cum } = path
  if (pts.length < 2) return { x: pts[0].x, y: pts[0].y, ang: 0 }
  s = Math.max(0, Math.min(path.len, s))
  let lo = 0, hi = pts.length - 2
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1 }
  const a = pts[lo], b = pts[lo + 1], seg = cum[lo + 1] - cum[lo]
  const u = seg > 0 ? (s - cum[lo]) / seg : 0
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, ang: Math.atan2(b.y - a.y, b.x - a.x) / DEG }
}

function bezierPoly(p0, c1, c2, p3) {
  const out = []
  for (let k = 0; k <= CURVE_SAMPLES; k++) {
    const u = k / CURVE_SAMPLES, m = 1 - u
    const w0 = m * m * m, w1 = 3 * m * m * u, w2 = 3 * m * u * u, w3 = u * u * u
    out.push({ x: w0 * p0.x + w1 * c1.x + w2 * c2.x + w3 * p3.x, y: w0 * p0.y + w1 * c1.y + w2 * c2.y + w3 * p3.y })
  }
  return out
}

// Catmull-Rom centripète (Barry-Goldman) : courbe de p1 à p2
function catmullPoly(p0, p1, p2, p3) {
  const kn = (a, b) => Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)), 1e-4)
  const t0 = 0, t1 = t0 + kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3)
  const mix = (a, b, ta, tb, t) => { const w = (t - ta) / (tb - ta); return { x: a.x * (1 - w) + b.x * w, y: a.y * (1 - w) + b.y * w } }
  const out = []
  for (let k = 0; k <= CURVE_SAMPLES; k++) {
    const t = t1 + (t2 - t1) * k / CURVE_SAMPLES
    const A1 = mix(p0, p1, t0, t1, t), A2 = mix(p1, p2, t1, t2, t), A3 = mix(p2, p3, t2, t3, t)
    const B1 = mix(A1, A2, t0, t2, t), B2 = mix(A2, A3, t1, t3, t)
    out.push(mix(B1, B2, t1, t2, t))
  }
  return out
}

// Polyligne de la branche pts[i] → pts[i+1]
function branchPoly(pts, i) {
  const a = pts[i], b = pts[i + 1]
  if (b.type === 'bezier') {
    const dx = b.x - a.x, dy = b.y - a.y
    const c1 = b.c1 ?? { x: a.x + dx / 3, y: a.y + dy / 3 }
    const c2 = b.c2 ?? { x: a.x + 2 * dx / 3, y: a.y + 2 * dy / 3 }
    return bezierPoly(a, c1, c2, b)
  }
  if (a.type === 'pass' || b.type === 'pass') {
    const p0 = i > 0 ? pts[i - 1] : { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
    const p3 = i + 2 < pts.length ? pts[i + 2] : { x: 2 * b.x - a.x, y: 2 * b.y - a.y }
    return catmullPoly(p0, a, b, p3)
  }
  return [a, b]
}

// ── Pure pursuit (robot unicycle) le long d'une trajectoire de référence ──
function simulatePursuit(path, wpS, robot, h0, isStop) {
  const dt = 0.01
  const vmax = robot.speed, acc = robot.accel ?? 1
  const wmax = (robot.rotSpeed ?? 90) * DEG
  const look = Math.max(0.02, robot.lookahead ?? 0.15)
  const L = path.len
  const nominal = isStop ? trapDuration(L, vmax, acc) : L / vmax
  const tMax = Math.min(300, nominal * 3 + 3)
  const end = path.pts[path.pts.length - 1]
  let x = path.pts[0].x, y = path.pts[0].y, th = h0 * DEG, v = 0, s = 0, seg = 0, wi = 0
  const xs = [x], ys = [y], hs = [h0]
  const cross = new Array(wpS.length).fill(null)
  let k = 0
  while (k * dt < tMax) {
    // projection monotone sur la trajectoire
    let best = Infinity, bs = s, bseg = seg
    const jMax = Math.min(seg + 12, path.pts.length - 1)
    for (let j = seg; j < jMax; j++) {
      const a = path.pts[j], b = path.pts[j + 1]
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
      let u = l2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0
      u = Math.max(0, Math.min(1, u))
      const d = Math.hypot(x - (a.x + u * dx), y - (a.y + u * dy))
      if (d < best - 1e-9) { best = d; bs = path.cum[j] + u * (path.cum[j + 1] - path.cum[j]); bseg = j }
    }
    if (bs > s) s = bs
    if (bseg > seg) seg = bseg
    while (wi < wpS.length - 1 && s >= wpS[wi] - 0.005) { cross[wi] = k * dt; wi++ }
    const rem = L - s
    if (rem < 0.003 || (rem < 0.03 && Math.hypot(x - end.x, y - end.y) < 0.004)) break

    const T = pointAt(path, Math.min(L, s + look))
    const dx = T.x - x, dy = T.y - y, Ld = Math.hypot(dx, dy)
    const alpha = normAngle(Math.atan2(dy, dx) / DEG - th / DEG) * DEG
    let w
    if (Math.abs(alpha) > Math.PI / 2) {
      v = 0; w = Math.sign(alpha) * wmax          // mauvais sens : pivote sur place
    } else {
      const kappa = Ld > 1e-6 ? 2 * Math.sin(alpha) / Ld : 0
      const vdes = isStop ? Math.min(vmax, Math.max(Math.sqrt(2 * acc * Math.max(rem, 0)), 0.03)) : vmax
      v = isStop ? Math.min(vdes, v + acc * dt) : vdes
      w = v * kappa
      if (Math.abs(w) > wmax) { w = Math.sign(w) * wmax; v = wmax / Math.abs(kappa) }
    }
    th += w * dt
    x += v * Math.cos(th) * dt
    y += v * Math.sin(th) * dt
    k++
    xs.push(x); ys.push(y); hs.push(th / DEG)
  }
  const tEnd = k * dt
  xs[xs.length - 1] = end.x; ys[ys.length - 1] = end.y
  let prev = 0
  for (let i = 0; i < cross.length; i++) {
    if (cross[i] == null || i === cross.length - 1) cross[i] = tEnd
    cross[i] = Math.max(prev, Math.min(cross[i], tEnd)); prev = cross[i]
  }
  return { dt, xs, ys, hs, tEnd, cross }
}

// ── Plan cinématique d'un robot (mis en cache : immer crée un nouvel objet à chaque modification) ──
function buildPlan(robot) {
  const wps = robot.waypoints
  const N = wps.length
  const pts = [{ x: robot.x, y: robot.y }, ...wps]
  const isStop = (robot.waypointMode ?? 'stop') === 'stop'
  const isHolo = !!robot.holonomic
  const rotSpeedRad = (robot.rotSpeed ?? 90) * DEG
  const rotAccelRad = (robot.rotAccel ?? 360) * DEG
  const speed = robot.speed, accel = robot.accel ?? 1
  const delay = robot.startDelay ?? 0
  const phases = [], segs = [], branches = [], tracks = []
  let el = 0, px = robot.x, py = robot.y, h = robot.heading

  const addHold = (dur, inAction) => {
    if (dur > 0) { phases.push({ kind: 'hold', t0: el, t1: el + dur, x: px, y: py, h, inAction }); el += dur }
  }
  // Rotation sur place vers un cap absolu ; snap = cap forcé même si l'écart est négligeable
  const addRot = (target, snap) => {
    const da = normAngle(target - h), abs = Math.abs(da) * DEG
    if (abs > 0.5 * DEG) {
      const d = trapDuration(abs, rotSpeedRad, rotAccelRad)
      phases.push({ kind: 'rot', t0: el, t1: el + d, x: px, y: py, h0: h, sign: Math.sign(da), abs, rotSpeedRad, rotAccelRad })
      el += d; h = h + da
      return d
    }
    if (snap) h = target
    return 0
  }
  const pushSeg = (i, startLocal, rotDur, dur, arrDur, dist) => {
    const a = pts[i], b = pts[i + 1]
    const ang = Math.atan2(b.y - a.y, b.x - a.x) / DEG
    let rel = null
    if (i > 0) rel = normAngle(ang - Math.atan2(a.y - pts[i - 1].y, a.x - pts[i - 1].x) / DEG)
    segs.push({
      from: a, to: b, type: b.type ?? 'point',
      dist: Math.round(dist * 1000),
      angle: Math.round(ang * 10) / 10,
      relAngle: rel !== null ? Math.round(rel * 10) / 10 : null,
      startTime: r2(delay + startLocal),
      rotDuration: r2(rotDur), duration: r2(dur), arrRotDuration: r2(arrDur),
      arrHeading: b.heading ?? null,
      pause: b.pause ?? 0, actionPause: b.actionPause ?? 0,
    })
  }

  // Branche unique : arrêt à chaque extrémité (point / bézier)
  const doSingle = i => {
    const dest = pts[i + 1], wpH = dest.heading
    const poly = branchPoly(pts, i); branches.push(poly)
    const path = makePath(poly), len = path.len
    const t0 = el
    let rotDur = 0, dur = 0
    if (len > 1e-6) {
      const rev = !isHolo && !!dest.reverse
      if (isStop && !isHolo) rotDur = addRot(pointAt(path, 0).ang + (rev ? 180 : 0), true)
      const motionDur = isStop ? trapDuration(len, speed, accel) : len / speed
      let holoDa = 0, holoDur = 0
      if (isHolo && wpH != null) {
        holoDa = normAngle(wpH - h)
        const abs = Math.abs(holoDa) * DEG
        if (abs > 0.5 * DEG) holoDur = trapDuration(abs, rotSpeedRad, rotAccelRad)
      }
      dur = Math.max(motionDur, holoDur)
      phases.push({ kind: 'path', t0: el, t1: el + dur, path, motionDur, holoDa, holoDur, h0: h, rev, holo: isHolo, stop: isStop, speed, accel, rotSpeedRad, rotAccelRad })
      el += dur; px = dest.x; py = dest.y
      if (isHolo) { if (wpH != null) h = wpH }
      else h = pointAt(path, len).ang + (rev ? 180 : 0)
    }
    let arrDur = 0
    if (isStop && !isHolo && wpH != null) arrDur = addRot(wpH, false)
    addHold(dest.pause ?? 0, false)
    addHold(dest.actionPause ?? 0, true)
    pushSeg(i, t0, rotDur, dur, arrDur, len)
  }

  // Bloc avec waypoints « passage » : une seule course continue de pts[start] à pts[end]
  const doMulti = (start, end) => {
    const m = end - start
    const polys = [], lens = [], wpS = []
    let acc = 0
    for (let i = start; i < end; i++) {
      const p = branchPoly(pts, i); polys.push(p); branches.push(p)
      lens.push(makePath(p).len); acc += lens[lens.length - 1]; wpS.push(acc)
    }
    const path = makePath(polys.flat())
    const L = path.len, dest = pts[end], wpH = dest.heading
    const blockT0 = el
    let rotDur = 0, motionStart = el
    let cross = new Array(m).fill(0)
    if (L > 1e-6) {
      if (isHolo) {
        const motionDur = isStop ? trapDuration(L, speed, accel) : L / speed
        let holoDa = 0, holoDur = 0
        if (wpH != null) {
          holoDa = normAngle(wpH - h)
          const abs = Math.abs(holoDa) * DEG
          if (abs > 0.5 * DEG) holoDur = trapDuration(abs, rotSpeedRad, rotAccelRad)
        }
        const dur = Math.max(motionDur, holoDur)
        const posAt = t => isStop ? trapPos(L, speed, accel, t) : Math.min(L, speed * t)
        cross = wpS.map((sw, k) => {
          if (k === m - 1) return dur
          let lo = 0, hi = motionDur
          for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (posAt(mid) < sw) lo = mid; else hi = mid }
          return hi
        })
        phases.push({ kind: 'path', t0: el, t1: el + dur, path, motionDur, holoDa, holoDur, h0: h, rev: false, holo: true, stop: isStop, speed, accel, rotSpeedRad, rotAccelRad })
        el += dur
        if (wpH != null) h = wpH
      } else {
        const T0 = pointAt(path, Math.min(L, Math.max(0.02, robot.lookahead ?? 0.15)))
        const ang0 = Math.atan2(T0.y - path.pts[0].y, T0.x - path.pts[0].x) / DEG
        if (isStop) rotDur = addRot(ang0, true); else h = ang0
        motionStart = el
        const sim = simulatePursuit(path, wpS, robot, h, isStop)
        phases.push({ kind: 'samples', t0: el, t1: el + sim.tEnd, dt: sim.dt, xs: sim.xs, ys: sim.ys, hs: sim.hs })
        tracks.push(sim.xs.map((x, k) => ({ x, y: sim.ys[k] })))
        cross = sim.cross
        el += sim.tEnd
        h = sim.hs[sim.hs.length - 1]
      }
      px = dest.x; py = dest.y
    }
    let arrDur = 0
    if (isStop && !isHolo && wpH != null) arrDur = addRot(wpH, false)
    addHold(dest.pause ?? 0, false)
    addHold(dest.actionPause ?? 0, true)
    for (let k = 0; k < m; k++) {
      const prevC = k === 0 ? 0 : cross[k - 1]
      pushSeg(start + k, k === 0 ? blockT0 : motionStart + prevC, k === 0 ? rotDur : 0, cross[k] - prevC, k === m - 1 ? arrDur : 0, lens[k])
    }
  }

  // Découpage en blocs : de nœud d'arrêt en nœud d'arrêt (un waypoint « passage » n'arrête pas le robot)
  const isStopNode = k => k === 0 || k === N || (wps[k - 1].type ?? 'point') !== 'pass'
  let start = 0
  while (start < N) {
    let end = start + 1
    while (!isStopNode(end)) end++
    if (end === start + 1) doSingle(start); else doMulti(start, end)
    start = end
  }
  return { phases, segs, branches, tracks, end: { x: px, y: py, heading: h } }
}

const planCache = new WeakMap()
export function getPlan(robot) {
  let p = planCache.get(robot)
  if (!p) { p = buildPlan(robot); planCache.set(robot, p) }
  return p
}
// Polylignes de référence (une par branche) et traces réellement suivies en pure pursuit
export const getBranchPolys = robot => getPlan(robot).branches
export const getPursuitTracks = robot => getPlan(robot).tracks

function poseInPhase(p, et) {
  switch (p.kind) {
    case 'hold':
      return p.inAction ? { x: p.x, y: p.y, heading: p.h, done: false, inAction: true } : { x: p.x, y: p.y, heading: p.h, done: false }
    case 'rot': {
      const rotated = trapPos(p.abs, p.rotSpeedRad, p.rotAccelRad, et - p.t0) / DEG
      return { x: p.x, y: p.y, heading: p.h0 + rotated * p.sign, done: false }
    }
    case 'path': {
      const lt = et - p.t0, mlt = Math.min(lt, p.motionDur)
      const s = p.stop ? trapPos(p.path.len, p.speed, p.accel, mlt) : Math.min(p.path.len, p.speed * mlt)
      const q = pointAt(p.path, s)
      let hd
      if (p.holo) {
        hd = p.holoDur > 0
          ? p.h0 + trapPos(Math.abs(p.holoDa) * DEG, p.rotSpeedRad, p.rotAccelRad, Math.min(lt, p.holoDur)) / DEG * Math.sign(p.holoDa)
          : p.h0
      } else hd = q.ang + (p.rev ? 180 : 0)
      return { x: q.x, y: q.y, heading: hd, done: false }
    }
    default: { // samples
      const n = p.xs.length - 1
      const u = Math.max(0, Math.min(n, (et - p.t0) / p.dt))
      const i = Math.min(n - 1, Math.floor(u)), f = u - i
      if (n < 1) return { x: p.xs[0], y: p.ys[0], heading: p.hs[0], done: false }
      return {
        x: p.xs[i] + (p.xs[i + 1] - p.xs[i]) * f,
        y: p.ys[i] + (p.ys[i + 1] - p.ys[i]) * f,
        heading: p.hs[i] + (p.hs[i + 1] - p.hs[i]) * f,
        done: false,
      }
    }
  }
}

export function getRobotPose(robot, t) {
  const et = t - robot.startDelay
  if (et <= 0 || robot.waypoints.length === 0) return { x: robot.x, y: robot.y, heading: robot.heading, done: false }
  const { phases, end } = getPlan(robot)
  if (!phases.length || et > phases[phases.length - 1].t1) return { ...end, done: true }
  let lo = 0, hi = phases.length - 1
  while (lo < hi) { const mid = (lo + hi) >> 1; if (phases[mid].t1 >= et) hi = mid; else lo = mid + 1 }
  return poseInPhase(phases[lo], et)
}

export const computeSegments = robot => getPlan(robot).segs

// ── Collision helpers ──
function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx-rw/2, Math.min(cx, rx+rw/2))
  const ny = Math.max(ry-rh/2, Math.min(cy, ry+rh/2))
  return Math.hypot(cx-nx, cy-ny) < cr
}
function shapesCollide(ax, ay, ar, aw, ah, aShape, bx, by, br, bw, bh, bShape) {
  if (aShape==='circle' && bShape==='circle') return Math.hypot(ax-bx,ay-by) < ar+br
  if (aShape==='circle' && bShape==='rect')   return circleVsRect(ax,ay,ar,bx,by,bw,bh)
  if (aShape==='rect'   && bShape==='circle') return circleVsRect(bx,by,br,ax,ay,aw,ah)
  return Math.abs(ax-bx)<(aw+bw)/2 && Math.abs(ay-by)<(ah+bh)/2
}

export function detectCollisions(robots, maxTime, step=0.05) {
  const events = []
  for (let i=0; i<robots.length; i++)
    for (let j=i+1; j<robots.length; j++) {
      const a=robots[i], b=robots[j]; let col=false
      for (let t=0; t<=maxTime; t+=step) {
        const pa=getRobotPose(a,t), pb=getRobotPose(b,t)
        const hit = shapesCollide(pa.x,pa.y,a.radius,a.collisionShape==='rect'?(a.collisionW??a.width):a.width,a.collisionShape==='rect'?(a.collisionH??a.height):a.height,a.collisionShape??'circle',
                                   pb.x,pb.y,b.radius,b.collisionShape==='rect'?(b.collisionW??b.width):b.width,b.collisionShape==='rect'?(b.collisionH??b.height):b.height,b.collisionShape??'circle')
        if (hit && !col) { events.push({aId:a.id,bId:b.id,t:Math.round(t*100)/100,x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2}); col=true }
        if (!hit) col=false
      }
    }
  return events
}

export function detectObstacleCollisions(robots, obstacles, maxTime, step=0.05) {
  const events = []
  for (const robot of robots)
    for (const obs of obstacles) {
      let col=false
      for (let t=0; t<=maxTime; t+=step) {
        const p=getRobotPose(robot,t)
        const rw = robot.collisionShape==='rect'?(robot.collisionW??robot.width):robot.width
        const rh = robot.collisionShape==='rect'?(robot.collisionH??robot.height):robot.height
        const hit = shapesCollide(p.x,p.y,robot.radius,rw,rh,robot.collisionShape??'circle',
                                   obs.x,obs.y,obs.radius,obs.width,obs.height,obs.collisionShape??'rect')
        if (hit && !col) { events.push({robotId:robot.id,obsId:obs.id,t:Math.round(t*100)/100,x:(p.x+obs.x)/2,y:(p.y+obs.y)/2}); col=true }
        if (!hit) col=false
      }
    }
  return events
}

export function detectBorderCollisions(robots, tableW, tableH, maxTime, step=0.05) {
  const events = []
  for (const robot of robots) {
    let col=false
    for (let t=0; t<=maxTime; t+=step) {
      const p=getRobotPose(robot,t)
      const isRect = (robot.collisionShape??'circle')==='rect'
      const hw = isRect ? (robot.collisionW??robot.width)/2  : robot.radius
      const hh = isRect ? (robot.collisionH??robot.height)/2 : robot.radius
      const hit = p.x-hw<0 || p.x+hw>tableW || p.y-hh<0 || p.y+hh>tableH
      if (hit && !col) {
        const cx = Math.max(hw, Math.min(tableW-hw, p.x))
        const cy = Math.max(hh, Math.min(tableH-hh, p.y))
        events.push({robotId:robot.id,obsId:'border',t:Math.round(t*100)/100,x:cx,y:cy})
        col=true
      }
      if (!hit) col=false
    }
  }
  return events
}

// ── Store ──
export const useSimStore = create(immer((set, get) => ({
  robots: [], selectedRobotId: null,

  addRobot:    (ov) => set(s => { const r=makeRobot(ov); s.robots.push(r); s.selectedRobotId=r.id }),
  removeRobot: (id) => set(s => { stlCache.delete(id); s.robots=s.robots.filter(r=>r.id!==id); if(s.selectedRobotId===id) s.selectedRobotId=s.robots[0]?.id??null }),
  selectRobot: (id) => set(s => { s.selectedRobotId=id }),
  updateRobot: (id, patch) => set(s => { const r=s.robots.find(r=>r.id===id); if(r) Object.assign(r,patch) }),
  setRobotPosition: (id, x, y) => set(s => { const r=s.robots.find(r=>r.id===id); if(r){r.x=x;r.y=y} }),

  addWaypoint:    (id, x, y, type='point') => set(s => { const r=s.robots.find(r=>r.id===id); if(!r) return; const prev=r.waypoints[r.waypoints.length-1] ?? r; r.waypoints.push(makeWaypoint(prev,x,y,type)) }),
  insertWaypoint: (id, idx, x, y, type='point') => set(s => { const r=s.robots.find(r=>r.id===id); if(!r) return; const prev=idx===0 ? r : r.waypoints[idx-1]; r.waypoints.splice(idx,0,makeWaypoint(prev,x,y,type)) }),
  removeWaypoint: (id, idx)  => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints.splice(idx,1) }),
  clearWaypoints: (id)       => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints=[] }),
  // Déplace le waypoint ; les poignées de Bézier qui lui sont attachées suivent (la courbe garde sa forme)
  moveWaypoint:   (id, idx, x, y) => set(s => {
    const r=s.robots.find(r=>r.id===id); const w=r?.waypoints[idx]; if(!w) return
    const dx=x-w.x, dy=y-w.y
    w.x=x; w.y=y
    if(w.c2){ w.c2.x+=dx; w.c2.y+=dy }
    const nx=r.waypoints[idx+1]
    if(nx?.c1){ nx.c1.x+=dx; nx.c1.y+=dy }
  }),
  moveWaypointCtrl: (id, idx, which, x, y) => set(s => { const r=s.robots.find(r=>r.id===id); const w=r?.waypoints[idx]; if(w&&w[which]){ w[which].x=x; w[which].y=y } }),
  updateWaypointType: (id, idx, type) => set(s => {
    const r=s.robots.find(r=>r.id===id); const w=r?.waypoints[idx]; if(!w) return
    w.type=type
    if(type==='bezier' && (!w.c1||!w.c2)) Object.assign(w, defaultHandles(idx===0 ? r : r.waypoints[idx-1], w))
    if(type==='pass'){ delete w.pause; delete w.actionPause; delete w.heading; delete w.reverse }
    else if(w.pause==null) w.pause=0
  }),
  updateWaypointPause: (id, idx, pause) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) r.waypoints[idx].pause=pause }),
  updateWaypointActionPause: (id, idx, ap) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) r.waypoints[idx].actionPause=ap }),
  updateWaypointHeading: (id, idx, heading) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) { if(heading==null) delete r.waypoints[idx].heading; else r.waypoints[idx].heading=heading } }),
  updateWaypointReverse: (id, idx, val) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) r.waypoints[idx].reverse=val }),
  setStlData: (id, buf) => { stlCache.set(id, buf); set(s => { const r=s.robots.find(r=>r.id===id); if(r){r.hasStl=true;r.shapeType='stl'} }) },

  obstacles: [], selectedObsId: null,
  addObstacle:    (ov) => set(s => { const o=makeObs(ov); s.obstacles.push(o); s.selectedObsId=o.id }),
  removeObstacle: (id) => set(s => { s.obstacles=s.obstacles.filter(o=>o.id!==id); if(s.selectedObsId===id) s.selectedObsId=null }),
  selectObstacle: (id) => set(s => { s.selectedObsId=id }),
  updateObstacle: (id, patch) => set(s => { const o=s.obstacles.find(o=>o.id===id); if(o) Object.assign(o,patch) }),
  setObstaclePosition: (id, x, y) => set(s => { const o=s.obstacles.find(o=>o.id===id); if(o){o.x=x;o.y=y} }),
  setObsStlData: (id, buf) => { obsStlCache.set(id, buf); set(s => { const o=s.obstacles.find(o=>o.id===id); if(o) o.hasStl=true }) },

  mode: 'draw', setMode: m => set(s => { s.mode=m }),
  wpType: 'point', setWpType: v => set(s => { s.wpType=v }),

  simTime: 0, simPlaying: false, simSpeed: 1, simMaxTime: 30,
  setSimTime:    t => set(s => { s.simTime=Math.max(0,Math.min(t,s.simMaxTime)) }),
  setSimPlaying: v => set(s => { s.simPlaying=v }),
  setSimSpeed:   v => set(s => { s.simSpeed=v }),
  setSimMaxTime: v => set(s => { s.simMaxTime=v }),

  tableW: 3.0, tableH: 2.0,
  showGrid: true, gridColor: '#ffffff', gridMinorStep: 10, gridMajorStep: 50,
  bgImage: '/Eurobot2027_Rules_FR.webp', viewMode: '2d', darkMode: false,
  viewportColor: '#2d6e3e',
  canvasBgColor: '#2e4a76',
  lang: 'fr',
  setBgImage:       u => set(s => { s.bgImage=u }),
  setShowGrid:      v => set(s => { s.showGrid=v }),
  setGridColor:     v => set(s => { s.gridColor=v }),
  setGridMinorStep: v => set(s => { s.gridMinorStep=v }),
  setGridMajorStep: v => set(s => { s.gridMajorStep=v }),
  setViewMode:       v => set(s => { s.viewMode=v }),
  setDarkMode:       v => set(s => { s.darkMode=v }),
  setViewportColor:  v => set(s => { s.viewportColor=v }),
  setCanvasBgColor:  v => set(s => { s.canvasBgColor=v }),
  setLang:           v => set(s => { s.lang=v }),

  collisions: [], obsCollisions: [], borderCollisions: [],
  setCollisions:       c => set(s => { s.collisions=c }),
  setObsCollisions:    c => set(s => { s.obsCollisions=c }),
  setBorderCollisions: c => set(s => { s.borderCollisions=c }),

  gitConfig: {
    repoUrl: '', filename: 'pamis_config.json', branch: 'main',
    authType: 'token', token: '', username: '', password: '',
    ...loadGitConfigFromStorage(),
  },
  setGitConfig: patch => set(s => {
    Object.assign(s.gitConfig, patch)
    try { localStorage.setItem(GIT_CONFIG_KEY, JSON.stringify(s.gitConfig)) } catch {}
  }),

  openSettingsSignal: 0,
  triggerOpenSettings: () => set(s => { s.openSettingsSignal++ }),

  undo: () => set(s => {
    if (!undoStack.length) return
    redoStack.push(JSON.stringify({robots:s.robots,obstacles:s.obstacles}))
    const prev = JSON.parse(undoStack.pop())
    s.robots=prev.robots; s.obstacles=prev.obstacles
    s.collisions=[]; s.obsCollisions=[]; s.borderCollisions=[]
    if (!s.robots.find(r=>r.id===s.selectedRobotId)) s.selectedRobotId=s.robots[0]?.id??null
    if (!s.obstacles.find(o=>o.id===s.selectedObsId)) s.selectedObsId=null
  }),
  redo: () => set(s => {
    if (!redoStack.length) return
    undoStack.push(JSON.stringify({robots:s.robots,obstacles:s.obstacles}))
    const next = JSON.parse(redoStack.pop())
    s.robots=next.robots; s.obstacles=next.obstacles
    s.collisions=[]; s.obsCollisions=[]; s.borderCollisions=[]
    if (!s.robots.find(r=>r.id===s.selectedRobotId)) s.selectedRobotId=s.robots[0]?.id??null
    if (!s.obstacles.find(o=>o.id===s.selectedObsId)) s.selectedObsId=null
  }),

  loadState: (savedRobots, savedObs=[], meta={}) => set(s => {
    rCount=0; oCount=0
    s.robots    = savedRobots.map(r => { rCount++; return {...makeRobot(),...r, waypoints:(r.waypoints||[]).map(normWp)} })
    s.obstacles = savedObs.map(o => { oCount++; return {...makeObs(),...o} })
    s.selectedRobotId=s.robots[0]?.id??null; s.selectedObsId=null
    if(meta.simMaxTime)    s.simMaxTime=meta.simMaxTime
    if(meta.simSpeed)      s.simSpeed=meta.simSpeed
    if(meta.gridColor)     s.gridColor=meta.gridColor
    if(meta.gridMinorStep) s.gridMinorStep=meta.gridMinorStep
    if(meta.gridMajorStep) s.gridMajorStep=meta.gridMajorStep
    if(meta.viewportColor)  s.viewportColor=meta.viewportColor
    if(meta.canvasBgColor)  s.canvasBgColor=meta.canvasBgColor
    s.simTime=0; s.simPlaying=false; s.collisions=[]; s.obsCollisions=[]; s.borderCollisions=[]
  }),
})))

// ── Auto-save localStorage ──
let _saveTimer = null
useSimStore.subscribe(state => {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        version: 2,
        meta: {
          simMaxTime: state.simMaxTime, simSpeed: state.simSpeed,
          gridColor: state.gridColor, gridMinorStep: state.gridMinorStep, gridMajorStep: state.gridMajorStep,
          viewportColor: state.viewportColor, canvasBgColor: state.canvasBgColor,
        },
        robots: state.robots,
        obstacles: state.obstacles,
      }))
    } catch {}
  }, 600)
})

export function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    useSimStore.getState().loadState(data.robots || [], data.obstacles || [], data.meta || {})
    return true
  } catch { return false }
}

export function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY) } catch {}
}
