import React, { useRef } from 'react'
import { useSimStore } from '../store/simStore.js'

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>{children}</div>
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumInput({ value, min, max, step, unit, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1, padding: '5px 8px', borderRadius: 'var(--r)',
          border: '1.5px solid var(--border)', background: 'var(--surface2)',
          fontSize: 13, color: 'var(--text)',
        }} />
      {unit && <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 24 }}>{unit}</span>}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r2)', padding: 14, marginBottom: 10,
      boxShadow: 'var(--shadow)',
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{children}</div>
}

function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
      borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 2,
      background: selected ? 'var(--blue-dim)' : 'transparent',
      border: `1.5px solid ${selected ? 'var(--blue-mid)' : 'transparent'}`,
      transition: 'all .1s',
    }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: robot.color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ flex: 1, fontWeight: 500, fontSize: 13, color: selected ? 'var(--blue)' : 'var(--text)' }}>
        {robot.name}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{robot.waypoints.length} pt</span>
      <button onClick={e => { e.stopPropagation(); onRemove() }}
        style={{
          width: 20, height: 20, borderRadius: 4, border: 'none',
          background: 'transparent', color: 'var(--text3)', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Supprimer"
      >×</button>
    </div>
  )
}

function FlatBtn({ onClick, children, danger, full, style: extra }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : undefined,
      padding: '7px 12px',
      border: `1.5px solid ${danger ? '#fca5a5' : 'var(--border)'}`,
      borderRadius: 'var(--r)', background: danger ? 'var(--red-dim)' : 'var(--surface2)',
      color: danger ? 'var(--red)' : 'var(--text2)',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      ...extra,
    }}>
      {children}
    </button>
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
  const clearWaypoints = useSimStore(s => s.clearWaypoints)
  const setBgImage = useSimStore(s => s.setBgImage)
  const bgImage = useSimStore(s => s.bgImage)

  const stlRef = useRef()
  const bgRef = useRef()
  const selected = robots.find(r => r.id === selectedRobotId)

  const handleStlImport = (e) => {
    const file = e.target.files[0]
    if (!file || !selected) return
    const reader = new FileReader()
    reader.onload = ev => setStlData(selected.id, ev.target.result)
    reader.readAsArrayBuffer(file)
  }

  const handleBgImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (bgImage) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file))
    e.target.value = ''
  }

  return (
    <div style={{
      width: 236, height: '100%', overflowY: 'auto', flexShrink: 0,
      padding: 12, borderRight: '1px solid var(--border)', background: 'var(--bg)',
    }}>
      {/* Robots */}
      <Card>
        <CardTitle>Robots</CardTitle>
        {robots.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            Ajoutez un robot pour commencer.
          </p>
        )}
        {robots.map(r => (
          <RobotRow key={r.id} robot={r} selected={r.id === selectedRobotId}
            onSelect={() => selectRobot(r.id)} onRemove={() => removeRobot(r.id)} />
        ))}
        <button onClick={() => addRobot()} style={{
          width: '100%', marginTop: 8, padding: '7px', borderRadius: 'var(--r)',
          border: '1.5px dashed var(--border2)', background: 'transparent',
          color: 'var(--blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          + Ajouter un robot
        </button>
      </Card>

      {/* Propriétés robot */}
      {selected && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: selected.color, display: 'inline-block', flexShrink: 0 }} />
            <CardTitle style={{ margin: 0 }}>{selected.name}</CardTitle>
          </div>

          <Field label="Nom">
            <input value={selected.name} onChange={e => updateRobot(selected.id, { name: e.target.value })}
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 'var(--r)',
                border: '1.5px solid var(--border)', background: 'var(--surface2)',
                fontSize: 13, color: 'var(--text)',
              }} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Délai départ">
              <NumInput value={selected.startDelay} min={0} max={60} step={0.5} unit="s"
                onChange={v => updateRobot(selected.id, { startDelay: v })} />
            </Field>
            <Field label="Vitesse">
              <NumInput value={selected.speed} min={0.05} max={2.0} step={0.05} unit="m/s"
                onChange={v => updateRobot(selected.id, { speed: v })} />
            </Field>
            <Field label="Largeur">
              <NumInput value={selected.width} min={0.05} max={0.5} step={0.01} unit="m"
                onChange={v => updateRobot(selected.id, { width: v })} />
            </Field>
            <Field label="Profondeur">
              <NumInput value={selected.height} min={0.05} max={0.5} step={0.01} unit="m"
                onChange={v => updateRobot(selected.id, { height: v })} />
            </Field>
          </div>

          <Field label="Rayon de collision">
            <NumInput value={selected.radius} min={0.05} max={0.4} step={0.01} unit="m"
              onChange={v => updateRobot(selected.id, { radius: v })} />
          </Field>

          <div style={{ marginBottom: 8 }}>
            <Label>Géométrie</Label>
            <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display: 'none' }} />
            <FlatBtn full onClick={() => stlRef.current?.click()}>
              📦 Importer STL {selected.shapeType === 'stl' ? '✓' : ''}
            </FlatBtn>
          </div>

          <FlatBtn full danger onClick={() => clearWaypoints(selected.id)}>
            🗑 Effacer la trajectoire
          </FlatBtn>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardTitle>Table de jeu</CardTitle>
        <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display: 'none' }} />
        <FlatBtn full onClick={() => bgRef.current?.click()}>
          🖼 {bgImage ? 'Changer l\'image de fond' : 'Ajouter une image de fond'}
        </FlatBtn>
        {bgImage && (
          <FlatBtn full danger style={{ marginTop: 6 }} onClick={() => { URL.revokeObjectURL(bgImage); setBgImage(null) }}>
            Supprimer l'image
          </FlatBtn>
        )}
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Table 3m × 2m • Scroll pour zoomer</p>
      </Card>
    </div>
  )
}
