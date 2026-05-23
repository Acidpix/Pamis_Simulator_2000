import React, { useRef, useEffect, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore, getRobotPose } from '../store/simStore.js'

// ---- Table de jeu ----
function Table({ w, h, bgImage, showGrid }) {
  const texRef = useRef(null)

  useEffect(() => {
    if (!bgImage) { texRef.current = null; return }
    const loader = new THREE.TextureLoader()
    loader.load(bgImage, tex => { texRef.current = tex })
  }, [bgImage])

  const gridLines = useMemo(() => {
    if (!showGrid) return []
    const lines = []
    const step = 0.10 // 10cm
    for (let x = 0; x <= w + 0.001; x += step) {
      lines.push([[x - w/2, -h/2, 0.001], [x - w/2, h/2, 0.001]])
    }
    for (let y = 0; y <= h + 0.001; y += step) {
      lines.push([[-w/2, y - h/2, 0.001], [w/2, y - h/2, 0.001]])
    }
    return lines
  }, [w, h, showGrid])

  // Marqueurs de mètre
  const meterMarkers = useMemo(() => {
    const marks = []
    for (let x = 0; x <= w; x += 0.5) marks.push({ type: 'x', v: x, label: `${x}m` })
    for (let y = 0; y <= h; y += 0.5) marks.push({ type: 'y', v: y, label: `${y}m` })
    return marks
  }, [w, h])

  return (
    <group>
      {/* Surface */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#0a1a10" />
      </mesh>

      {/* Image de fond (thème Farming World) */}
      {bgImage && (
        <mesh position={[0, 0, 0.0005]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial transparent opacity={0.35} color="#ffffff" />
        </mesh>
      )}

      {/* Grille fine */}
      {showGrid && gridLines.map((pts, i) => (
        <Line key={i} points={pts} color="#00c8ff" lineWidth={0.3} transparent opacity={0.12} />
      ))}

      {/* Grille 50cm (plus visible) */}
      {showGrid && (() => {
        const major = []
        for (let x = 0; x <= w + 0.001; x += 0.5) {
          major.push(<Line key={`mx${x}`} points={[[x-w/2,-h/2,0.002],[x-w/2,h/2,0.002]]} color="#00c8ff" lineWidth={1.0} transparent opacity={0.3} />)
        }
        for (let y = 0; y <= h + 0.001; y += 0.5) {
          major.push(<Line key={`my${y}`} points={[[-w/2,y-h/2,0.002],[w/2,y-h/2,0.002]]} color="#00c8ff" lineWidth={1.0} transparent opacity={0.3} />)
        }
        return major
      })()}

      {/* Bordure extérieure */}
      <Line
        points={[[-w/2,-h/2,0.003],[w/2,-h/2,0.003],[w/2,h/2,0.003],[-w/2,h/2,0.003],[-w/2,-h/2,0.003]]}
        color="#00c8ff" lineWidth={2.5}
      />

      {/* Labels axes */}
      {meterMarkers.map((m, i) => {
        const pos = m.type === 'x'
          ? [m.v - w/2, -h/2 - 0.08, 0.01]
          : [-w/2 - 0.08, m.v - h/2, 0.01]
        return (
          <Html key={i} position={pos} center>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'rgba(0,200,255,0.5)', userSelect: 'none' }}>
              {m.label}
            </span>
          </Html>
        )
      })}
    </group>
  )
}

// ---- Trajectoire d'un robot ----
function TrajectoryLine({ robot, selected }) {
  const points = useMemo(() => {
    const pts = [new THREE.Vector3(robot.x - 1.5, robot.y - 1.0, 0.005)]
    for (const wp of robot.waypoints) {
      pts.push(new THREE.Vector3(wp.x - 1.5, wp.y - 1.0, 0.005))
    }
    return pts
  }, [robot])

  if (points.length < 2) return null

  return (
    <group>
      {/* Ligne principale */}
      <Line points={points.map(p => [p.x, p.y, p.z])} color={robot.color} lineWidth={selected ? 2.5 : 1.5} transparent opacity={selected ? 0.9 : 0.55} />

      {/* Waypoints */}
      {robot.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x - 1.5, wp.y - 1.0, 0.008]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={robot.color} transparent opacity={0.8} />
        </mesh>
      ))}

      {/* Flèches de direction sur chaque segment */}
      {points.slice(0, -1).map((p, i) => {
        const np = points[i + 1]
        const mid = new THREE.Vector3().lerpVectors(p, np, 0.5)
        const dx = np.x - p.x, dy = np.y - p.y
        const angle = Math.atan2(dy, dx)
        return (
          <mesh key={`arr${i}`} position={[mid.x, mid.y, 0.01]} rotation={[0, 0, angle]}>
            <coneGeometry args={[0.02, 0.05, 6]} />
            <meshBasicMaterial color={robot.color} transparent opacity={0.7} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- Empreinte robot STL ----
function RobotSTL({ stlData, color, opacity = 1 }) {
  const geo = useMemo(() => {
    if (!stlData) return null
    const loader = new STLLoader()
    const geometry = loader.parse(stlData)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    // Centrer et mettre à l'échelle en mètres (supposons mm dans STL)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 0.2 / maxDim // normaliser à ~20cm
    geometry.scale(scale, scale, scale)
    geometry.center()
    return geometry
  }, [stlData])

  if (!geo) return null

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.015]}>
      <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} wireframe={false} />
    </mesh>
  )
}

// ---- Robot sur la table ----
function RobotMesh({ robot, selected, simTime, onPointerDown }) {
  const pose = getRobotPose(robot, simTime)
  const px = pose.x - 1.5
  const py = pose.y - 1.0
  const headingRad = pose.heading * Math.PI / 180

  const color = robot.color
  const opacity = pose.done ? 0.4 : 1.0

  return (
    <group
      position={[px, py, 0]}
      rotation={[0, 0, headingRad]}
      onPointerDown={onPointerDown}
    >
      {/* Corps principal */}
      {robot.shapeType === 'stl' && robot.stlData ? (
        <RobotSTL stlData={robot.stlData} color={color} opacity={opacity} />
      ) : (
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[robot.width, robot.height, 0.05]} />
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.6} />
        </mesh>
      )}

      {/* Contour sélection */}
      {selected && (
        <mesh position={[0, 0, 0.009]}>
          <ringGeometry args={[robot.radius * 0.95, robot.radius * 1.05 + 0.015, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Cercle de collision */}
      <mesh position={[0, 0, 0.008]}>
        <ringGeometry args={[robot.radius - 0.005, robot.radius + 0.005, 32]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.5 : 0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* Direction indicator */}
      <mesh position={[robot.width * 0.45, 0, 0.02]}>
        <coneGeometry args={[0.025, 0.06, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Label nom */}
      <Html position={[0, robot.height / 2 + 0.06, 0.02]} center>
        <div style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 9, fontWeight: 700,
          color: color,
          textShadow: `0 0 6px ${color}`,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          background: 'rgba(6,13,18,0.7)',
          padding: '1px 5px',
          border: `1px solid ${color}44`,
          borderRadius: 2,
        }}>
          {robot.name}
        </div>
      </Html>
    </group>
  )
}

// ---- Marqueur de collision ----
function CollisionMarker({ cx, cy, t }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.material.opacity = 0.4 + 0.4 * Math.sin(clock.elapsedTime * 6)
    }
  })
  return (
    <mesh ref={ref} position={[cx - 1.5, cy - 1.0, 0.02]}>
      <ringGeometry args={[0.04, 0.07, 16]} />
      <meshBasicMaterial color="#ff3d5a" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---- Contrôles caméra orthographique au scroll ----
function CameraController({ tableW, tableH }) {
  const { camera, gl } = useThree()
  const zoom = useRef(1)

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault()
      zoom.current = Math.max(0.5, Math.min(3, zoom.current * (1 - e.deltaY * 0.001)))
      const baseZoom = Math.min(gl.domElement.clientWidth / tableW, gl.domElement.clientHeight / tableH) * 0.92
      camera.zoom = baseZoom * zoom.current
      camera.updateProjectionMatrix()
    }
    gl.domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => gl.domElement.removeEventListener('wheel', handleWheel)
  }, [camera, gl, tableW, tableH])

  return null
}

// ---- Canvas principal ----
export default function SimCanvas({ onTableClick, onRobotDrag }) {
  const { robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH } = useSimStore()
  const selectRobot = useSimStore(s => s.selectRobot)
  const mode = useSimStore(s => s.mode)
  const setRobotPosition = useSimStore(s => s.setRobotPosition)

  const dragging = useRef(null)
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  const raycaster = useRef(new THREE.Raycaster())

  // Coordonnées table → monde Three (table centrée en 0,0)
  const tableToWorld = useCallback((tx, ty) => [tx - tableW/2, ty - tableH/2], [tableW, tableH])
  const worldToTable = useCallback((wx, wy) => [wx + tableW/2, wy + tableH/2], [tableW, tableH])

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      onPointerMissed={(e) => {
        // Clic sur la table
        const rect = e.target.getBoundingClientRect()
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
        // Appel callback avec coordonnées normalisées (résolu dans SceneInner)
      }}
    >
      <SceneInner
        robots={robots}
        selectedRobotId={selectedRobotId}
        simTime={simTime}
        collisions={collisions}
        showGrid={showGrid}
        bgImage={bgImage}
        tableW={tableW}
        tableH={tableH}
        mode={mode}
        selectRobot={selectRobot}
        setRobotPosition={setRobotPosition}
        onTableClick={onTableClick}
      />
    </Canvas>
  )
}

function SceneInner({ robots, selectedRobotId, simTime, collisions, showGrid, bgImage, tableW, tableH, mode, selectRobot, setRobotPosition, onTableClick }) {
  const { camera, gl } = useThree()
  const dragRobot = useRef(null)
  const planeZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  // Ajuster zoom caméra au montage
  useEffect(() => {
    const baseZoom = Math.min(gl.domElement.clientWidth / tableW, gl.domElement.clientHeight / tableH) * 0.9
    camera.zoom = baseZoom
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
    if (mode === 'move') {
      dragRobot.current = robotId
    }
  }, [selectRobot, mode])

  const onPointerMove = useCallback((e) => {
    if (!dragRobot.current) return
    const wp = getWorldPos(e)
    const tx = Math.max(0, Math.min(tableW, wp.x + tableW/2))
    const ty = Math.max(0, Math.min(tableH, wp.y + tableH/2))
    setRobotPosition(dragRobot.current, tx, ty)
  }, [getWorldPos, setRobotPosition, tableW, tableH])

  const onPointerUp = useCallback(() => {
    dragRobot.current = null
  }, [])

  const onMeshClick = useCallback((e) => {
    if (mode !== 'draw') return
    e.stopPropagation()
    const wp = getWorldPos(e)
    const tx = Math.max(0, Math.min(tableW, wp.x + tableW/2))
    const ty = Math.max(0, Math.min(tableH, wp.y + tableH/2))
    onTableClick(tx, ty)
  }, [mode, getWorldPos, tableW, tableH, onTableClick])

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 10]} near={0.1} far={100} />
      <CameraController tableW={tableW} tableH={tableH} />
      <ambientLight intensity={1} />

      {/* Plan invisible pour capturer les clics */}
      <mesh
        position={[0, 0, -0.001]}
        onClick={onMeshClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[tableW, tableH]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Table w={tableW} h={tableH} bgImage={bgImage} showGrid={showGrid} />

      {robots.map(r => (
        <TrajectoryLine key={`traj_${r.id}`} robot={r} selected={r.id === selectedRobotId} />
      ))}

      {robots.map(r => (
        <RobotMesh
          key={r.id}
          robot={r}
          selected={r.id === selectedRobotId}
          simTime={simTime}
          onPointerDown={(e) => onPointerDown(e, r.id)}
        />
      ))}

      {/* Marqueurs de collision */}
      {collisions.map((c, i) => (
        <CollisionMarker key={i} cx={c.x} cy={c.y} t={c.t} />
      ))}
    </>
  )
}
