const TABLE_W = 3.0
const TABLE_H = 2.0
const DIST_EPS = 0.008  // 8mm — below this the robot is "stationary"

function parseVec(str) {
  return str.trim().split(/\s+/).map(Number)
}

function parsePose(el) {
  if (!el) return null
  const v = parseVec(el.textContent)
  return { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0, roll: v[3] ?? 0, pitch: v[4] ?? 0, yaw: v[5] ?? 0 }
}

function rgbToHex(r, g, b) {
  const h = v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

// Reconstructs sparse waypoints from a dense pose array (0.1s steps).
// Detects "stop phases" (position barely moves) — each is a waypoint.
// The first stop phase is the starting position (skipped from waypoints array).
function extractWaypoints(poses) {
  if (poses.length < 2) return []

  // Group poses into stop-phases and move-phases
  const waypoints = []
  let inStop = true   // start counts as first stop-phase
  let firstStop = true

  for (let i = 1; i < poses.length; i++) {
    const dx = poses[i].x - poses[i - 1].x
    const dy = poses[i].y - poses[i - 1].y
    const moving = Math.sqrt(dx * dx + dy * dy) > DIST_EPS

    if (!moving && !inStop) {
      // Transition: moving → stopped. This position is a waypoint.
      inStop = true
      if (!firstStop) {
        waypoints.push({ x: +poses[i].x.toFixed(4), y: +poses[i].y.toFixed(4), pause: 0 })
      }
    } else if (moving && inStop) {
      // Transition: stopped → moving
      if (firstStop) firstStop = false
      inStop = false
    }
  }

  // If the robot never stopped after the first phase (continuous mode),
  // fall back to direction-change detection.
  if (waypoints.length === 0) {
    return extractWaypointsByCorners(poses)
  }

  return waypoints
}

function extractWaypointsByCorners(poses) {
  const ANGLE_DEG = 15
  const threshold = ANGLE_DEG * Math.PI / 180
  const waypoints = []

  for (let i = 1; i < poses.length - 1; i++) {
    const dx1 = poses[i].x - poses[i - 1].x
    const dy1 = poses[i].y - poses[i - 1].y
    const dx2 = poses[i + 1].x - poses[i].x
    const dy2 = poses[i + 1].y - poses[i].y

    const m1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    const m2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
    if (m1 < DIST_EPS || m2 < DIST_EPS) continue

    const cross = dx1 * dy2 - dy1 * dx2
    const dot   = dx1 * dx2 + dy1 * dy2
    const angle = Math.abs(Math.atan2(cross, dot))

    if (angle > threshold) {
      waypoints.push({ x: +poses[i].x.toFixed(4), y: +poses[i].y.toFixed(4), pause: 0 })
    }
  }

  const last = poses[poses.length - 1]
  waypoints.push({ x: +last.x.toFixed(4), y: +last.y.toFixed(4), pause: 0 })
  return waypoints
}

export function importGazeboSDF(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('XML invalide : ' + parseError.textContent.slice(0, 120))

  const world = doc.querySelector('world')
  if (!world) throw new Error('Aucun élément <world> trouvé dans le fichier SDF')

  const robots = []
  const obstacles = []

  // ── Obstacles ─────────────────────────────────────────────────────────────
  world.querySelectorAll(':scope > model').forEach((model, idx) => {
    const name = model.getAttribute('name') || `Obstacle ${idx + 1}`
    if (name === 'table') return

    const poseEl = model.querySelector(':scope > pose')
    const pose = parsePose(poseEl)
    if (!pose) return

    const x = +(pose.x + TABLE_W / 2).toFixed(4)
    const y = +(pose.y + TABLE_H / 2).toFixed(4)

    const cylEl  = model.querySelector('geometry > cylinder')
    const boxEl  = model.querySelector('geometry > box > size')
    const ambEl  = model.querySelector('material > ambient')

    let shape = 'rect', width = 0.2, height = 0.2, radius = 0.1, color = '#64748b', opacity = 1

    if (cylEl) {
      shape = 'circle'
      radius = parseFloat(cylEl.querySelector('radius')?.textContent ?? '0.1')
      width  = radius * 2
      height = radius * 2
    } else if (boxEl) {
      shape = 'rect'
      const s = parseVec(boxEl.textContent)
      width  = s[0] ?? 0.2
      height = s[1] ?? 0.2
      radius = Math.min(width, height) / 2
    }

    if (ambEl) {
      const v = parseVec(ambEl.textContent)
      color   = rgbToHex(v[0], v[1], v[2])
      opacity = v[3] ?? 1
    }

    obstacles.push({
      name: name.replace(/_/g, ' '),
      x, y,
      shape,
      collisionShape: shape,
      width, height, radius,
      color,
      opacity: +opacity.toFixed(3),
    })
  })

  // ── Robots (actors) ────────────────────────────────────────────────────────
  world.querySelectorAll(':scope > actor').forEach((actor, idx) => {
    const rawName  = actor.getAttribute('name') || `Robot ${idx + 1}`
    const name     = rawName.replace(/_/g, ' ')

    // Color from visual material ambient
    const ambEl  = actor.querySelector('visual material ambient')
    let color = '#e03131'
    if (ambEl) {
      const v = parseVec(ambEl.textContent)
      color = rgbToHex(v[0], v[1], v[2])
    }

    // Radius from visual cylinder (or default)
    const cylEl  = actor.querySelector('visual geometry cylinder')
    const radius = cylEl ? parseFloat(cylEl.querySelector('radius')?.textContent ?? '0.14') : 0.14

    // Start delay
    const delayEl   = actor.querySelector('delay_start')
    const startDelay = delayEl ? parseFloat(delayEl.textContent) : 0

    // Dense trajectory → sparse waypoints
    const wpEls = actor.querySelectorAll('trajectory waypoint')
    const poses = []
    wpEls.forEach(wp => {
      const t = parseFloat(wp.querySelector('time')?.textContent ?? '0')
      const p = parsePose(wp.querySelector('pose'))
      if (p) poses.push({ t, x: p.x + TABLE_W / 2, y: p.y + TABLE_H / 2, yaw: p.yaw })
    })

    // Starting position & heading from first pose (or actor-level pose)
    let startX = 1.5, startY = 1.0, heading = 0
    if (poses.length > 0) {
      startX  = +poses[0].x.toFixed(4)
      startY  = +poses[0].y.toFixed(4)
      heading = +(poses[0].yaw * 180 / Math.PI).toFixed(1)
    } else {
      const poseEl = actor.querySelector(':scope > pose')
      const pose   = parsePose(poseEl)
      if (pose) {
        startX  = +(pose.x + TABLE_W / 2).toFixed(4)
        startY  = +(pose.y + TABLE_H / 2).toFixed(4)
        heading = +(pose.yaw * 180 / Math.PI).toFixed(1)
      }
    }

    const waypoints = extractWaypoints(poses)

    robots.push({
      name,
      x: startX, y: startY,
      heading,
      color,
      radius,
      width:  radius * 2,
      height: radius * 2,
      startDelay,
      collisionShape: 'circle',
      shapeType: 'rect',
      waypointMode: 'stop',
      speed:   0.30,
      accel:   1.0,
      rotSpeed: 90,
      rotAccel: 360,
      opacity: 1.0,
      hasStl: false,
      stlRotX: -90, stlRotY: 0, stlRotZ: 0,
      waypoints,
    })
  })

  return { robots, obstacles }
}
