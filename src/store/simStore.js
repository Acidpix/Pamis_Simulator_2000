import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export const stlCache = new Map()
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
let rCount = 0, oCount = 0

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
    waypointMode: 'stop',
    shapeType: 'rect',
    collisionShape: 'circle',
    width: 0.200, height: 0.200, radius: 0.140,
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
    width: 0.200, height: 0.200, radius: 0.140,
    shape: 'rect',
    collisionShape: 'rect',
    opacity: 1.0,
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

export function getRobotPose(robot, t) {
  const et = t - robot.startDelay
  const wps = robot.waypoints
  if (et <= 0 || wps.length === 0) return { x:robot.x, y:robot.y, heading:robot.heading, done:false }

  let elapsed = 0, px = robot.x, py = robot.y, heading = robot.heading
  const isStop = (robot.waypointMode ?? 'stop') === 'stop'
  const isHolo = !!robot.holonomic
  const rotSpeedRad = (robot.rotSpeed ?? 90) * DEG
  const rotAccelRad = (robot.rotAccel ?? 360) * DEG

  for (let i = 0; i < wps.length; i++) {
    const dx = wps[i].x-px, dy = wps[i].y-py
    const dist = Math.hypot(dx, dy)
    const targetAngle = Math.atan2(dy, dx) / DEG
    const wpHeading = wps[i].heading

    if (dist > 1e-6) {
      // ── Phase 1: rotation initiale (stop, non-holo) ──
      if (isStop && !isHolo) {
        const da = normAngle(targetAngle - heading)
        const absDaRad = Math.abs(da) * DEG
        if (absDaRad > 0.5 * DEG) {
          const rotDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
          if (elapsed + rotDur >= et) {
            const lt = et - elapsed
            const rotated = trapPos(absDaRad, rotSpeedRad, rotAccelRad, lt) / DEG
            return { x:px, y:py, heading: heading + rotated * Math.sign(da), done:false }
          }
          elapsed += rotDur
        }
        heading = targetAngle
      }

      // ── Phase 2: déplacement (+ rotation parallèle si holonome) ──
      const motionDur = isStop ? trapDuration(dist, robot.speed, robot.accel??1) : dist/robot.speed
      let holoDa = 0, holoDur = 0
      if (isHolo && wpHeading != null) {
        holoDa = normAngle(wpHeading - heading)
        const absDaRad = Math.abs(holoDa) * DEG
        if (absDaRad > 0.5 * DEG) holoDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
      }
      const segDur = Math.max(motionDur, holoDur)
      if (elapsed + segDur >= et) {
        const lt = et - elapsed
        const motionLt = Math.min(lt, motionDur)
        const p = isStop ? trapPos(dist, robot.speed, robot.accel??1, motionLt) : Math.min(dist, robot.speed*motionLt)
        const frac = p/dist
        let h
        if (isHolo) {
          if (holoDur > 0) {
            const rotLt = Math.min(lt, holoDur)
            const rotated = trapPos(Math.abs(holoDa)*DEG, rotSpeedRad, rotAccelRad, rotLt) / DEG
            h = heading + rotated * Math.sign(holoDa)
          } else h = heading
        } else h = targetAngle
        return { x:px+dx*frac, y:py+dy*frac, heading: h, done:false }
      }
      elapsed += segDur
      px = wps[i].x; py = wps[i].y
      if (isHolo) { if (holoDur > 0) heading = heading + holoDa }
      else heading = targetAngle
    }

    // ── Phase 3: rotation d'arrivée (stop, non-holo, heading spécifié) ──
    if (isStop && !isHolo && wpHeading != null) {
      const da = normAngle(wpHeading - heading)
      const absDaRad = Math.abs(da) * DEG
      if (absDaRad > 0.5 * DEG) {
        const arrRotDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
        if (elapsed + arrRotDur >= et) {
          const lt = et - elapsed
          const rotated = trapPos(absDaRad, rotSpeedRad, rotAccelRad, lt) / DEG
          return { x:px, y:py, heading: heading + rotated * Math.sign(da), done:false }
        }
        elapsed += arrRotDur
        heading = heading + da
      }
    }

    const pause = wps[i].pause ?? 0
    if (pause > 0) {
      if (elapsed + pause >= et) return { x:px, y:py, heading, done:false }
      elapsed += pause
    }
    const actionPause = wps[i].actionPause ?? 0
    if (actionPause > 0) {
      if (elapsed + actionPause >= et) return { x:px, y:py, heading, done:false, inAction:true }
      elapsed += actionPause
    }
  }
  return { x:px, y:py, heading, done:true }
}

export function computeSegments(robot) {
  const pts = [{ x:robot.x, y:robot.y }, ...robot.waypoints]
  const segs = []
  let cum = robot.startDelay
  let currentHeading = robot.heading
  const isStop = (robot.waypointMode??'stop') === 'stop'
  const isHolo = !!robot.holonomic
  const rotSpeedRad = (robot.rotSpeed ?? 90) * DEG
  const rotAccelRad = (robot.rotAccel ?? 360) * DEG

  for (let i = 0; i < pts.length-1; i++) {
    const dx = pts[i+1].x-pts[i].x, dy = pts[i+1].y-pts[i].y
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) / DEG
    const wpHeading = pts[i+1].heading
    const motionDur = isStop ? trapDuration(dist, robot.speed, robot.accel??1) : dist/robot.speed

    // Rotation initiale (stop, non-holo)
    let rotDur = 0
    if (isStop && !isHolo && dist > 1e-6) {
      const da = normAngle(angle - currentHeading)
      const absDaRad = Math.abs(da) * DEG
      if (absDaRad > 0.5 * DEG) rotDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
    }
    const headingAfterInit = (isStop && !isHolo && dist > 1e-6) ? angle : currentHeading

    // Rotation holonome pendant le déplacement
    let holoDur = 0
    if (isHolo && dist > 1e-6 && wpHeading != null) {
      const da = normAngle(wpHeading - currentHeading)
      const absDaRad = Math.abs(da) * DEG
      if (absDaRad > 0.5 * DEG) holoDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
    }
    const dur = Math.max(motionDur, holoDur)

    // Heading après la phase de déplacement
    let headingAfterMotion
    if (isHolo) headingAfterMotion = (wpHeading != null && dist > 1e-6) ? wpHeading : currentHeading
    else if (dist > 1e-6) headingAfterMotion = angle
    else headingAfterMotion = currentHeading

    // Rotation d'arrivée (stop, non-holo)
    let arrRotDur = 0
    if (isStop && !isHolo && wpHeading != null) {
      const da = normAngle(wpHeading - headingAfterMotion)
      const absDaRad = Math.abs(da) * DEG
      if (absDaRad > 0.5 * DEG) arrRotDur = trapDuration(absDaRad, rotSpeedRad, rotAccelRad)
    }

    let rel = null
    if (i > 0) {
      const pdx = pts[i].x-pts[i-1].x, pdy = pts[i].y-pts[i-1].y
      rel = normAngle(angle - Math.atan2(pdy, pdx)/DEG)
    }
    segs.push({
      from:pts[i], to:pts[i+1],
      dist:Math.round(dist*1000),
      angle:Math.round(angle*10)/10,
      relAngle:rel!==null?Math.round(rel*10)/10:null,
      startTime:Math.round(cum*100)/100,
      rotDuration:Math.round(rotDur*100)/100,
      duration:Math.round(dur*100)/100,
      arrRotDuration:Math.round(arrRotDur*100)/100,
      arrHeading: wpHeading ?? null,
      pause:pts[i+1].pause??0,
      actionPause:pts[i+1].actionPause??0,
    })
    cum += rotDur + dur + arrRotDur + (pts[i+1].pause??0) + (pts[i+1].actionPause??0)

    // Heading pour l'itération suivante
    if (isStop && !isHolo && wpHeading != null) currentHeading = wpHeading
    else if (isHolo && wpHeading != null && dist > 1e-6) currentHeading = wpHeading
    else if (!isHolo && dist > 1e-6) currentHeading = angle
  }
  return segs
}

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
        const hit = shapesCollide(pa.x,pa.y,a.radius,a.width,a.height,a.collisionShape??'circle',
                                   pb.x,pb.y,b.radius,b.width,b.height,b.collisionShape??'circle')
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
        const hit = shapesCollide(p.x,p.y,robot.radius,robot.width,robot.height,robot.collisionShape??'circle',
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
      const hw = isRect ? robot.width/2  : robot.radius
      const hh = isRect ? robot.height/2 : robot.radius
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

  addWaypoint:    (id, x, y) => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints.push({x,y,pause:0}) }),
  insertWaypoint: (id, idx, x, y) => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints.splice(idx,0,{x,y,pause:0}) }),
  removeWaypoint: (id, idx)  => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints.splice(idx,1) }),
  clearWaypoints: (id)       => set(s => { const r=s.robots.find(r=>r.id===id); if(r) r.waypoints=[] }),
  moveWaypoint:   (id, idx, x, y) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]){r.waypoints[idx].x=x;r.waypoints[idx].y=y} }),
  updateWaypointPause: (id, idx, pause) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) r.waypoints[idx].pause=pause }),
  updateWaypointActionPause: (id, idx, ap) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) r.waypoints[idx].actionPause=ap }),
  updateWaypointHeading: (id, idx, heading) => set(s => { const r=s.robots.find(r=>r.id===id); if(r&&r.waypoints[idx]) { if(heading==null) delete r.waypoints[idx].heading; else r.waypoints[idx].heading=heading } }),
  setStlData: (id, buf) => { stlCache.set(id, buf); set(s => { const r=s.robots.find(r=>r.id===id); if(r){r.hasStl=true;r.shapeType='stl'} }) },

  obstacles: [], selectedObsId: null,
  addObstacle:    (ov) => set(s => { const o=makeObs(ov); s.obstacles.push(o); s.selectedObsId=o.id }),
  removeObstacle: (id) => set(s => { s.obstacles=s.obstacles.filter(o=>o.id!==id); if(s.selectedObsId===id) s.selectedObsId=null }),
  selectObstacle: (id) => set(s => { s.selectedObsId=id }),
  updateObstacle: (id, patch) => set(s => { const o=s.obstacles.find(o=>o.id===id); if(o) Object.assign(o,patch) }),
  setObstaclePosition: (id, x, y) => set(s => { const o=s.obstacles.find(o=>o.id===id); if(o){o.x=x;o.y=y} }),

  mode: 'draw', setMode: m => set(s => { s.mode=m }),

  simTime: 0, simPlaying: false, simSpeed: 1, simMaxTime: 30,
  setSimTime:    t => set(s => { s.simTime=Math.max(0,Math.min(t,s.simMaxTime)) }),
  setSimPlaying: v => set(s => { s.simPlaying=v }),
  setSimSpeed:   v => set(s => { s.simSpeed=v }),
  setSimMaxTime: v => set(s => { s.simMaxTime=v }),

  tableW: 3.0, tableH: 2.0,
  showGrid: true, gridColor: '#ffffff', gridMinorStep: 10, gridMajorStep: 50,
  bgImage: '/table_FINALE_1.jpg', viewMode: '2d', darkMode: false,
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
    s.robots    = savedRobots.map(r => { rCount++; return {...makeRobot(),...r} })
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
