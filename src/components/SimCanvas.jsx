import React, { useRef, useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera, OrbitControls, Line, Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore, getRobotPose, stlCache } from '../store/simStore.js'

// ---- Background image (Suspense-based pour que useTexture fonctionne) ----
function BgTexture({ url, w, h }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0, 0, 0.001]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

// ---- Table ----
function Table({ w, h, bgImage, showGrid, is3d }) {
  const gridLines = useMemo(() => {
    if (!showGrid) return []
    const lines = []
    for (let x = 0; x <= w + 0.001; x += 0.10)
      lines.push([[x-w/2,-h/2,0.002],[x-w/2,h/2,0.002]])
    for (let y = 0; y <= h + 0.001; y += 0.10)
      lines.push([[-w/2,y-h/2,0.002],[w/2,y-h/2,0.002]])
    return lines
  }, [w, h, showGrid])

  const majorLines = useMemo(() => {
    if (!showGrid) return []
    const lines = []
    for (let x = 0; x <= w + 0.001; x += 0.5)
      lines.push([[x-w/2,-h/2,0.003],[x-w/2,h/2,0.003]])
    for (let y = 0; y <= h + 0.001; y += 0.5)
      lines.push([[-w/2,y-h/2,0.003],[w/2,y-h/2,0.003]])
    return lines
  }, [w, h, showGrid])

  const markers = useMemo(() => {
    const marks = []
    for (let x = 0; x <= w; x += 0.5) marks.push({ type: 'x', v: x, label: `${Math.round(x*100)}` })
    for (let y = 0; y <= h; y += 0.5) marks.push({ type: 'y', v: y, label: `${Math.round(y*100)}` })
    return marks
  }, [w, h])

  return (
    <group>
      {/* Sol vert */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#2d6e3e" roughness={0.8} />
      </mesh>

      {/* Image de fond */}
      {bgImage && (
        <Suspense fallback={null}>
          <BgTexture url={bgImage} w={w} h={h} />
        </Suspense>
      )}

      {/* Grille fine */}
      {showGrid && gridLines.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" lineWidth={0.4} transparent opacity={0.12} />
      ))}
      {/* Grille 50cm */}
      {showGrid && majorLines.map((pts, i) => (
        <Line key={`m${i}`} points={pts} color="#ffffff" lineWidth={1.2} transparent opacity={0.3} />
      ))}

      {/* Bordure */}
      <Line
        points={[[-w/2,-h/2,0.004],[w/2,-h/2,0.004],[w/2,h/2,0.004],[-w/2,h/2,0.004],[-w/2,-h/2,0.004]]}
        color="#ffffff" lineWidth={3}
      />

      {/* Labels cm */}
      {markers.map((m, i) => {
        const pos = m.type === 'x'
          ? [m.v - w/2, -h/2 - 0.10, 0.01]
          : [-w/2 - 0.10, m.v - h/2, 0.01]
        return (
          <Html key={i} position={pos} center>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.75)', fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          </Html>
        )
      })}

      {/* Mur en 3D */}
      {is3d && (
        <>
          {[
            { pos: [0, -h/2, 0.15], rot: [Math.PI/2, 0, 0], args: [w, 0.30] },
            { pos: [0,  h/2, 0.15], rot: [Math.PI/2, 0, 0], args: [w, 0.30] },
            { pos: [-w/2, 0, 0.15], rot: [Math.PI/2, 0, Math.PI/2], args: [h, 0.30] },
            { pos: [ w/2, 0, 0.15], rot: [Math.PI/2, 0, Math.PI/2], args: [h, 0.30] },
          ].map((wall, i) => (
            <mesh key={i} position={wall.pos} rotation={wall.rot}>
              <planeGeometry args={wall.args} />
              <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} transparent opacity={0.25} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

// ---- STL geometry (mémoïsé) ----
function useStlGeometry(robotId, width) {
  return useMemo(() => {
    const buf = stlCache.get(robotId)
    if (!buf) return null
    try {
      const loader = new STLLoader()
      const geo = loader.parse(buf)
      geo.computeBoundingBox()
      const size = new THREE.Vector3()
      geo.boundingBox.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        const scale = width / maxDim
        geo.scale(scale, scale, scale)
      }
      geo.center()
      return geo
    } catch {
      return null
    }
  }, [robotId, width])
}

// ---- Trajectoire ----
function TrajectoryLine({ robot, selected }) {
  const pts = useMemo(() => {
    const arr = [new THREE.Vector3(robot.x - 1.5, robot.y - 1.0, 0.005)]
    for (const wp of robot.waypoints)
      arr.push(new THREE.Vector3(wp.x - 1.5, wp.y - 1.0, 0.005))
    return arr
  }, [robot])

  if (pts.length < 2) return null

  return (
    <group>
      <Line points={pts.map(p => [p.x, p.y, p.z])} color={robot.color}
        lineWidth={selected ? 3 : 1.8} transparent opacity={selected ? 1 : 0.55} />
      {robot.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x - 1.5, wp.y - 1.0, 0.01]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color={robot.color} />
        </mesh>
      ))}
      {pts.slice(0, -1).map((p, i) => {
        const np = pts[i + 1]
        const mid = new THREE.Vector3().lerpVectors(p, np, 0.55)
        return (
          <mesh key={`a${i}`} position={[mid.x, mid.y, 0.012]}
            rotation={[0, 0, Math.atan2(np.y - p.y, np.x - p.x) - Math.PI/2]}>
            <coneGeometry args={[0.025, 0.055, 3]} />
            <meshBasicMaterial color={robot.color} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- Robot mesh ----
function RobotMesh({ robot, selected, simTime, onPointerDown, is3d }) {
  const pose = getRobotPose(robot, simTime)
  const px = pose.x - 1.5
  const py = pose.y - 1.0
  const rz = pose.heading * Math.PI / 180
  const opacity = pose.done ? 0.35 : 1
  const robotH = is3d ? robot.height : 0.04
  const stlGeo = useStlGeometry(robot.hasStl ? robot.id : null, robot.width)

  return (
    <group position={[px, py, is3d ? robotH / 2 : 0]} rotation={[0, 0, rz]} onPointerDown={onPointerDown}>
      {/* Corps */}
      {stlGeo ? (
        <mesh geometry={stlGeo} castShadow rotation={is3d ? [0,0,0] : [-Math.PI/2, 0, 0]}>
          <meshStandardMaterial color={robot.color} transparent opacity={opacity * 0.9} />
        </mesh>
      ) : (
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[robot.width, robot.height, robotH]} />
          <meshStandardMaterial color={robot.color} transparent opacity={opacity * 0.9} roughness={0.5} />
        </mesh>
      )}

      {/* Anneau de sélection */}
      {selected && (
        <mesh position={[0, 0, is3d ? -robotH/2 + 0.001 : 0.012]}>
          <ringGeometry args={[robot.radius, robot.radius + 0.025, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Flèche de direction */}
      <mesh position={[robot.width * 0.5 + 0.03, 0, is3d ? 0 : 0.02]}
        rotation={[0, 0, -Math.PI/2]}>
        <coneGeometry args={[0.02, 0.06, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Label */}
      <Html position={[0, robot.height / 2 + 0.08, is3d ? robotH / 2 : 0]} center>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#fff',
          background: robot.color, padding: '2px 7px', borderRadius: 5,
          userSelect: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        }}>
          {robot.name}
        </div>
      </Html>
    </group>
  )
}

// ---- Collision marker ----
function CollisionMarker({ cx, cy }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.35 + 0.45 * Math.sin(clock.elapsedTime * 5)
  })
  return (
    <mesh ref={ref} position={[cx - 1.5, cy - 1.0, 0.02]}>
      <ringGeometry args={[0.06, 0.10, 16]} />
      <meshBasicMaterial color="#dc2626" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---- Zoom ortho au scroll ----
function OrthoZoom({ tableW, tableH }) {
  const { camera, gl } = useThree()
  const zoom = useRef(1)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e) => {
      e.preventDefault()
      zoom.current = Math.max(0.4, Math.min(5, zoom.current * (1 - e.deltaY * 0.001)))
      const base = Math.min(el.clientWidth / tableW, el.clientHeight / tableH) * 0.9
      camera.zoom = base * zoom.current
      camera.updateProjectionMatrix()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [camera, gl, tableW, tableH])
  return null
}

// ---- Scene intérieure ----
function Scene({ robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH, mode, viewMode, selectRobot, setRobotPosition, onTableClick }) {
  const { camera, gl } = useThree()
  const dragRobot = useRef(null)
  const planeZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const is3d = viewMode === '3d'

  useEffect(() => {
    if (is3d) return
    const base = Math.min(gl.domElement.clientWidth / tableW, gl.domElement.clientHeight / tableH) * 0.9
    camera.zoom = base
    camera.updateProjectionMatrix()
  }, [camera, gl, tableW, tableH, is3d])

  const getWorldPos = useCallback((e) => {
    const rect = gl.domElement.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const ray = new THREE.Raycaster()
    ray.setFromCamera({ x: nx, y: ny }, camera)
    ray.ray.intersectPlane(planeZ, hit)
    return hit.clone()
  }, [camera, gl, planeZ, hit])

  const onPointerDown = useCallback((e, robotId) => {
    e.stopPropagation()
    selectRobot(robotId)
    if (mode === 'move') dragRobot.current = robotId
  }, [selectRobot, mode])

  const onPointerMove = useCallback((e) => {
    if (!dragRobot.current) return
    const wp = getWorldPos(e)
    setRobotPosition(dragRobot.current,
      Math.max(0, Math.min(tableW, wp.x + tableW/2)),
      Math.max(0, Math.min(tableH, wp.y + tableH/2))
    )
  }, [getWorldPos, setRobotPosition, tableW, tableH])

  const onMeshClick = useCallback((e) => {
    if (mode !== 'draw' || is3d) return
    e.stopPropagation()
    const wp = getWorldPos(e)
    onTableClick(
      Math.max(0, Math.min(tableW, wp.x + tableW/2)),
      Math.max(0, Math.min(tableH, wp.y + tableH/2))
    )
  }, [mode, is3d, getWorldPos, tableW, tableH, onTableClick])

  return (
    <>
      {is3d ? (
        <>
          <PerspectiveCamera makeDefault position={[0, -2.5, 3]} fov={45} near={0.01} far={50} />
          <OrbitControls target={[0, 0, 0]} enablePan enableZoom enableRotate />
        </>
      ) : (
        <>
          <OrthographicCamera makeDefault position={[0, 0, 10]} near={0.1} far={100} />
          <OrthoZoom tableW={tableW} tableH={tableH} />
        </>
      )}

      <ambientLight intensity={is3d ? 0.6 : 1} />
      {is3d && <directionalLight position={[2, -2, 4]} intensity={1} castShadow />}

      {/* Plan de capture des clics (2D uniquement) */}
      {!is3d && (
        <mesh position={[0, 0, -0.001]}
          onClick={onMeshClick}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragRobot.current = null }}>
          <planeGeometry args={[tableW, tableH]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      <Table w={tableW} h={tableH} bgImage={bgImage} showGrid={showGrid} is3d={is3d} />

      {robots.map(r => <TrajectoryLine key={`t_${r.id}`} robot={r} selected={r.id === selectedRobotId} />)}
      {robots.map(r => (
        <RobotMesh key={r.id} robot={r} selected={r.id === selectedRobotId}
          simTime={simTime} is3d={is3d}
          onPointerDown={(e) => onPointerDown(e, r.id)} />
      ))}
      {collisions.map((c, i) => <CollisionMarker key={i} cx={c.x} cy={c.y} />)}
    </>
  )
}

export default function SimCanvas({ onTableClick }) {
  const store = useSimStore()
  const { robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH, mode, viewMode } = store
  const selectRobot = useSimStore(s => s.selectRobot)
  const setRobotPosition = useSimStore(s => s.setRobotPosition)

  return (
    <Canvas
      shadows
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Scene
        robots={robots} selectedRobotId={selectedRobotId} simTime={simTime}
        collisions={collisions} showGrid={showGrid} bgImage={bgImage}
        tableW={tableW} tableH={tableH} mode={mode} viewMode={viewMode}
        selectRobot={selectRobot} setRobotPosition={setRobotPosition}
        onTableClick={onTableClick}
      />
    </Canvas>
  )
}
