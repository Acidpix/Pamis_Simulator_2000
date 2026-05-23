import React, { useEffect, useRef } from 'react'
import { useSimStore, detectCollisions } from '../store/simStore.js'

function Btn({ active, onClick, children, variant = 'default', title }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 'var(--r)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: '1.5px solid transparent', transition: 'all .12s',
    whiteSpace: 'nowrap',
  }
  const styles = {
    default: {
      ...base,
      background: active ? '#2563eb' : 'var(--surface)',
      border: `1.5px solid ${active ? '#2563eb' : 'var(--border)'}`,
      color: active ? '#fff' : 'var(--text2)',
      boxShadow: active ? '0 2px 8px rgba(37,99,235,.3)' : 'var(--shadow)',
    },
    green: {
      ...base,
      background: active ? '#16a34a' : 'var(--surface)',
      border: `1.5px solid ${active ? '#16a34a' : 'var(--border)'}`,
      color: active ? '#fff' : 'var(--text2)',
      boxShadow: active ? '0 2px 8px rgba(22,163,74,.3)' : 'var(--shadow)',
    },
    ghost: {
      ...base,
      background: 'transparent',
      border: '1.5px solid var(--border)',
      color: 'var(--text2)',
      boxShadow: 'none',
    },
  }
  return <button style={styles[variant] || styles.default} onClick={onClick} title={title}>{children}</button>
}

function Sep() {
  return <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
}

export default function Toolbar() {
  const mode = useSimStore(s => s.mode)
  const setMode = useSimStore(s => s.setMode)
  const simPlaying = useSimStore(s => s.simPlaying)
  const setSimPlaying = useSimStore(s => s.setSimPlaying)
  const simTime = useSimStore(s => s.simTime)
  const setSimTime = useSimStore(s => s.setSimTime)
  const simMaxTime = useSimStore(s => s.simMaxTime)
  const setSimMaxTime = useSimStore(s => s.setSimMaxTime)
  const simSpeed = useSimStore(s => s.simSpeed)
  const setSimSpeed = useSimStore(s => s.setSimSpeed)
  const showGrid = useSimStore(s => s.showGrid)
  const setShowGrid = useSimStore(s => s.setShowGrid)
  const robots = useSimStore(s => s.robots)
  const setCollisions = useSimStore(s => s.setCollisions)

  const rafRef = useRef(null)
  const lastRef = useRef(null)
  // Refs to avoid stale closures in the animation loop
  const simTimeRef = useRef(simTime)
  const simSpeedRef = useRef(simSpeed)
  const simMaxTimeRef = useRef(simMaxTime)
  const simPlayingRef = useRef(simPlaying)

  useEffect(() => { simTimeRef.current = simTime }, [simTime])
  useEffect(() => { simSpeedRef.current = simSpeed }, [simSpeed])
  useEffect(() => { simMaxTimeRef.current = simMaxTime }, [simMaxTime])
  useEffect(() => { simPlayingRef.current = simPlaying }, [simPlaying])

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
    const cols = detectCollisions(robots, simMaxTime, 0.05)
    setCollisions(cols)
  }, [robots, simMaxTime])

  const handlePlayPause = () => {
    if (simTime >= simMaxTime) setSimTime(0)
    setSimPlaying(!simPlaying)
  }

  const pct = simMaxTime > 0 ? (simTime / simMaxTime) * 100 : 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0, flexWrap: 'wrap',
      boxShadow: '0 1px 0 var(--border)',
    }}>
      {/* Logo */}
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)', letterSpacing: '-.2px', marginRight: 4, flexShrink: 0 }}>
        PAMIS 2000
      </span>

      <Sep />

      {/* Modes */}
      <Btn active={mode === 'draw'} onClick={() => setMode('draw')} title="Cliquer sur la table pour ajouter des waypoints">
        ✏️ Tracer
      </Btn>
      <Btn active={mode === 'move'} onClick={() => setMode('move')} title="Glisser-déposer les robots">
        ✋ Déplacer
      </Btn>

      <Sep />

      {/* Simulation */}
      <Btn variant="green" active={simPlaying} onClick={handlePlayPause} title={simPlaying ? 'Pause' : 'Lancer la simulation'}>
        {simPlaying ? '⏸ Pause' : '▶ Simuler'}
      </Btn>
      <Btn variant="ghost" onClick={() => { setSimPlaying(false); setSimTime(0) }} title="Revenir au début">
        ⏮ Reset
      </Btn>

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', minWidth: 40, fontVariantNumeric: 'tabular-nums' }}>
          {simTime.toFixed(1)}s
        </span>
        <div style={{ flex: 1, position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, cursor: 'pointer', minWidth: 80 }}
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
            setSimPlaying(false)
            setSimTime(p * simMaxTime)
          }}
        >
          <div style={{ height: '100%', width: pct + '%', background: 'var(--blue)', borderRadius: 3, transition: 'width .05s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 28 }}>/{simMaxTime}s</span>
      </div>

      {/* Vitesse */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Vitesse</span>
        <select value={simSpeed} onChange={e => setSimSpeed(+e.target.value)}
          style={{ padding: '4px 6px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: 'var(--text)' }}>
          {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}×</option>)}
        </select>
      </div>

      <Sep />

      {/* Durée max */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Durée max</span>
        <input type="number" min={5} max={120} step={5} value={simMaxTime}
          onChange={e => setSimMaxTime(+e.target.value)}
          style={{ width: 56, padding: '4px 6px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: 'var(--text)' }} />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
      </div>

      <Sep />

      <Btn active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Afficher / masquer la grille">
        ⊞ Grille
      </Btn>
    </div>
  )
}
