import React, { useRef, useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera, OrbitControls, Line, Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore, getRobotPose, stlCache, pushHistory } from '../store/simStore.js'

function BgTexture({ url, w, h }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0, 0, 0.001]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

function Table({ w, h, bgImage, showGrid, gridColor, gridMinorStep, gridMajorStep, is3d }) {
  const minorM = (gridMinorStep / 100)
  const majorM = (gridMajorStep / 100)

  const minorLines = useMemo(() => {
    if (!showGrid || minorM <= 0) return []
    const lines = []
    for (let x = 0; x <= w + 1e-4; x += minorM) lines.push([[x-w/2,-h/2,0.002],[x-w/2,h/2,0.002]])
    for (let y = 0; y <= h + 1e-4; y += minorM) lines.push([[-w/2,y-h/2,0.002],[w/2,y-h/2,0.002]])
    return lines
  }, [w, h, showGrid, minorM])

  const majorLines = useMemo(() => {
    if (!showGrid || majorM <= 0) return []
    const lines = []
    for (let x = 0; x <= w + 1e-4; x += majorM) lines.push([[x-w/2,-h/2,0.003],[x-w/2,h/2,0.003]])
    for (let y = 0; y <= h + 1e-4; y += majorM) lines.push([[-w/2,y-h/2,0.003],[w/2,y-h/2,0.003]])
    return lines
  }, [w, h, showGrid, majorM])

  const markers = useMemo(() => {
    const marks = []
    for (let x = 0; x <= w; x += majorM > 0 ? majorM : 0.5) marks.push({ type: 'x', v: x, label: `${Math.round(x*1000)}` })
    for (let y = 0; y <= h; y += majorM > 0 ? majorM : 0.5) marks.push({ type: 'y', v: y, label: `${Math.round(y*1000)}` })
    return marks
  }, [w, h, majorM])

  return (
    <group>
      <mesh receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#2d6e3e" roughness={0.8} />
      </mesh>

      {bgImage && <Suspense fallback={null}><BgTexture url={bgImage} w={w} h={h} /></Suspense>}

      {showGrid && minorLines.map((pts, i) => (
        <Line key={i} points={pts} color={gridColor} lineWidth={0.4} transparent opacity={0.15} />
      ))}
      {showGrid && majorLines.map((pts, i) => (
        <Line key={`M${i}`} points={pts} color={gridColor} lineWidth={1.5} transparent opacity={0.35} />
      ))}

      <Line
        points={[[-w/2,-h/2,0.004],[w/2,-h/2,0.004],[w/2,h/2,0.004],[-w/2,h/2,0.004],[-w/2,-h/2,0.004]]}
        color={gridColor} lineWidth={3}
      />

      {markers.map((m, i) => {
        const pos = m.type === 'x' ? [m.v-w/2, -h/2-0.10, 0.01] : [-w/2-0.10, m.v-h/2, 0.01]
        return (
          <Html key={i} position={pos} center>
            <span style={{ fontSize: 9, color: gridColor, opacity: .75, fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          </Html>
        )
      })}

      {is3d && [
        { pos:[0,-h/2,0.15], rot:[Math.PI/2,0,0], args:[w,0.30] },
        { pos:[0, h/2,0.15], rot:[Math.PI/2,0,0], args:[w,0.30] },
        { pos:[-w/2,0,0.15], rot:[Math.PI/2,0,Math.PI/2], args:[h,0.30] },
        { pos:[ w/2,0,0.15], rot:[Math.PI/2,0,Math.PI/2], args:[h,0.30] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={wall.rot}>
          <planeGeometry args={wall.args} />
          <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} transparent opacity={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function useStlGeo(robotId, hasStl, width) {
  return useMemo(() => {
    if (!hasStl) return null
    const buf = stlCache.get(robotId)
    if (!buf) return null
    try {
      const geo = new STLLoader().parse(buf)
      geo.computeBoundingBox()
      const sz = new THREE.Vector3(); geo.boundingBox.getSize(sz)
      const maxDim = Math.max(sz.x, sz.y, sz.z)
      if (maxDim > 0) { const s = width / maxDim; geo.scale(s,s,s) }
      geo.center()
      return geo
    } catch { return null }
  }, [robotId, hasStl, width])
}

function TrajectoryLine({ robot, selected, simTime, onWaypointClick, onWaypointDown }) {
  const pts = useMemo(() => {
    const arr = [new THREE.Vector3(robot.x-1.5, robot.y-1.0, 0.006)]
    for (const wp of robot.waypoints) arr.push(new THREE.Vector3(wp.x-1.5, wp.y-1.0, 0.006))
    return arr
  }, [robot])

  if (pts.length < 2) return null
  return (
    <group>
      <Line points={pts.map(p=>[p.x,p.y,p.z])} color={robot.color} lineWidth={selected?3:1.8} transparent opacity={selected?1:.55} />
      {robot.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x-1.5, wp.y-1.0, 0.01]}
          onClick={e => { e.stopPropagation(); onWaypointClick?.(i) }}
          onPointerDown={e => { e.stopPropagation(); onWaypointDown?.(i) }}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color={robot.color} transparent opacity={0.9} />
        </mesh>
      ))}
      {pts.slice(0,-1).map((p,i) => {
        const np = pts[i+1]
        const mid = new THREE.Vector3().lerpVectors(p, np, 0.55)
        return (
          <mesh key={`a${i}`} position={[mid.x,mid.y,0.012]} rotation={[0,0,Math.atan2(np.y-p.y,np.x-p.x)-Math.PI/2]}>
            <coneGeometry args={[0.025,0.055,3]} />
            <meshBasicMaterial color={robot.color} />
          </mesh>
        )
      })}
    </group>
  )
}

function RobotMesh({ robot, selected, simTime, onPointerDown, is3d }) {
  const pose = getRobotPose(robot, simTime)
  const stlGeo = useStlGeo(robot.id, robot.hasStl, robot.width)
  const robotH = is3d ? robot.height : 0.04
  const opacity = pose.done ? 0.35 : 1

  return (
    <group position={[pose.x-1.5, pose.y-1.0, is3d ? robotH/2 : 0]}
      rotation={[0, 0, pose.heading * Math.PI / 180]} onPointerDown={onPointerDown}>
      {stlGeo ? (
        <mesh geometry={stlGeo} castShadow
          rotation={[(robot.stlRotX??-90)*Math.PI/180, (robot.stlRotY??0)*Math.PI/180, (robot.stlRotZ??0)*Math.PI/180]}>
          <meshStandardMaterial color={robot.color} transparent opacity={opacity*.9} />
        </mesh>
      ) : (
        <mesh castShadow>
          <boxGeometry args={[robot.width, robot.height, robotH]} />
          <meshStandardMaterial color={robot.color} transparent opacity={opacity*.9} roughness={.5} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, is3d ? -robotH/2+.001 : .013]}>
          <ringGeometry args={[robot.radius, robot.radius+.025, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[robot.width*.5+.03, 0, is3d ? 0 : .02]} rotation={[0,0,-Math.PI/2]}>
        <coneGeometry args={[.02,.06,8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html position={[0, robot.height/2+.09, is3d ? robotH/2 : 0]} center>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', background:robot.color, padding:'2px 8px', borderRadius:5, userSelect:'none', whiteSpace:'nowrap', boxShadow:'0 2px 6px rgba(0,0,0,.35)' }}>
          {robot.name}
        </div>
      </Html>
    </group>
  )
}

function ObstacleMesh({ obs, selected, onPointerDown, is3d }) {
  const h = is3d ? obs.height : 0.05
  return (
    <group position={[obs.x-1.5, obs.y-1.0, is3d ? h/2 : 0]} onPointerDown={onPointerDown}>
      {obs.shape === 'circle' ? (
        <mesh>
          <cylinderGeometry args={[obs.radius, obs.radius, h, 32]} rotation={[Math.PI/2,0,0]} />
          <meshStandardMaterial color={obs.color} transparent opacity={.85} roughness={.6} />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[obs.width, obs.height, h]} />
          <meshStandardMaterial color={obs.color} transparent opacity={.85} roughness={.6} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, is3d ? -h/2+.001 : .014]}>
          <ringGeometry args={[obs.radius, obs.radius+.025, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html position={[0, (obs.height||obs.radius||.1)/2+.08, is3d ? h/2 : 0]} center>
        <div style={{ fontSize:11, fontWeight:600, color:'#fff', background:obs.color, padding:'1px 6px', borderRadius:4, userSelect:'none', whiteSpace:'nowrap', boxShadow:'0 1px 4px rgba(0,0,0,.3)' }}>
          {obs.name}
        </div>
      </Html>
    </group>
  )
}

function CollisionMarker({ cx, cy }) {
  const ref = useRef()
  useFrame(({ clock }) => { if (ref.current) ref.current.material.opacity = .3+.5*Math.sin(clock.elapsedTime*5) })
  return (
    <mesh ref={ref} position={[cx-1.5, cy-1.0, .025]}>
      <ringGeometry args={[.06,.10,16]} />
      <meshBasicMaterial color="#dc2626" transparent opacity={.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

function OrthoZoom({ tableW, tableH }) {
  const { camera, gl } = useThree()
  const zoom = useRef(1)
  useEffect(() => {
    const el = gl.domElement
    const fn = e => {
      e.preventDefault()
      zoom.current = Math.max(.4, Math.min(6, zoom.current*(1-e.deltaY*.001)))
      camera.zoom = Math.min(el.clientWidth/tableW, el.clientHeight/tableH)*.9*zoom.current
      camera.updateProjectionMatrix()
    }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [camera, gl, tableW, tableH])
  return null
}

function Scene({ robots, selectedRobotId, obstacles, selectedObsId, simTime, collisions, obsCollisions,
  showGrid, gridColor, gridMinorStep, gridMajorStep, bgImage, tableW, tableH,
  mode, viewMode, selectRobot, selectObstacle, setRobotPosition, setObstaclePosition,
  onTableClick, removeWaypoint, moveWaypoint }) {

  const { camera, gl } = useThree()
  // type: 'robot' | 'obs' | 'waypoint'
  const dragTarget = useRef(null)
  const planeZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0,0,1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const is3d = viewMode === '3d'

  useEffect(() => {
    if (is3d) return
    camera.zoom = Math.min(gl.domElement.clientWidth/tableW, gl.domElement.clientHeight/tableH)*.9
    camera.updateProjectionMatrix()
  }, [camera, gl, tableW, tableH, is3d])

  const getWorldPos = useCallback(e => {
    const rect = gl.domElement.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera({
      x: ((e.clientX-rect.left)/rect.width)*2-1,
      y: -((e.clientY-rect.top)/rect.height)*2+1,
    }, camera)
    ray.ray.intersectPlane(planeZ, hit)
    return hit.clone()
  }, [camera, gl, planeZ, hit])

  const clamp = useCallback((v, max) => Math.max(0, Math.min(max, v)), [])

  const onPointerMove = useCallback(e => {
    if (!dragTarget.current) return
    const wp = getWorldPos(e)
    const tx = clamp(wp.x+tableW/2, tableW), ty = clamp(wp.y+tableH/2, tableH)
    const dt = dragTarget.current
    if (dt.type === 'robot') setRobotPosition(dt.id, tx, ty)
    else if (dt.type === 'obs') setObstaclePosition(dt.id, tx, ty)
    else if (dt.type === 'waypoint') moveWaypoint(dt.id, dt.idx, tx, ty)
  }, [getWorldPos, setRobotPosition, setObstaclePosition, moveWaypoint, clamp, tableW, tableH])

  const onMeshClick = useCallback(e => {
    if (mode !== 'draw' || is3d) return
    e.stopPropagation()
    const wp = getWorldPos(e)
    onTableClick(clamp(wp.x+tableW/2, tableW), clamp(wp.y+tableH/2, tableH))
  }, [mode, is3d, getWorldPos, tableW, tableH, onTableClick, clamp])

  const allCollisionPts = [
    ...collisions.map(c => ({ x: c.x, y: c.y })),
    ...obsCollisions.map(c => ({ x: c.x, y: c.y })),
  ]

  return (
    <>
      {is3d ? (
        <>
          <PerspectiveCamera makeDefault position={[0, -0.8, 4.5]} fov={42} near={.01} far={50} />
          <OrbitControls target={[0,0,0]} enablePan enableZoom enableRotate />
        </>
      ) : (
        <>
          <OrthographicCamera makeDefault position={[0,0,10]} near={.1} far={100} />
          <OrthoZoom tableW={tableW} tableH={tableH} />
        </>
      )}

      <ambientLight intensity={is3d ? .6 : 1} />
      {is3d && <directionalLight position={[2,-1,4]} intensity={1.2} castShadow />}

      {!is3d && (
        <mesh position={[0,0,-.001]} onClick={onMeshClick}
          onPointerMove={onPointerMove} onPointerUp={() => { dragTarget.current = null }}>
          <planeGeometry args={[tableW, tableH]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {is3d && (
        <mesh position={[0,0,0]} onPointerMove={onPointerMove} onPointerUp={() => { dragTarget.current = null }}>
          <planeGeometry args={[tableW*10, tableH*10]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      <Table w={tableW} h={tableH} bgImage={bgImage} showGrid={showGrid}
        gridColor={gridColor} gridMinorStep={gridMinorStep} gridMajorStep={gridMajorStep} is3d={is3d} />

      {obstacles.map(obs => (
        <ObstacleMesh key={obs.id} obs={obs} selected={obs.id === selectedObsId} is3d={is3d}
          onPointerDown={e => { e.stopPropagation(); selectObstacle(obs.id); if (mode==='move') dragTarget.current={ type:'obs', id:obs.id } }} />
      ))}

      {robots.map(r => <TrajectoryLine key={`t_${r.id}`} robot={r} selected={r.id===selectedRobotId} simTime={simTime}
        onWaypointClick={idx => { if (mode==='draw') { pushHistory({ robots, obstacles }); removeWaypoint(r.id, idx) } }}
        onWaypointDown={idx => { if (mode==='move') { pushHistory({ robots, obstacles }); dragTarget.current = { type:'waypoint', id:r.id, idx } } }} />)}

      {robots.map(r => (
        <RobotMesh key={r.id} robot={r} selected={r.id===selectedRobotId} simTime={simTime} is3d={is3d}
          onPointerDown={e => { e.stopPropagation(); selectRobot(r.id); if (mode==='move') dragTarget.current={ type:'robot', id:r.id } }} />
      ))}

      {allCollisionPts.map((c,i) => <CollisionMarker key={i} cx={c.x} cy={c.y} />)}
    </>
  )
}

export default function SimCanvas({ onTableClick }) {
  const s = useSimStore()
  return (
    <Canvas shadows style={{ width:'100%', height:'100%' }} gl={{ antialias:true }}>
      <Scene
        robots={s.robots} selectedRobotId={s.selectedRobotId}
        obstacles={s.obstacles} selectedObsId={s.selectedObsId}
        simTime={s.simTime} collisions={s.collisions} obsCollisions={s.obsCollisions}
        showGrid={s.showGrid} gridColor={s.gridColor}
        gridMinorStep={s.gridMinorStep} gridMajorStep={s.gridMajorStep}
        bgImage={s.bgImage} tableW={s.tableW} tableH={s.tableH}
        mode={s.mode} viewMode={s.viewMode}
        selectRobot={s.selectRobot} selectObstacle={s.selectObstacle}
        setRobotPosition={s.setRobotPosition} setObstaclePosition={s.setObstaclePosition}
        removeWaypoint={s.removeWaypoint} moveWaypoint={s.moveWaypoint}
        onTableClick={onTableClick}
      />
    </Canvas>
  )
}
