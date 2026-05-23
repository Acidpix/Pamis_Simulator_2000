import React, { useRef } from 'react'
import { useSimStore } from '../store/simStore.js'

// Helpers cm <-> m
const mToCm = (m) => Math.round(m * 100)
const cmToM = (cm) => cm / 100

function Label({ children }) {
  return <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 3 }}>{children}</div>
}

function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom: 10, gridColumn: half ? 'span 1' : 'span 2' }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumInput({ value, min, max, step, unit, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1, padding: '5px 8px', borderRadius: 6,
          border: '1.5px solid #e2e8f0', background: '#f8f9fb',
          fontSize: 13, color: '#1e293b',
        }} />
      {unit && <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 22 }}>{unit}</span>}
    </div>
  )
}

// Boutons d'orientation : 4 directions
function HeadingPicker({ value, onChange }) {
  const dirs = [
    { label: '→', deg: 0,    title: 'Droite (0°)' },
    { label: '↑', deg: 90,   title: 'Haut (90°)' },
    { label: '←', deg: 180,  title: 'Gauche (180°)' },
    { label: '↓', deg: 270,  title: 'Bas (270°)' },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
        {dirs.map(d => (
          <button key={d.deg} title={d.title} onClick={() => onChange(d.deg)}
            style={{
              padding: '5px 0', borderRadius: 6, fontSize: 16,
              border: `1.5px solid ${Math.abs((value % 360 + 360) % 360 - d.deg) < 1 ? '#2563eb' : '#e2e8f0'}`,
              background: Math.abs((value % 360 + 360) % 360 - d.deg) < 1 ? '#eff6ff' : '#f8f9fb',
              color: Math.abs((value % 360 + 360) % 360 - d.deg) < 1 ? '#2563eb' : '#475569',
              cursor: 'pointer',
            }}>
            {d.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" value={Math.round(value)} min={-360} max={360} step={5}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#f8f9fb', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>°</span>
      </div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 10, padding: 14, marginBottom: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{children}</div>
}

function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
      borderRadius: 8, cursor: 'pointer', marginBottom: 2,
      background: selected ? '#eff6ff' : 'transparent',
      border: `1.5px solid ${selected ? '#bfdbfe' : 'transparent'}`,
    }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: robot.color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 500, fontSize: 13, color: selected ? '#1d4ed8' : '#1e293b' }}>{robot.name}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{robot.waypoints.length} pt</span>
      <button onClick={e => { e.stopPropagation(); onRemove() }}
        style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ×
      </button>
    </div>
  )
}

function FlatBtn({ onClick, children, danger, full, style: sx }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : undefined,
      padding: '7px 12px',
      border: `1.5px solid ${danger ? '#fca5a5' : '#e2e8f0'}`,
      borderRadius: 8,
      background: danger ? '#fef2f2' : '#f8f9fb',
      color: danger ? '#dc2626' : '#475569',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      ...sx,
    }}>
      {children}
    </button>
  )
}

export default function LeftPanel() {
  const robots          = useSimStore(s => s.robots)
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const addRobot        = useSimStore(s => s.addRobot)
  const removeRobot     = useSimStore(s => s.removeRobot)
  const selectRobot     = useSimStore(s => s.selectRobot)
  const updateRobot     = useSimStore(s => s.updateRobot)
  const setStlData      = useSimStore(s => s.setStlData)
  const clearWaypoints  = useSimStore(s => s.clearWaypoints)
  const setBgImage      = useSimStore(s => s.setBgImage)
  const bgImage         = useSimStore(s => s.bgImage)

  const stlRef = useRef()
  const bgRef  = useRef()
  const selected = robots.find(r => r.id === selectedRobotId)

  const handleStlImport = (e) => {
    const file = e.target.files[0]
    if (!file || !selected) return
    const reader = new FileReader()
    reader.onload = ev => setStlData(selected.id, ev.target.result)
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleBgImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file))
    e.target.value = ''
  }

  return (
    <div style={{
      width: 246, height: '100%', overflowY: 'auto', flexShrink: 0,
      padding: 12, borderRight: '1px solid #e2e8f0', background: '#f0f2f5',
    }}>
      {/* Robots */}
      <Card>
        <CardTitle>Robots</CardTitle>
        {robots.length === 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            Ajoutez un robot pour commencer.
          </p>
        )}
        {robots.map(r => (
          <RobotRow key={r.id} robot={r} selected={r.id === selectedRobotId}
            onSelect={() => selectRobot(r.id)} onRemove={() => removeRobot(r.id)} />
        ))}
        <button onClick={() => addRobot()} style={{
          width: '100%', marginTop: 8, padding: 8, borderRadius: 8,
          border: '1.5px dashed #cbd5e1', background: 'transparent',
          color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          + Ajouter un robot
        </button>
      </Card>

      {/* Propriétés robot sélectionné */}
      {selected && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: selected.color, flexShrink: 0, display: 'inline-block' }} />
            <input value={selected.name} onChange={e => updateRobot(selected.id, { name: e.target.value })}
              style={{
                flex: 1, padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e2e8f0',
                background: '#f8f9fb', fontSize: 13, fontWeight: 600, color: '#1e293b',
              }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Délai départ" half>
              <NumInput value={selected.startDelay} min={0} max={60} step={0.5} unit="s"
                onChange={v => updateRobot(selected.id, { startDelay: v })} />
            </Field>
            <Field label="Vitesse" half>
              <NumInput value={Math.round(selected.speed * 100)} min={5} max={200} step={5} unit="cm/s"
                onChange={v => updateRobot(selected.id, { speed: cmToM(v) })} />
            </Field>
            <Field label="Largeur" half>
              <NumInput value={mToCm(selected.width)} min={5} max={50} step={1} unit="cm"
                onChange={v => updateRobot(selected.id, { width: cmToM(v) })} />
            </Field>
            <Field label="Profondeur" half>
              <NumInput value={mToCm(selected.height)} min={5} max={50} step={1} unit="cm"
                onChange={v => updateRobot(selected.id, { height: cmToM(v) })} />
            </Field>
          </div>

          <Field label="Rayon collision">
            <NumInput value={mToCm(selected.radius)} min={5} max={40} step={1} unit="cm"
              onChange={v => updateRobot(selected.id, { radius: cmToM(v) })} />
          </Field>

          <Field label="Orientation de départ">
            <HeadingPicker value={selected.heading}
              onChange={v => updateRobot(selected.id, { heading: v })} />
          </Field>

          <div style={{ marginBottom: 8 }}>
            <Label>Géométrie 3D</Label>
            <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display: 'none' }} />
            <FlatBtn full onClick={() => stlRef.current?.click()}>
              📦 {selected.hasStl ? '✓ STL importé — changer' : 'Importer fichier STL'}
            </FlatBtn>
          </div>

          <FlatBtn full danger onClick={() => clearWaypoints(selected.id)}>
            🗑 Effacer la trajectoire
          </FlatBtn>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardTitle>Table de jeu — 300 × 200 cm</CardTitle>
        <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display: 'none' }} />
        <FlatBtn full onClick={() => bgRef.current?.click()}>
          🖼 {bgImage ? "Changer l'image de fond" : 'Ajouter une image de fond'}
        </FlatBtn>
        {bgImage && (
          <FlatBtn full danger style={{ marginTop: 6 }}
            onClick={() => { if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage); setBgImage(null) }}>
            Supprimer l'image
          </FlatBtn>
        )}
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Scroll pour zoomer • Mode 3D : clic-droit pour tourner</p>
      </Card>
    </div>
  )
}
