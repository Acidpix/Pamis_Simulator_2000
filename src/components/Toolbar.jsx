import React, { useEffect, useRef } from 'react'
import { useSimStore, detectCollisions } from '../store/simStore.js'

function ToolBtn({ active, onClick, children, color, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px 14px',
        background: active ? (color ? color + '22' : 'var(--accent-glow)') : 'var(--bg-card)',
        border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
        borderRadius: 4,
        color: active ? (color || 'var(--accent)') : 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all .15s',
        letterSpacing: '.03em',
        boxShadow: active ? `0 0 8px ${(color || '#00c8ff')}44` : 'none',
      }}
      onMouseEnter={e => !active && (e.currentTarget.style.borderColor = 'var(--border-bright)')}
      onMouseLeave={e => !active && (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />
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
  const showLabels = useSimStore(s => s.showLabels)
  const setShowLabels = useSimStore(s => s.setShowLabels)
  const robots = useSimStore(s => s.robots)
  const setCollisions = useSimStore(s => s.setCollisions)

  const rafRef = useRef(null)
  const lastRef = useRef(null)

  // Boucle de simulation
  useEffect(() => {
    if (simPlaying) {
      lastRef.current = null
      const tick = (ts) => {
        if (lastRef.current !== null) {
          const dt = (ts - lastRef.current) / 1000 * simSpeed
          const next = simTime + dt
          if (next >= simMaxTime) {
            setSimTime(simMaxTime)
            setSimPlaying(false)
            return
          }
          setSimTime(next)
        }
        lastRef.current = ts
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [simPlaying, simSpeed, simMaxTime])

  // Recalcul des collisions à chaque changement de trajectoires
  useEffect(() => {
    if (robots.length < 2) { setCollisions([]); return }
    const cols = detectCollisions(robots, simMaxTime, 0.05)
    setCollisions(cols)
  }, [robots, simMaxTime])

  const handlePlayPause = () => {
    if (simTime >= simMaxTime) setSimTime(0)
    setSimPlaying(!simPlaying)
  }

  const handleReset = () => {
    setSimPlaying(false)
    setSimTime(0)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        color: 'var(--accent)',
        letterSpacing: '.15em',
        marginRight: 8,
        textShadow: '0 0 12px rgba(0,200,255,0.6)',
        flexShrink: 0,
      }}>
        ⬡ KRABI
      </div>

      <Divider />

      {/* Modes */}
      <ToolBtn active={mode === 'draw'} onClick={() => setMode('draw')} title="Tracer des waypoints">
        ✎ Tracer
      </ToolBtn>
      <ToolBtn active={mode === 'move'} onClick={() => setMode('move')} title="Déplacer les robots">
        ✥ Déplacer
      </ToolBtn>

      <Divider />

      {/* Simulation */}
      <ToolBtn active={simPlaying} onClick={handlePlayPause} color="#0aff9d" title={simPlaying ? 'Pause' : 'Lancer la simulation'}>
        {simPlaying ? '⏸ Pause' : '▶ Simuler'}
      </ToolBtn>
      <ToolBtn active={false} onClick={handleReset} title="Remettre à zéro">
        ⏮ Reset
      </ToolBtn>

      {/* Slider temps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', minWidth: 38 }}>
          {simTime.toFixed(1)}s
        </span>
        <input
          type="range"
          min={0} max={simMaxTime} step={0.05}
          value={simTime}
          onChange={e => { setSimPlaying(false); setSimTime(+e.target.value) }}
          style={{
            width: 160,
            accentColor: 'var(--accent)',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          /{simMaxTime}s
        </span>
      </div>

      {/* Vitesse */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>×</span>
        <select
          value={simSpeed}
          onChange={e => setSimSpeed(+e.target.value)}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '3px 5px',
          }}
        >
          {[0.25, 0.5, 1, 2, 4].map(v => (
            <option key={v} value={v}>{v}×</option>
          ))}
        </select>
      </div>

      {/* Durée max */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>max</span>
        <input
          type="number"
          min={5} max={120} step={5}
          value={simMaxTime}
          onChange={e => setSimMaxTime(+e.target.value)}
          style={{
            width: 52, padding: '3px 5px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>s</span>
      </div>

      <Divider />

      {/* Options affichage */}
      <ToolBtn active={showGrid} onClick={() => setShowGrid(!showGrid)} title="Afficher/masquer la grille">
        ⊞ Grille
      </ToolBtn>
    </div>
  )
}
