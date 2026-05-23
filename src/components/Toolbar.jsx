import React, { useEffect, useRef } from 'react'
import { useSimStore, detectCollisions } from '../store/simStore.js'

const SAVE_VERSION = 1

function saveToFile(robots, meta) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta,
    robots: robots.map(r => ({
      id: r.id, name: r.name, color: r.color,
      x: r.x, y: r.y, heading: r.heading,
      width: r.width, height: r.height, radius: r.radius,
      speed: r.speed, startDelay: r.startDelay,
      shapeType: r.shapeType === 'stl' ? 'rect' : r.shapeType, // STL non sérialisable
      waypoints: r.waypoints,
    })),
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  a.download = `pamis_save_${date}.json`
  a.click()
}

function loadFromFile(file, onLoad, onError) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (!data.robots || !Array.isArray(data.robots)) throw new Error('Format invalide')
      onLoad(data.robots, data.meta || {})
    } catch (err) {
      onError(err.message)
    }
  }
  reader.readAsText(file)
}

function Btn({ active, onClick, children, variant = 'default', title }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 6,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: '1.5px solid transparent', transition: 'all .12s',
    whiteSpace: 'nowrap', lineHeight: 1,
  }
  const v = {
    default: { ...base, background: active ? '#2563eb' : '#fff', border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`, color: active ? '#fff' : '#475569' },
    green:   { ...base, background: active ? '#16a34a' : '#fff', border: `1.5px solid ${active ? '#16a34a' : '#e2e8f0'}`, color: active ? '#fff' : '#475569' },
    ghost:   { ...base, background: 'transparent', border: '1.5px solid #e2e8f0', color: '#475569' },
  }
  return <button style={v[variant] || v.default} onClick={onClick} title={title}>{children}</button>
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 4px', flexShrink: 0 }} />
}

export default function Toolbar() {
  const mode        = useSimStore(s => s.mode)
  const setMode     = useSimStore(s => s.setMode)
  const simPlaying  = useSimStore(s => s.simPlaying)
  const setSimPlaying = useSimStore(s => s.setSimPlaying)
  const simTime     = useSimStore(s => s.simTime)
  const setSimTime  = useSimStore(s => s.setSimTime)
  const simMaxTime  = useSimStore(s => s.simMaxTime)
  const setSimMaxTime = useSimStore(s => s.setSimMaxTime)
  const simSpeed    = useSimStore(s => s.simSpeed)
  const setSimSpeed = useSimStore(s => s.setSimSpeed)
  const showGrid    = useSimStore(s => s.showGrid)
  const setShowGrid = useSimStore(s => s.setShowGrid)
  const viewMode    = useSimStore(s => s.viewMode)
  const setViewMode = useSimStore(s => s.setViewMode)
  const robots      = useSimStore(s => s.robots)
  const setCollisions = useSimStore(s => s.setCollisions)
  const loadState   = useSimStore(s => s.loadState)

  const loadInputRef = useRef()
  const rafRef = useRef(null)
  const lastRef = useRef(null)
  const simTimeRef    = useRef(simTime)
  const simSpeedRef   = useRef(simSpeed)
  const simMaxTimeRef = useRef(simMaxTime)

  useEffect(() => { simTimeRef.current = simTime }, [simTime])
  useEffect(() => { simSpeedRef.current = simSpeed }, [simSpeed])
  useEffect(() => { simMaxTimeRef.current = simMaxTime }, [simMaxTime])

  useEffect(() => {
    if (!simPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
      return
    }
    const tick = (ts) => {
      if (lastRef.current !== null) {
        const dt = (ts - lastRef.current) / 1000 * simSpeedRef.current
        const next = simTimeRef.current + dt
        if (next >= simMaxTimeRef.current) {
          setSimTime(simMaxTimeRef.current)
          setSimPlaying(false)
          return
        }
        setSimTime(next)
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [simPlaying])

  useEffect(() => {
    if (robots.length < 2) { setCollisions([]); return }
    setCollisions(detectCollisions(robots, simMaxTime, 0.05))
  }, [robots, simMaxTime])

  const handlePlayPause = () => {
    if (simTime >= simMaxTime) setSimTime(0)
    setSimPlaying(!simPlaying)
  }

  const pct = simMaxTime > 0 ? (simTime / simMaxTime) * 100 : 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 16px', background: '#fff',
      borderBottom: '1px solid #e2e8f0', flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb', letterSpacing: '-.3px', marginRight: 4 }}>
        PAMIS 2000
      </span>

      <Sep />

      <Btn active={mode === 'draw'} onClick={() => setMode('draw')} title="Cliquer sur la table pour ajouter des points de passage">
        ✏️ Tracer
      </Btn>
      <Btn active={mode === 'move'} onClick={() => setMode('move')} title="Glisser les robots sur la table">
        ✋ Déplacer
      </Btn>

      <Sep />

      <Btn variant="green" active={simPlaying} onClick={handlePlayPause}>
        {simPlaying ? '⏸ Pause' : '▶ Simuler'}
      </Btn>
      <Btn variant="ghost" onClick={() => { setSimPlaying(false); setSimTime(0) }}>⏮ Reset</Btn>

      {/* Timeline cliquable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>
          {simTime.toFixed(1)}s
        </span>
        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, cursor: 'pointer', minWidth: 60, position: 'relative' }}
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setSimPlaying(false)
            setSimTime(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * simMaxTime)
          }}>
          <div style={{ height: '100%', width: pct + '%', background: '#2563eb', borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28 }}>/{simMaxTime}s</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
        <select value={simSpeed} onChange={e => setSimSpeed(+e.target.value)}
          style={{ padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12 }}>
          {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}×</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Durée</span>
        <input type="number" min={5} max={120} step={5} value={simMaxTime}
          onChange={e => setSimMaxTime(+e.target.value)}
          style={{ width: 52, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>s</span>
      </div>

      <Sep />

      <Btn active={showGrid} onClick={() => setShowGrid(!showGrid)}>⊞ Grille</Btn>
      <Btn active={viewMode === '3d'} onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')} title="Basculer vue 2D / 3D">
        {viewMode === '3d' ? '🗺 2D' : '🧊 3D'}
      </Btn>

      <Sep />

      {/* Sauvegarde / Chargement */}
      <Btn variant="ghost" onClick={() => saveToFile(robots, { simMaxTime, simSpeed })}
        title="Sauvegarder positions, dimensions et trajectoires">
        💾 Sauvegarder
      </Btn>

      <input type="file" accept=".json" ref={loadInputRef} style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files[0]
          if (!file) return
          loadFromFile(
            file,
            (savedRobots, meta) => loadState(savedRobots, meta),
            (msg) => alert('Erreur de chargement : ' + msg)
          )
          e.target.value = ''
        }} />
      <Btn variant="ghost" onClick={() => loadInputRef.current?.click()}
        title="Charger une sauvegarde">
        📂 Ouvrir
      </Btn>
    </div>
  )
}
