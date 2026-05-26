import React, { useRef, useEffect, useState, useMemo, useCallback, Suspense, memo } from 'react'
import { useT } from '../i18n.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera, OrbitControls, Line, Html, Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore, getRobotPose, stlCache, pushHistory } from '../store/simStore.js'

function BgColorSetter({ color }) {
  const { gl } = useThree()
  useEffect(() => { gl.setClearColor(new THREE.Color(color)) }, [color, gl])
  return null
}

const DEG = Math.PI / 180

// In-canvas labels rendered via a 2D canvas texture so they (a) get recorded
// by canvas.captureStream, and (b) display color-emoji glyphs via the system
// emoji font (Apple/Segoe/Noto). troika-three-text doesn't render color emoji.
const EMOJI_FONT_STACK = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const chipTextureCache = new Map()
const emojiTextureCache = new Map()

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2)
  ctx.beginPath()
  ctx.moveTo(x+rr, y)
  ctx.lineTo(x+w-rr, y)
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr)
  ctx.lineTo(x+w, y+h-rr)
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h)
  ctx.lineTo(x+rr, y+h)
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr)
  ctx.lineTo(x, y+rr)
  ctx.quadraticCurveTo(x, y, x+rr, y)
  ctx.closePath()
}

function makeChipTexture({ text, bg, color, fontPx, bold }) {
  const key = `${text}|${bg}|${color}|${fontPx}|${bold?1:0}`
  let entry = chipTextureCache.get(key)
  if (entry) return entry
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const measure = document.createElement('canvas').getContext('2d')
  const font = `${bold?'bold ':''}${fontPx}px ${EMOJI_FONT_STACK}`
  measure.font = font
  const padX = fontPx * 0.55, padY = fontPx * 0.32
  const textW = measure.measureText(text).width
  const w = Math.ceil(textW + padX * 2)
  const h = Math.ceil(fontPx * 1.25 + padY * 2)
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = bg
  drawRoundedRect(ctx, 0, 0, w, h, Math.min(h * 0.35, 8))
  ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, w/2, h/2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  entry = { texture, w, h }
  chipTextureCache.set(key, entry)
  return entry
}

function makeEmojiTexture(emoji, fontPx = 96) {
  const key = `${emoji}|${fontPx}`
  let entry = emojiTextureCache.get(key)
  if (entry) return entry
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const size = Math.ceil(fontPx * 1.2)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.font = `${fontPx}px ${EMOJI_FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size/2, size/2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  entry = { texture, size }
  emojiTextureCache.set(key, entry)
  return entry
}

function Chip({ position, text, bg, fontSize = 0.04, color = '#fff', bold = true }) {
  const fontPx = 36
  const { texture, w, h } = useMemo(
    () => makeChipTexture({ text: String(text), bg, color, fontPx, bold }),
    [text, bg, color, bold]
  )
  const targetH = fontSize * 1.9
  const scale = targetH / h
  const worldW = w * scale
  return (
    <mesh position={position}>
      <planeGeometry args={[worldW, targetH]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function ActionLabel({ position }) {
  const ref = useRef()
  const startRef = useRef(null)
  const { texture } = useMemo(() => makeEmojiTexture('💪', 96), [])
  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const t = clock.elapsedTime - startRef.current
    if (ref.current) ref.current.visible = (Math.floor(t * 2) % 2) === 0
  })
  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[0.18, 0.18]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function BgTexture({ url, w, h }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0,0,0.001]}>
      <planeGeometry args={[w,h]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

// ── Table ──
function Table({ w, h, bgImage, showGrid, gridColor, gridMinorStep, gridMajorStep, is3d, viewportColor }) {
  const minorM = gridMinorStep/100, majorM = gridMajorStep/100

  const minorLines = useMemo(() => {
    if (!showGrid || minorM<=0) return []
    const L=[]
    for (let x=0; x<=w+1e-4; x+=minorM) L.push([[x-w/2,-h/2,0.002],[x-w/2,h/2,0.002]])
    for (let y=0; y<=h+1e-4; y+=minorM) L.push([[-w/2,y-h/2,0.002],[w/2,y-h/2,0.002]])
    return L
  }, [w,h,showGrid,minorM])

  const majorLines = useMemo(() => {
    if (!showGrid || majorM<=0) return []
    const L=[]
    for (let x=0; x<=w+1e-4; x+=majorM) L.push([[x-w/2,-h/2,0.003],[x-w/2,h/2,0.003]])
    for (let y=0; y<=h+1e-4; y+=majorM) L.push([[-w/2,y-h/2,0.003],[w/2,y-h/2,0.003]])
    return L
  }, [w,h,showGrid,majorM])

  const markers = useMemo(() => {
    const M=[], step=majorM>0?majorM:0.5
    for (let x=0; x<=w; x+=step) M.push({type:'x',v:x,label:`${Math.round(x*1000)}`})
    for (let y=0; y<=h; y+=step) M.push({type:'y',v:y,label:`${Math.round(y*1000)}`})
    return M
  }, [w,h,majorM])

  // Couleur de surface = viewportColor si défini, sinon vert
  const surfaceColor = viewportColor || '#2d6e3e'

  return (
    <group>
      <mesh receiveShadow>
        <planeGeometry args={[w,h]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.8} />
      </mesh>

      {bgImage && <Suspense fallback={null}><BgTexture url={bgImage} w={w} h={h} /></Suspense>}

      {showGrid && minorLines.map((pts,i) => <Line key={i}   points={pts} color={gridColor} lineWidth={0.4} transparent opacity={0.15} />)}
      {showGrid && majorLines.map((pts,i) => <Line key={`M${i}`} points={pts} color={gridColor} lineWidth={1.5} transparent opacity={0.35} />)}

      <Line points={[[-w/2,-h/2,0.004],[w/2,-h/2,0.004],[w/2,h/2,0.004],[-w/2,h/2,0.004],[-w/2,-h/2,0.004]]}
        color={gridColor} lineWidth={3} />

      {markers.map((m,i) => (
        <Text
          key={i}
          position={m.type==='x'?[m.v-w/2,-h/2-0.10,0.01]:[-w/2-0.10,m.v-h/2,0.01]}
          fontSize={0.035}
          color={gridColor}
          fillOpacity={0.8}
          anchorX="center"
          anchorY="middle"
        >
          {m.label}
        </Text>
      ))}

      {/* Bordures : 15mm d'épaisseur, 70mm de haut */}
      {[
        { pos:[0,-h/2-0.0075,0.035], args:[w+0.03,0.015,0.070] },
        { pos:[0, h/2+0.0075,0.035], args:[w+0.03,0.015,0.070] },
        { pos:[-w/2-0.0075,0,0.035], args:[0.015,h,0.070] },
        { pos:[ w/2+0.0075,0,0.035], args:[0.015,h,0.070] },
      ].map((wall,i) => (
        <mesh key={`wall${i}`} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.args} />
          <meshStandardMaterial color="#b0bec5" roughness={0.7} />
        </mesh>
      ))}

      {is3d && [
        { pos:[0,-h/2,0.15], rot:[Math.PI/2,0,0], args:[w,0.30] },
        { pos:[0, h/2,0.15], rot:[Math.PI/2,0,0], args:[w,0.30] },
        { pos:[-w/2,0,0.15], rot:[Math.PI/2,0,Math.PI/2], args:[h,0.30] },
        { pos:[ w/2,0,0.15], rot:[Math.PI/2,0,Math.PI/2], args:[h,0.30] },
      ].map((wall,i) => (
        <mesh key={`iwall${i}`} position={wall.pos} rotation={wall.rot}>
          <planeGeometry args={wall.args} />
          <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

// ── STL géométrie ──
function useStlGeo(robotId, hasStl, width) {
  return useMemo(() => {
    if (!hasStl) return null
    const buf = stlCache.get(robotId)
    if (!buf) return null
    try {
      const geo = new STLLoader().parse(buf)
      geo.computeBoundingBox()
      const sz = new THREE.Vector3(); geo.boundingBox.getSize(sz)
      const maxDim = Math.max(sz.x,sz.y,sz.z)
      if (maxDim>0) { const s=width/maxDim; geo.scale(s,s,s) }
      geo.center()
      return geo
    } catch { return null }
  }, [robotId, hasStl, width])
}

// ── Trajectoire ──
function TrajectoryLine({ robot, selected, simTime, onWaypointClick, onWaypointDown, onSegmentClick }) {
  const pts = useMemo(() => {
    const arr=[new THREE.Vector3(robot.x-1.5,robot.y-1.0,0.006)]
    for (const wp of robot.waypoints) arr.push(new THREE.Vector3(wp.x-1.5,wp.y-1.0,0.006))
    return arr
  }, [robot])

  if (pts.length<2) return null
  return (
    <group>
      <Line points={pts.map(p=>[p.x,p.y,p.z])} color={robot.color}
        lineWidth={selected?3:1.8} transparent opacity={selected?1:.55} />
      {/* Zones cliquables sur les segments pour insérer un waypoint */}
      {pts.slice(0,-1).map((p,i) => {
        const np=pts[i+1]
        const mid=new THREE.Vector3().lerpVectors(p,np,0.5)
        const dist=p.distanceTo(np)
        const angle=Math.atan2(np.y-p.y,np.x-p.x)
        return (
          <mesh key={`seg${i}`} position={[mid.x,mid.y,0.020]} rotation={[0,0,angle]}
            onClick={e=>{e.stopPropagation();onSegmentClick?.(i,e.point.x+1.5,e.point.y+1.0)}}>
            <planeGeometry args={[dist,0.07]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )
      })}
      {robot.waypoints.map((wp,i) => (
        <group key={i}>
          <mesh position={[wp.x-1.5,wp.y-1.0,0.030]}
            onClick={e=>{e.stopPropagation();onWaypointClick?.(i)}}
            onPointerDown={e=>{e.stopPropagation();onWaypointDown?.(i)}}>
            <circleGeometry args={[0.055,16]} />
            <meshBasicMaterial color={robot.color} transparent opacity={.9} />
          </mesh>
          {(wp.pause??0)>0 && (
            <Chip
              position={[wp.x-1.5, wp.y-1.0+0.09, 0.031]}
              text={`⏱ ${wp.pause}s`}
              bg="#f08c00"
              fontSize={0.035}
            />
          )}
          {(wp.actionPause??0)>0 && (
            <Chip
              position={[wp.x-1.5, wp.y-1.0-0.09, 0.031]}
              text={`💪 ${wp.actionPause}s`}
              bg="#7048e8"
              fontSize={0.035}
            />
          )}
        </group>
      ))}
      {pts.slice(0,-1).map((p,i) => {
        const np=pts[i+1], mid=new THREE.Vector3().lerpVectors(p,np,0.55)
        return (
          <mesh key={`a${i}`} position={[mid.x,mid.y,0.013]} rotation={[0,0,Math.atan2(np.y-p.y,np.x-p.x)-Math.PI/2]}>
            <coneGeometry args={[0.025,0.055,3]} />
            <meshBasicMaterial color={robot.color} />
          </mesh>
        )
      })}
    </group>
  )
}

// ── Robot ──
function RobotMesh({ robot, selected, simTime, onPointerDown, is3d }) {
  const pose = getRobotPose(robot, simTime)
  const stlGeo = useStlGeo(robot.id, robot.hasStl, robot.width)
  const robotH = is3d ? Math.max(robot.width,robot.height)*0.6 : 0.04
  const opacity = robot.opacity ?? 1

  // Collision shape visualisation
  const collShape = robot.collisionShape ?? 'circle'

  return (
    <group position={[pose.x-1.5,pose.y-1.0,is3d?robotH/2:0]}
      rotation={[0,0,pose.heading*DEG]} onPointerDown={onPointerDown}>

      {stlGeo ? (
        <mesh geometry={stlGeo} castShadow
          rotation={[(robot.stlRotX??-90)*DEG,(robot.stlRotY??0)*DEG,(robot.stlRotZ??0)*DEG]}>
          <meshStandardMaterial color={robot.color} transparent opacity={opacity} />
        </mesh>
      ) : (
        <mesh castShadow>
          <boxGeometry args={[robot.width,robot.height,robotH]} />
          <meshStandardMaterial color={robot.color} transparent opacity={opacity} roughness={.5} />
        </mesh>
      )}

      {/* Collision shape */}
      {selected && collShape==='circle' && (
        <mesh position={[0,0,is3d?-robotH/2+.001:.013]}>
          <ringGeometry args={[robot.radius,robot.radius+.022,32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={.7} side={THREE.DoubleSide} />
        </mesh>
      )}
      {selected && collShape==='rect' && (
        <lineSegments position={[0,0,is3d?-robotH/2+.001:.013]}>
          <edgesGeometry args={[new THREE.BoxGeometry(robot.width,robot.height,0.001)]} />
          <lineBasicMaterial color="#ffffff" transparent opacity={.7} />
        </lineSegments>
      )}

      {/* Flèche direction */}
      <mesh position={[robot.width*.5+.03,0,is3d?0:.02]} rotation={[0,0,-Math.PI/2]}>
        <coneGeometry args={[.02,.06,8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <Chip
        position={[0, robot.height/2 + 0.09, is3d ? robotH/2 : 0.005]}
        text={robot.name}
        bg={robot.color}
        fontSize={0.05}
      />
      {pose.inAction && <ActionLabel position={[0, 0, is3d ? robotH : 0.12]} />}
    </group>
  )
}

// ── Obstacle ──
function ObstacleMesh({ obs, selected, onPointerDown, is3d }) {
  const h = is3d ? Math.max(obs.width,obs.height)*0.5 : 0.05
  const opacity = obs.opacity ?? 1
  const collShape = obs.collisionShape ?? 'rect'

  return (
    <group position={[obs.x-1.5,obs.y-1.0,is3d?h/2:0]} onPointerDown={onPointerDown}>
      {obs.shape==='circle' ? (
        <mesh castShadow>
          <cylinderGeometry args={[obs.radius,obs.radius,h,32]} rotation={[Math.PI/2,0,0]} />
          <meshStandardMaterial color={obs.color} transparent opacity={opacity*.9} roughness={.6} />
        </mesh>
      ) : (
        <mesh castShadow>
          <boxGeometry args={[obs.width,obs.height,h]} />
          <meshStandardMaterial color={obs.color} transparent opacity={opacity*.9} roughness={.6} />
        </mesh>
      )}

      {selected && collShape==='circle' && (
        <mesh position={[0,0,is3d?-h/2+.001:.014]}>
          <ringGeometry args={[obs.radius,obs.radius+.022,32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {selected && collShape==='rect' && (
        <lineSegments position={[0,0,is3d?-h/2+.001:.014]}>
          <edgesGeometry args={[new THREE.BoxGeometry(obs.width,obs.height,0.001)]} />
          <lineBasicMaterial color="#fbbf24" transparent opacity={.8} />
        </lineSegments>
      )}

      <Chip
        position={[0, (obs.height||obs.radius||0.1)/2 + 0.08, is3d ? h/2 : 0.005]}
        text={obs.name}
        bg={obs.color}
        fontSize={0.04}
      />
    </group>
  )
}

function CollisionMarker({ cx, cy, color='#dc2626' }) {
  const ref = useRef()
  useFrame(({ clock }) => { if(ref.current) ref.current.material.opacity=.3+.5*Math.sin(clock.elapsedTime*5) })
  return (
    <mesh ref={ref} position={[cx-1.5,cy-1.0,.025]}>
      <ringGeometry args={[.06,.10,16]} />
      <meshBasicMaterial color={color} transparent opacity={.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

function OrthoZoom({ tableW, tableH }) {
  const { camera, gl } = useThree()
  const zoom = useRef(1)
  useEffect(() => {
    const el = gl.domElement
    const fnWheel = e => {
      e.preventDefault()
      zoom.current = Math.max(.3, Math.min(8, zoom.current*(1-e.deltaY*.001)))
      camera.zoom = Math.min(el.clientWidth/tableW, el.clientHeight/tableH)*.9*zoom.current
      camera.updateProjectionMatrix()
    }
    let panStart = null
    const fnDown = e => {
      if (e.button !== 1) return
      e.preventDefault()
      panStart = { x:e.clientX, y:e.clientY, cx:camera.position.x, cy:camera.position.y }
    }
    const fnMove = e => {
      if (!panStart) return
      const scale = 1 / camera.zoom
      camera.position.x = panStart.cx - (e.clientX - panStart.x) * scale
      camera.position.y = panStart.cy + (e.clientY - panStart.y) * scale
    }
    const fnUp = e => { if (e.button === 1) panStart = null }
    el.addEventListener('wheel', fnWheel, { passive:false })
    el.addEventListener('mousedown', fnDown)
    window.addEventListener('mousemove', fnMove)
    window.addEventListener('mouseup', fnUp)
    return () => {
      el.removeEventListener('wheel', fnWheel)
      el.removeEventListener('mousedown', fnDown)
      window.removeEventListener('mousemove', fnMove)
      window.removeEventListener('mouseup', fnUp)
    }
  }, [camera,gl,tableW,tableH])
  return null
}

// ── Scene ──
function Scene(props) {
  const { robots, selectedRobotId, obstacles, selectedObsId, simTime,
    collisions, obsCollisions, borderCollisions,
    showGrid, gridColor, gridMinorStep, gridMajorStep, bgImage, viewportColor, canvasBgColor,
    tableW, tableH, mode, viewMode,
    selectRobot, selectObstacle, setRobotPosition, setObstaclePosition,
    removeWaypoint, moveWaypoint, updateWaypointPause, insertWaypoint, onTableClick } = props

  const { camera, gl } = useThree()
  const dragTarget = useRef(null)
  const planeZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0,0,1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ctrlHeld = useRef(false)
  const is3d = viewMode==='3d'

  useEffect(() => {
    if (is3d) return
    camera.zoom = Math.min(gl.domElement.clientWidth/tableW, gl.domElement.clientHeight/tableH)*.9
    camera.updateProjectionMatrix()
  }, [camera,gl,tableW,tableH,is3d])

  useEffect(() => {
    const onDown = e => { ctrlHeld.current = e.ctrlKey || e.metaKey }
    const onUp   = e => { ctrlHeld.current = e.ctrlKey || e.metaKey }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => { window.removeEventListener('keydown',onDown); window.removeEventListener('keyup',onUp) }
  }, [])

  const getWorldPos = useCallback(e => {
    const rect = gl.domElement.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera({ x:((e.clientX-rect.left)/rect.width)*2-1, y:-((e.clientY-rect.top)/rect.height)*2+1 }, camera)
    ray.ray.intersectPlane(planeZ, hit)
    return hit.clone()
  }, [camera,gl,planeZ,hit])

  const clamp = (v, max) => Math.max(0, Math.min(max, v))

  // Snap angle to 15° when Ctrl held
  const snapWaypoint = useCallback((rawX, rawY, robotId, idx) => {
    if (!ctrlHeld.current) return { x:rawX, y:rawY }
    const robot = robots.find(r=>r.id===robotId)
    if (!robot) return { x:rawX, y:rawY }
    const prevPt = idx===0 ? {x:robot.x,y:robot.y} : robot.waypoints[idx-1]
    if (!prevPt) return { x:rawX, y:rawY }
    const dx = rawX-prevPt.x, dy = rawY-prevPt.y
    const dist = Math.hypot(dx,dy)
    if (dist<1e-6) return { x:rawX, y:rawY }
    const angle = Math.atan2(dy,dx)
    const step = 15*DEG
    const snapped = Math.round(angle/step)*step
    return { x:prevPt.x+dist*Math.cos(snapped), y:prevPt.y+dist*Math.sin(snapped) }
  }, [robots])

  const onPointerMove = useCallback(e => {
    if (!dragTarget.current) return
    const wp = getWorldPos(e)
    const tx = clamp(wp.x+tableW/2,tableW), ty = clamp(wp.y+tableH/2,tableH)
    const dt = dragTarget.current
    if (dt.type==='robot') setRobotPosition(dt.id,tx,ty)
    else if (dt.type==='obs') setObstaclePosition(dt.id,tx,ty)
    else if (dt.type==='wp') {
      const {x,y} = snapWaypoint(tx,ty,dt.id,dt.idx)
      moveWaypoint(dt.id,dt.idx,x,y)
    }
  }, [getWorldPos,setRobotPosition,setObstaclePosition,moveWaypoint,snapWaypoint,tableW,tableH])

  const onMeshClick = useCallback(e => {
    if (mode!=='draw'||is3d) return
    e.stopPropagation()
    const wp = getWorldPos(e)
    onTableClick(clamp(wp.x+tableW/2,tableW), clamp(wp.y+tableH/2,tableH))
  }, [mode,is3d,getWorldPos,tableW,tableH,onTableClick])

  const allBorderCols = borderCollisions.map(c=>({x:c.x,y:c.y,color:'#f08c00'}))

  return (
    <>
      <BgColorSetter color={canvasBgColor || '#dde3ec'} />

      {is3d ? (
        <>
          <PerspectiveCamera makeDefault position={[0,-0.8,4.5]} fov={42} near={.01} far={50} />
          <OrbitControls target={[0,0,0]} enablePan enableZoom enableRotate
            mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.DOLLY }} />
        </>
      ) : (
        <>
          <OrthographicCamera makeDefault position={[0,0,10]} near={.1} far={100} />
          <OrthoZoom tableW={tableW} tableH={tableH} />
        </>
      )}

      <ambientLight intensity={is3d?.6:1} />
      {is3d && <directionalLight position={[2,-1,4]} intensity={1.2} castShadow />}

      <mesh position={[0,0,-.001]}
        onClick={onMeshClick}
        onPointerMove={onPointerMove}
        onPointerUp={()=>{ dragTarget.current=null }}>
        <planeGeometry args={[tableW*20,tableH*20]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Table w={tableW} h={tableH} bgImage={bgImage} showGrid={showGrid}
        gridColor={gridColor} gridMinorStep={gridMinorStep} gridMajorStep={gridMajorStep}
        is3d={is3d} viewportColor={viewportColor} />

      {obstacles.map(obs => (
        <ObstacleMesh key={obs.id} obs={obs} selected={obs.id===selectedObsId} is3d={is3d}
          onPointerDown={e=>{e.stopPropagation();selectObstacle(obs.id);if(mode==='move')dragTarget.current={type:'obs',id:obs.id}}} />
      ))}

      {robots.map(r => (
        <RobotMesh key={r.id} robot={r} selected={r.id===selectedRobotId} simTime={simTime} is3d={is3d}
          onPointerDown={e=>{e.stopPropagation();selectRobot(r.id);if(mode==='move')dragTarget.current={type:'robot',id:r.id}}} />
      ))}

      {robots.map(r => (
        <TrajectoryLine key={`t_${r.id}`} robot={r} selected={r.id===selectedRobotId} simTime={simTime}
          onWaypointClick={idx=>{ if(mode==='draw'){pushHistory({robots,obstacles});removeWaypoint(r.id,idx)} }}
          onWaypointDown={idx=>{ if(mode==='move'){pushHistory({robots,obstacles});dragTarget.current={type:'wp',id:r.id,idx}} }}
          onSegmentClick={(segIdx,wx,wy)=>{ if(mode==='draw'){pushHistory({robots,obstacles});insertWaypoint(r.id,segIdx,clamp(wx,tableW),clamp(wy,tableH))} }} />
      ))}

      {collisions.map((c,i)    => <CollisionMarker key={`rr${i}`} cx={c.x} cy={c.y} color="#dc2626" />)}
      {obsCollisions.map((c,i) => <CollisionMarker key={`ro${i}`} cx={c.x} cy={c.y} color="#f08c00" />)}
      {allBorderCols.map((c,i) => <CollisionMarker key={`br${i}`} cx={c.x} cy={c.y} color="#7048e8" />)}
    </>
  )
}

const getShortcuts = t => [
  { group: t.scGroup1, items: [
    { keys: [t.scClickTable],   desc: t.scClickTableDesc },
    { keys: [t.scClickSeg],     desc: t.scClickSegDesc },
    { keys: [t.scClickWp],      desc: t.scClickWpDesc },
    { keys: [t.scDrag],         desc: t.scDragDesc },
    { keys: ['Ctrl', t.scDrag], desc: t.scCtrlDragDesc },
    { keys: [t.scWheel],        desc: t.scWheelDesc },
    { keys: [t.scMidClick],     desc: t.scMidClickDesc },
  ]},
  { group: t.scGroup2, items: [
    { keys: ['Q'], desc: t.scQDesc },
    { keys: [t.scSpace], desc: t.scSpaceDesc },
  ]},
]

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
      color: '#fff', fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function ShortcutsOverlay() {
  const [open, setOpen] = useState(true)
  const t = useT()
  const shortcuts = getShortcuts(t)
  return (
    <div style={{
      position: 'absolute', bottom: 14, right: 14, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
      pointerEvents: 'none',
    }}>
      {open && (
        <div style={{
          background: 'rgba(15,20,30,0.72)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '10px 14px',
          minWidth: 240,
          pointerEvents: 'auto',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            {t.scTitle}
          </div>
          {shortcuts.map(group => (
            <div key={group.group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{group.group}</div>
              {group.items.map(item => (
                <div key={item.desc} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {item.keys.map((k, i) => (
                      <React.Fragment key={k}>
                        {i > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>+</span>}
                        <Kbd>{k}</Kbd>
                      </React.Fragment>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? t.scHide : t.scShow}
        style={{
          pointerEvents: 'auto',
          width: 32, height: 32, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.18)',
          background: open ? 'rgba(99,102,241,0.7)' : 'rgba(15,20,30,0.65)',
          backdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          transition: 'all .15s',
        }}
      >⌨</button>
    </div>
  )
}

export default function SimCanvas({ onTableClick }) {
  const s = useSimStore()
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas shadows style={{ width:'100%', height:'100%' }} gl={{ antialias:true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(s.canvasBgColor || '#dde3ec'))}>
        <Scene
          robots={s.robots} selectedRobotId={s.selectedRobotId}
          obstacles={s.obstacles} selectedObsId={s.selectedObsId}
          simTime={s.simTime} collisions={s.collisions}
          obsCollisions={s.obsCollisions} borderCollisions={s.borderCollisions}
          showGrid={s.showGrid} gridColor={s.gridColor}
          gridMinorStep={s.gridMinorStep} gridMajorStep={s.gridMajorStep}
          bgImage={s.bgImage} viewportColor={s.viewportColor} canvasBgColor={s.canvasBgColor}
          tableW={s.tableW} tableH={s.tableH}
          mode={s.mode} viewMode={s.viewMode}
          selectRobot={s.selectRobot} selectObstacle={s.selectObstacle}
          setRobotPosition={s.setRobotPosition} setObstaclePosition={s.setObstaclePosition}
          removeWaypoint={s.removeWaypoint} moveWaypoint={s.moveWaypoint}
          updateWaypointPause={s.updateWaypointPause}
          insertWaypoint={s.insertWaypoint}
          onTableClick={onTableClick}
        />
      </Canvas>
      <ShortcutsOverlay />
    </div>
  )
}
