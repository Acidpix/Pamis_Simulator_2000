import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore, getRobotPose } from '../store/simStore.js'

// ---- Table ----
function Table({ w, h, bgImage, showGrid }) {
  const [texture, setTexture] = useState(null)

  useEffect(() => {
    if (!bgImage) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.load(bgImage, tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      setTexture(tex)
    })
  }, [bgImage])

  const gridLines = useMemo(() => {
    if (!showGrid) return []
    const lines = []
    const step = 0.10
    for (let x = 0; x <= w + 0.001; x += step) {
      lines.push([[x - w/2, -h/2, 0.001], [x - w/2, h/2, 0.001]])
    }
    for (let y = 0; y <= h + 0.001; y += step) {
      lines.push([[-w/2, y - h/2, 0.001], [w/2, y - h/2, 0.001]])
    }
    return lines
  }, [w, h, showGrid])

  const majorLines = useMemo(() => {
    if (!showGrid) return []
    const lines = []
    for (let x = 0; x <= w + 0.001; x += 0.5)
      lines.push([[x-w/2,-h/2,0.002],[x-w/2,h/2,0.002]])
    for (let y = 0; y <= h + 0.001; y += 0.5)
      lines.push([[-w/2,y-h/2,0.002],[w/2,y-h/2,0.002]])
    return lines
  }, [w, h, showGrid])

  const markers = useMemo(() => {
    const marks = []
    for (let x = 0; x <= w; x += 0.5) marks.push({ type: 'x', v: x, label: `${x}m` })
    for (let y = 0; y <= h; y += 0.5) marks.push({ type: 'y', v: y, label: `${y}m` })
    return marks
  }, [w, h])

  return (
    <group>
      {/* Surface verte */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={texture ? '#ffffff' : '#2d6e3e'} map={texture || null} />
      </mesh>

      {/* Grille fine */}
      {showGrid && gridLines.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" lineWidth={0.4} transparent opacity={0.15} />
      ))}

      {/* Grille 50cm */}
      {showGrid && majorLines.map((pts, i) => (
        <Line key={`m${i}`} points={pts} color="#ffffff" lineWidth={1.2} transparent opacity={0.35} />
      ))}

      {/* Bordure */}
      <Line
        points={[[-w/2,-h/2,0.003],[w/2,-h/2,0.003],[w/2,h/2,0.003],[-w/2,h/2,0.003],[-w/2,-h/2,0.003]]}
        color="#ffffff" lineWidth={3}
      />

      {/* Labels */}
      {markers.map((m, i) => {
        const pos = m.type === 'x'
          ? [m.v - w/2, -h/2 - 0.09, 0.01]
          : [-w/2 - 0.09, m.v - h/2, 0.01]
        return (
          <Html key={i} position={pos} center>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          </Html>
        )
      })}
    </group>
  )
}

// ---- Trajectoire ----
function TrajectoryLine({ robot, selected }) {
  const points = useMemo(() => {
    const pts = [new THREE.Vector3(robot.x - 1.5, robot.y - 1.0, 0.005)]
    for (const wp of robot.waypoints)
      pts.push(new THREE.Vector3(wp.x - 1.5, wp.y - 1.0, 0.005))
    return pts
  }, [robot])

  if (points.length < 2) return null

  return (
    <group>
      <Line points={points.map(p => [p.x, p.y, p.z])} color={robot.color} lineWidth={selected ? 3 : 2} transparent opacity={selected ? 1 : 0.6} />
      {robot.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x - 1.5, wp.y - 1.0, 0.008]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color={robot.color} />
        </mesh>
      ))}
      {points.slice(0, -1).map((p, i) => {
        const np = points[i + 1]
        const mid = new THREE.Vector3().lerpVectors(p, np, 0.55)
        const dx = np.x - p.x, dy = np.y - p.y
        return (
          <mesh key={`a${i}`} position={[mid.x, mid.y, 0.01]} rotation={[0, 0, Math.atan2(dy, dx) - Math.PI/2]}>
            <coneGeometry args={[0.025, 0.055, 3]} />
            <meshBasicMaterial color={robot.color} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- Robot ----
function RobotMesh({ robot, selected, simTime, onPointerDown }) {
  const pose = getRobotPose(robot, simTime)
  const px = pose.x - 1.5
  const py = pose.y - 1.0

  return (
    <group position={[px, py, 0]} rotation={[0, 0, pose.heading * Math.PI / 180]} onPointerDown={onPointerDown}>
      {/* Corps */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[robot.width, robot.height, 0.04]} />
        <meshBasicMaterial color={robot.color} transparent opacity={pose.done ? 0.4 : 0.9} />
      </mesh>

      {/* Contour blanc si sélectionné */}
      {selected && (
        <mesh position={[0, 0, 0.009]}>
          <ringGeometry args={[Math.max(robot.width, robot.height) * 0.6, Math.max(robot.width, robot.height) * 0.6 + 0.02, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Indicateur de direction */}
      <mesh position={[robot.width * 0.45, 0, 0.02]}>
        <coneGeometry args={[0.02, 0.05, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Nom */}
      <Html position={[0, robot.height / 2 + 0.07, 0.02]} center>
        <div style={{
          fontSize: 10, fontWeight: 600,
          color: '#fff',
          background: robot.color,
          padding: '2px 6px',
          borderRadius: 4,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
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
    if (ref.current) ref.current.material.opacity = 0.4 + 0.4 * Math.sin(clock.elapsedTime * 5)
  })
  return (
    <mesh ref={ref} position={[cx - 1.5, cy - 1.0, 0.02]}>
      <ringGeometry args={[0.05, 0.08, 16]} />
      <meshBasicMaterial color="#dc2626" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---- Camera zoom ----
function CameraController({ tableW, tableH }) {
  const { camera, gl } = useThree()
  const zoom = useRef(1)

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault()
      zoom.current = Math.max(0.5, Math.min(4, zoom.current * (1 - e.deltaY * 0.001)))
      const base = Math.min(gl.domElement.clientWidth / tableW, gl.domElement.clientHeight / tableH) * 0.9
      camera.zoom = base * zoom.current
      camera.updateProjectionMatrix()
    }
    gl.domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => gl.domElement.removeEventListener('wheel', handleWheel)
  }, [camera, gl, tableW, tableH])

  return null
}

// ---- Scene ----
function Scene({ robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH, mode, selectRobot, setRobotPosition, onTableClick }) {
  const { camera, gl } = useThree()
  const dragRobot = useRef(null)
  const planeZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const base = Math.min(gl.domElement.clientWidth / tableW, gl.domElement.clientHeight / tableH) * 0.9
    camera.zoom = base
    camera.updateProjectionMatrix()
  }, [camera, gl, tableW, tableH])

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
    if (mode !== 'draw') return
    e.stopPropagation()
    const wp = getWorldPos(e)
    onTableClick(
      Math.max(0, Math.min(tableW, wp.x + tableW/2)),
      Math.max(0, Math.min(tableH, wp.y + tableH/2))
    )
  }, [mode, getWorldPos, tableW, tableH, onTableClick])

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 10]} near={0.1} far={100} />
      <CameraController tableW={tableW} tableH={tableH} />
      <ambientLight intensity={1} />

      <mesh position={[0, 0, -0.001]} onClick={onMeshClick} onPointerMove={onPointerMove} onPointerUp={() => { dragRobot.current = null }}>
        <planeGeometry args={[tableW, tableH]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Table w={tableW} h={tableH} bgImage={bgImage} showGrid={showGrid} />

      {robots.map(r => <TrajectoryLine key={`t_${r.id}`} robot={r} selected={r.id === selectedRobotId} />)}
      {robots.map(r => (
        <RobotMesh key={r.id} robot={r} selected={r.id === selectedRobotId} simTime={simTime}
          onPointerDown={(e) => onPointerDown(e, r.id)} />
      ))}
      {collisions.map((c, i) => <CollisionMarker key={i} cx={c.x} cy={c.y} />)}
    </>
  )
}

export default function SimCanvas({ onTableClick }) {
  const { robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH } = useSimStore()
  const selectRobot = useSimStore(s => s.selectRobot)
  const mode = useSimStore(s => s.mode)
  const setRobotPosition = useSimStore(s => s.setRobotPosition)

  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <Scene
        robots={robots} selectedRobotId={selectedRobotId} simTime={simTime}
        collisions={collisions} showGrid={showGrid} bgImage={bgImage}
        tableW={tableW} tableH={tableH} mode={mode}
        selectRobot={selectRobot} setRobotPosition={setRobotPosition}
        onTableClick={onTableClick}
      />
    </Canvas>
  )
}
