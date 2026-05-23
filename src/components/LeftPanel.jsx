import React, { useRef } from 'react'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useSimStore } from '../store/simStore.js'

const ICONS = {
  robot: '⬡',
  plus:  '+',
  trash: '✕',
  stl:   '◈',
  svg:   '◇',
  upload:'↑',
  eye:   '◉',
}

function ColorDot({ color, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 6px ${color}`,
      flexShrink: 0,
    }} />
  )
}

function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        borderRadius: 4,
        border: `1px solid ${selected ? robot.color + '80' : 'transparent'}`,
        background: selected ? robot.color + '14' : 'transparent',
        cursor: 'pointer',
        transition: 'all .15s',
        marginBottom: 2,
      }}
    >
      <ColorDot color={robot.color} />
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
        {robot.name}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {robot.waypoints.length}wp
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, padding: '0 4px' }}
        title="Supprimer"
      >✕</button>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 9,
      letterSpacing: '.15em',
      color: 'var(--accent)',
      textTransform: 'uppercase',
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function NumberInput({ label, value, min, max, step, unit, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11, width: 80, flexShrink: 0 }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: 60,
          padding: '3px 6px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textAlign: 'right',
        }}
      />
      {unit && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{unit}</span>}
    </div>
  )
}

export default function LeftPanel() {
  const robots = useSimStore(s => s.robots)
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const addRobot = useSimStore(s => s.addRobot)
  const removeRobot = useSimStore(s => s.removeRobot)
  const selectRobot = useSimStore(s => s.selectRobot)
  const updateRobot = useSimStore(s => s.updateRobot)
  const setStlData = useSimStore(s => s.setStlData)
  const setSvgData = useSimStore(s => s.setSvgData)
  const clearWaypoints = useSimStore(s => s.clearWaypoints)
  const setBgImage = useSimStore(s => s.setBgImage)

  const stlRef = useRef()
  const svgRef = useRef()
  const bgRef = useRef()

  const selected = robots.find(r => r.id === selectedRobotId)

  const handleStlImport = (e) => {
    const file = e.target.files[0]
    if (!file || !selected) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setStlData(selected.id, ev.target.result)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleSvgImport = (e) => {
    const file = e.target.files[0]
    if (!file || !selected) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setSvgData(selected.id, ev.target.result)
    }
    reader.readAsText(file)
  }

  const handleBgImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setBgImage(url)
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '12px 14px',
    marginBottom: 10,
  }

  const importBtnStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 10px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    marginBottom: 5,
    width: '100%',
    transition: 'all .15s',
  }

  return (
    <div style={{
      width: 220,
      height: '100%',
      overflowY: 'auto',
      padding: '12px 10px',
      borderRight: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--accent)', letterSpacing: '.1em', textShadow: '0 0 12px rgba(0,200,255,0.5)' }}>
          KRABI SIM
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
          TABLE 3.0m × 2.0m
        </div>
      </div>

      {/* Robots */}
      <div style={cardStyle}>
        <SectionTitle>Robots</SectionTitle>
        {robots.map(r => (
          <RobotRow
            key={r.id}
            robot={r}
            selected={r.id === selectedRobotId}
            onSelect={() => selectRobot(r.id)}
            onRemove={() => removeRobot(r.id)}
          />
        ))}
        <button
          onClick={() => addRobot()}
          style={{
            width: '100%', marginTop: 6,
            padding: '5px 0',
            background: 'var(--accent-glow)',
            border: '1px dashed var(--border-bright)',
            borderRadius: 4,
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(0,200,255,0.2)'}
          onMouseLeave={e => e.target.style.background = 'var(--accent-glow)'}
        >
          + Ajouter robot
        </button>
      </div>

      {/* Propriétés robot sélectionné */}
      {selected && (
        <div style={cardStyle}>
          <SectionTitle style={{ color: selected.color }}>
            <span style={{ color: selected.color }}>{selected.name}</span>
          </SectionTitle>

          {/* Nom */}
          <div style={{ marginBottom: 8 }}>
            <input
              value={selected.name}
              onChange={e => updateRobot(selected.id, { name: e.target.value })}
              style={{
                width: '100%', padding: '4px 8px',
                background: 'var(--bg-base)',
                border: `1px solid ${selected.color}44`,
                borderRadius: 3,
                color: selected.color,
                fontFamily: 'var(--font-display)',
                fontSize: 11,
              }}
            />
          </div>

          <NumberInput label="Délai départ" value={selected.startDelay} min={0} max={60} step={0.5} unit="s"
            onChange={v => updateRobot(selected.id, { startDelay: v })} />
          <NumberInput label="Vitesse" value={selected.speed} min={0.05} max={2.0} step={0.05} unit="m/s"
            onChange={v => updateRobot(selected.id, { speed: v })} />
          <NumberInput label="Largeur" value={selected.width} min={0.05} max={0.5} step={0.01} unit="m"
            onChange={v => updateRobot(selected.id, { width: v })} />
          <NumberInput label="Hauteur" value={selected.height} min={0.05} max={0.5} step={0.01} unit="m"
            onChange={v => updateRobot(selected.id, { height: v })} />
          <NumberInput label="R. collision" value={selected.radius} min={0.05} max={0.4} step={0.01} unit="m"
            onChange={v => updateRobot(selected.id, { radius: v })} />

          {/* Import géométrie */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Import géométrie</div>
            <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display: 'none' }} />
            <button style={importBtnStyle} onClick={() => stlRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <span>◈</span> Importer STL
              {selected.shapeType === 'stl' && <span style={{ marginLeft: 'auto', color: 'var(--accent2)', fontSize: 10 }}>✓</span>}
            </button>
            <input type="file" ref={svgRef} accept=".svg" onChange={handleSvgImport} style={{ display: 'none' }} />
            <button style={importBtnStyle} onClick={() => svgRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <span>◇</span> Importer SVG
              {selected.shapeType === 'svg' && <span style={{ marginLeft: 'auto', color: 'var(--accent2)', fontSize: 10 }}>✓</span>}
            </button>
          </div>

          {/* Effacer trajectoire */}
          <button
            onClick={() => clearWaypoints(selected.id)}
            style={{
              width: '100%', marginTop: 8,
              padding: '4px 0',
              background: 'var(--danger-dim)',
              border: '1px solid rgba(255,61,90,0.3)',
              borderRadius: 4,
              color: 'var(--danger)',
              fontSize: 11,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            ✕ Effacer trajectoire
          </button>
        </div>
      )}

      {/* Image de fond table */}
      <div style={cardStyle}>
        <SectionTitle>Table</SectionTitle>
        <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display: 'none' }} />
        <button style={importBtnStyle} onClick={() => bgRef.current?.click()}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          ↑ Image de fond (thème)
        </button>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          Farming World 2026 — 3m × 2m
        </div>
      </div>
    </div>
  )
}
