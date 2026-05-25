import React, { useRef, useState, useCallback } from 'react'
import { useSimStore, pushHistory, clearAutosave } from '../store/simStore.js'
import { useT } from '../i18n.js'

const mToMm = m => Math.round(m * 1000)
const mmToM = mm => mm / 1000

const LIN = {
  'mm/s': { toDisp: v => Math.round(v*1000),           toStore: v => v/1000,       step: 10,   stepA: 100 },
  'm/s':  { toDisp: v => Math.round(v*1000)/1000,       toStore: v => v,            step: 0.01, stepA: 0.1 },
}
const ANG = {
  '°/s':   { toDisp: v => Math.round(v*10)/10,          toStore: v => v,            step: 5,    stepA: 10  },
  'rad/s': { toDisp: v => Math.round(v*Math.PI/180*1000)/1000, toStore: v => v*180/Math.PI, step: 0.05, stepA: 0.1 },
}

// ── Composants UI ──

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</div>
}
function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom: 8, gridColumn: half ? 'span 1' : 'span 2' }}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  )
}
function NumInput({ value, min, max, step = 1, unit, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }}
        style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, minWidth: 0, color: 'var(--text)' }} />
      {unit && <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 28, flexShrink: 0, fontWeight: 500 }}>{unit}</span>}
    </div>
  )
}
function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{label}</span>}
      <button onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? 'var(--accent)' : 'var(--surface3)', transition: 'all .2s', position: 'relative',
      }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </button>
    </div>
  )
}
function ColorSwatch({ value, onChange }) {
  return (
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: 30, height: 28, borderRadius: 'var(--r)', border: '1px solid var(--border)', padding: 2, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
  )
}
function Slider({ value, min = 0, max = 1, step = 0.05, onChange, accent }) {
  return (
    <input type="range" value={value} min={min} max={max} step={step}
      onChange={e => onChange(+e.target.value)}
      style={{ width: '100%', accentColor: accent || 'var(--accent)', cursor: 'pointer' }} />
  )
}
function SegToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--surface3)', borderRadius: 'var(--r)', padding: 3 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: 'none', transition: 'all .15s',
          background: value === o.v ? 'var(--surface)' : 'transparent',
          color: value === o.v ? 'var(--accent)' : 'var(--text3)',
          boxShadow: value === o.v ? 'var(--shadow-sm)' : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  )
}
function ActionBtn({ onClick, children, color, full, style: sx }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : undefined, padding: '7px 10px',
      border: `1px solid ${color ? color + '66' : 'var(--border)'}`,
      borderRadius: 'var(--r)',
      background: color ? color + '18' : 'var(--surface2)',
      color: color || 'var(--text2)',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      transition: 'all .12s', ...sx,
    }}>{children}</button>
  )
}
function UnitPicker({ units, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--surface3)', borderRadius: 'var(--r)', padding: 3 }}>
      {units.map(u => (
        <button key={u} onClick={() => onChange(u)} style={{
          flex: 1, padding: '3px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          border: 'none', transition: 'all .15s',
          background: active === u ? 'var(--surface)' : 'transparent',
          color: active === u ? 'var(--accent)' : 'var(--text3)',
          boxShadow: active === u ? 'var(--shadow-sm)' : 'none',
        }}>{u}</button>
      ))}
    </div>
  )
}

// ── Section dépliable ──
function SubSec({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', padding: '4px 0', marginBottom: open ? 6 : 0,
        borderBottom: '1px dashed var(--border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && children}
    </div>
  )
}

// ── Card de section ──
function SectionCard({ accent, children }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r2)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent || 'var(--border)'}`,
      marginBottom: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
    }}>
      {children}
    </div>
  )
}

// ── Ligne d'obstacle ──
function ObsRow({ obs, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 3,
      background: selected ? 'var(--yellow-dim)' : 'transparent',
      border: `1px solid ${selected ? 'var(--yellow)' : 'transparent'}`,
      transition: 'all .12s',
    }}>
      <span style={{ width: 10, height: 10, borderRadius: obs.shape==='circle' ? '50%' : '2px', background: obs.color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obs.name}</span>
      <button onClick={e => { e.stopPropagation(); onRemove() }}
        style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>×</button>
    </div>
  )
}

// ── Propriétés d'un robot (corps) ──
// key={robot.id} sur le parent force le remontage quand on change de robot → reset des SubSec
function RobotProps({ robot, onUpdate, robots, obstacles, stlRef }) {
  const [linUnit, setLinUnit] = useState('mm/s')
  const [angUnit, setAngUnit] = useState('°/s')
  const norm360 = v => ((v % 360) + 360) % 360
  const ur = patch => onUpdate(robot.id, patch)

  return (
    <div style={{ padding: '8px 12px 4px' }}>
      {/* Nom (couleur déplacée dans Apparence) */}
      <div style={{ marginBottom: 12 }}>
        <Label>Nom</Label>
        <input value={robot.name} onChange={e => ur({ name: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }} />
      </div>

      {/* Dimensions — ouvert par défaut */}
      <SubSec title="Dimensions" defaultOpen={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Largeur" half>
            <NumInput value={mToMm(robot.width)} min={10} max={500} step={1} unit="mm" onChange={v => ur({ width: mmToM(v) })} />
          </Field>
          <Field label="Profondeur" half>
            <NumInput value={mToMm(robot.height)} min={10} max={500} step={1} unit="mm" onChange={v => ur({ height: mmToM(v) })} />
          </Field>
        </div>
      </SubSec>

      {/* Vitesse & Accélération — fermé */}
      <SubSec title="Vitesse & Accélération">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <UnitPicker units={Object.keys(LIN)} active={linUnit} onChange={setLinUnit} />
          <UnitPicker units={Object.keys(ANG)} active={angUnit} onChange={setAngUnit} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Vitesse" half>
            <NumInput value={LIN[linUnit].toDisp(robot.speed)} min={0} max={linUnit==='mm/s'?5000:5} step={LIN[linUnit].step} unit={linUnit} onChange={v => ur({ speed: LIN[linUnit].toStore(v) })} />
          </Field>
          <Field label="Accélération" half>
            <NumInput value={LIN[linUnit].toDisp(robot.accel??1)} min={0} max={linUnit==='mm/s'?20000:20} step={LIN[linUnit].stepA} unit={linUnit.replace('/s','/s²')} onChange={v => ur({ accel: LIN[linUnit].toStore(v) })} />
          </Field>
          <Field label="Vit. rotation" half>
            <NumInput value={ANG[angUnit].toDisp(robot.rotSpeed??90)} min={0} max={angUnit==='°/s'?1080:6} step={ANG[angUnit].step} unit={angUnit} onChange={v => ur({ rotSpeed: ANG[angUnit].toStore(v) })} />
          </Field>
          <Field label="Acc. rotation" half>
            <NumInput value={ANG[angUnit].toDisp(robot.rotAccel??360)} min={0} max={angUnit==='°/s'?7200:40} step={ANG[angUnit].stepA} unit={angUnit.replace('/s','/s²')} onChange={v => ur({ rotAccel: ANG[angUnit].toStore(v) })} />
          </Field>
        </div>
      </SubSec>

      {/* Déplacement — fermé — inclut maintenant orientation */}
      <SubSec title="Déplacement">
        <Field label="Délai de départ">
          <NumInput value={robot.startDelay} min={0} max={60} step={0.5} unit="s" onChange={v => ur({ startDelay: v })} />
        </Field>
        <Field label="Mode">
          <SegToggle value={robot.waypointMode ?? 'stop'}
            options={[{ v:'stop', label:'⏸ Stop aux pts' }, { v:'continuous', label:'→ Continu' }]}
            onChange={v => ur({ waypointMode: v })} />
        </Field>
        <Toggle value={!!robot.holonomic} onChange={v => ur({ holonomic: v })} label="Holonome (ne tourne pas)" />
        <Field label="Orientation de départ">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={0} max={359} step={1} value={norm360(robot.heading)}
              onChange={e => ur({ heading: +e.target.value })}
              style={{ flex: 1, accentColor: 'var(--purple)', minWidth: 0 }} />
            <input
              type="number" min={0} max={359} step={1}
              value={Math.round(norm360(robot.heading))}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) ur({ heading: ((v % 360) + 360) % 360 }) }}
              style={{ width: 52, padding: '4px 6px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'center', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>°</span>
          </div>
        </Field>
      </SubSec>

      {/* Collision — fermé */}
      <SubSec title="Collision">
        <Field label="Forme de collision">
          <SegToggle value={robot.collisionShape ?? 'circle'}
            options={[{ v:'circle', label:'○ Cercle' }, { v:'rect', label:'▭ Rect' }]}
            onChange={v => ur({ collisionShape: v })} />
        </Field>
        <Field label="Rayon de collision">
          <NumInput value={mToMm(robot.radius)} min={10} max={400} step={1} unit="mm" onChange={v => ur({ radius: mmToM(v) })} />
        </Field>
      </SubSec>

      {/* Apparence — fermé — inclut maintenant la couleur */}
      <SubSec title="Apparence">
        <Field label="Couleur">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ColorSwatch value={robot.color} onChange={v => ur({ color: v })} />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{robot.color}</span>
          </div>
        </Field>
        <Field label={`Transparence  ${Math.round((1-(robot.opacity??1))*100)}%`}>
          <Slider value={1-(robot.opacity??1)} min={0} max={0.95} step={0.05} onChange={v => ur({ opacity: 1-v })} accent="var(--purple)" />
        </Field>
      </SubSec>

      {/* Géométrie STL — fermé */}
      <SubSec title="Géométrie STL">
        <ActionBtn full onClick={() => stlRef.current?.click()}>
          📦 {robot.hasStl ? '✓ STL importé — changer' : 'Importer fichier STL'}
        </ActionBtn>
        {robot.hasStl && (
          <div style={{ marginTop: 10 }}>
            <Label>Rotation STL</Label>
            {[['X', robot.stlRotX??-90], ['Y', robot.stlRotY??0], ['Z', robot.stlRotZ??0]].map(([ax, val]) => (
              <div key={ax} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', width: 14, flexShrink: 0 }}>{ax}</span>
                <div style={{ flex: 1 }}>
                  <NumInput value={val} min={-360} max={360} step={15} unit="°" onChange={v => ur({ [`stlRot${ax}`]: v })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SubSec>
    </div>
  )
}

// ── Onglets ──
function ClearAutosaveBtn({ t }) {
  const holdRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  const stop = () => { clearInterval(holdRef.current); setProgress(0) }
  const onDown = () => {
    setDone(false)
    const start = Date.now()
    holdRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 3000)
      setProgress(p)
      if (p >= 1) { clearInterval(holdRef.current); clearAutosave(); setProgress(0); setDone(true) }
    }, 50)
  }

  const label = done ? t.clearTableDone : progress > 0 ? t.clearTableHolding : t.clearTable

  return (
    <div style={{ marginTop: 14 }}>
      <Label>{t.autoSave}</Label>
      <button
        onMouseDown={onDown} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={onDown} onTouchEnd={stop}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 'var(--r)',
          border: `1px solid ${done ? 'var(--green)' : 'var(--red)66'}`,
          background: done ? 'var(--green)18' : `var(--red)18`,
          color: done ? 'var(--green)' : 'var(--red)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          position: 'relative', overflow: 'hidden', userSelect: 'none',
          textAlign: 'left',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progress * 100}%`, background: 'var(--red)', opacity: 0.18,
        }} />
        <span style={{ position: 'relative' }}>{label}</span>
      </button>
      <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{t.clearTableHold}</p>
    </div>
  )
}

const TABS = [
  { id: 'robots',    icon: '🤖', label: 'Robots'    },
  { id: 'obstacles', icon: '🧱', label: 'Obstacles' },
  { id: 'scene',     icon: '🏁', label: 'Table'     },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
      {TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, padding: '10px 6px', border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            color: isActive ? 'var(--accent)' : 'var(--text3)',
            transition: 'all .12s', marginBottom: -1,
          }}>
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Panel principal ──
export default function LeftPanel() {
  const robots           = useSimStore(s => s.robots)
  const selectedRobotId  = useSimStore(s => s.selectedRobotId)
  const addRobot         = useSimStore(s => s.addRobot)
  const removeRobot      = useSimStore(s => s.removeRobot)
  const selectRobot      = useSimStore(s => s.selectRobot)
  const updateRobot      = useSimStore(s => s.updateRobot)
  const setStlData       = useSimStore(s => s.setStlData)
  const clearWaypoints   = useSimStore(s => s.clearWaypoints)
  const setBgImage       = useSimStore(s => s.setBgImage)
  const bgImage          = useSimStore(s => s.bgImage)
  const showGrid         = useSimStore(s => s.showGrid)
  const setShowGrid      = useSimStore(s => s.setShowGrid)
  const gridColor        = useSimStore(s => s.gridColor)
  const setGridColor     = useSimStore(s => s.setGridColor)
  const gridMinorStep    = useSimStore(s => s.gridMinorStep)
  const setGridMinorStep = useSimStore(s => s.setGridMinorStep)
  const gridMajorStep    = useSimStore(s => s.gridMajorStep)
  const setGridMajorStep = useSimStore(s => s.setGridMajorStep)
  const viewportColor    = useSimStore(s => s.viewportColor)
  const setViewportColor = useSimStore(s => s.setViewportColor)
  const canvasBgColor    = useSimStore(s => s.canvasBgColor)
  const setCanvasBgColor = useSimStore(s => s.setCanvasBgColor)
  const obstacles        = useSimStore(s => s.obstacles)
  const selectedObsId    = useSimStore(s => s.selectedObsId)
  const addObstacle      = useSimStore(s => s.addObstacle)
  const removeObstacle   = useSimStore(s => s.removeObstacle)
  const selectObstacle   = useSimStore(s => s.selectObstacle)
  const updateObstacle   = useSimStore(s => s.updateObstacle)

  const stlRef = useRef()
  const bgRef  = useRef()
  const [tab, setTab] = useState('robots')
  // Sections de propriétés ouvertes (indépendamment)
  const [openRobots, setOpenRobots] = useState(new Set())
  const t = useT()

  const handleSelectRobot = (id) => {
    selectRobot(id)
    // Sélection depuis la liste → replie tout sauf le sélectionné
    setOpenRobots(new Set([id]))
  }
  const toggleRobotSection = (id) => {
    setOpenRobots(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const [panelW, setPanelW] = useState(290)
  const resizing = useRef(false)
  const onResizeStart = useCallback(e => {
    resizing.current = true
    const startX = e.clientX, startW = panelW
    const onMove = ev => { if (resizing.current) setPanelW(Math.max(240, Math.min(520, startW + (ev.clientX - startX)))) }
    const onUp   = ()  => { resizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelW])

  const handleStlImport = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setStlData(selectedRobotId, ev.target.result)
    reader.readAsArrayBuffer(file); e.target.value = ''
  }
  const handleBgImport = e => {
    const file = e.target.files[0]; if (!file) return
    if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file)); e.target.value = ''
  }

  const uo = patch => updateObstacle(selectedObsId, patch)
  const selObs = obstacles.find(o => o.id === selectedObsId)

  const handleDuplicate = robot => {
    pushHistory({ robots, obstacles })
    addRobot({
      name: robot.name + ' (copie)',
      color: robot.color,
      x: Math.min(robot.x + 0.15, 2.8),
      y: Math.min(robot.y + 0.15, 1.8),
      width: robot.width, height: robot.height, radius: robot.radius,
      speed: robot.speed, accel: robot.accel,
      rotSpeed: robot.rotSpeed, rotAccel: robot.rotAccel,
      heading: robot.heading, startDelay: robot.startDelay,
      waypointMode: robot.waypointMode,
      holonomic: robot.holonomic,
      collisionShape: robot.collisionShape,
      opacity: robot.opacity,
    })
  }

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      <div style={{ width: panelW, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden' }}>

        <TabBar active={tab} onChange={setTab} />

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 10 }}>

          {/* ── Tab Robots ── */}
          {tab === 'robots' && (
            <>
              {/* Liste des robots */}
              <SectionCard accent="var(--accent)">
                <div style={{ padding: '9px 12px 4px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                    Robots
                    {robots.length > 0 && (
                      <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{robots.length}</span>
                    )}
                  </div>

                  {robots.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Ajoutez un robot pour commencer.</p>
                  )}

                  {robots.map(robot => {
                    const isSelected = robot.id === selectedRobotId
                    return (
                      <div key={robot.id} onClick={() => handleSelectRobot(robot.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
                        borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 3,
                        background: isSelected ? 'var(--accent-dim)' : 'transparent',
                        border: `1px solid ${isSelected ? 'var(--accent-mid)' : 'transparent'}`,
                        transition: 'all .12s',
                      }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: robot.color, flexShrink: 0, boxShadow: isSelected ? `0 0 7px ${robot.color}` : 'none' }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: isSelected ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {robot.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--surface3)', borderRadius: 4, padding: '2px 5px', fontWeight: 600, flexShrink: 0 }}>
                          {robot.waypoints.length}pt
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); pushHistory({ robots, obstacles }); removeRobot(robot.id) }}
                          style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                        >×</button>
                      </div>
                    )
                  })}

                  <button onClick={() => { addRobot(); }} style={{
                    width: '100%', marginTop: 4, marginBottom: 4, padding: '7px 10px', borderRadius: 'var(--r)',
                    border: '1.5px dashed var(--accent-mid)', background: 'var(--accent-dim)',
                    color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>+ Ajouter un robot</button>
                </div>
              </SectionCard>

              {/* Propriétés par robot — accordéon indépendant */}
              <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display: 'none' }} />
              {robots.map(robot => {
                const isOpen = openRobots.has(robot.id)
                const isSelected = robot.id === selectedRobotId
                return (
                  <SectionCard key={robot.id} accent={isSelected ? robot.color : 'var(--border)'}>
                    {/* En-tête cliquable pour déplier/replier */}
                    <div
                      onClick={() => toggleRobotSection(robot.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                        cursor: 'pointer',
                        background: isOpen ? 'var(--surface2)' : 'transparent',
                        transition: 'background .12s',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: robot.color, flexShrink: 0, boxShadow: isOpen ? `0 0 8px ${robot.color}80` : 'none' }} />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: isOpen ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {robot.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                        {isOpen ? '▼' : '▶'}
                      </span>
                    </div>

                    {/* Contenu déplié — key force le remontage au changement de robot */}
                    {isOpen && (
                      <div key={robot.id}>
                        <div style={{ height: 1, background: 'var(--border)' }} />
                        <RobotProps robot={robot} onUpdate={updateRobot} robots={robots} obstacles={obstacles} stlRef={stlRef} />
                        <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px' }}>
                          <ActionBtn color="var(--red)" style={{ flex: 1 }}
                            onClick={() => { pushHistory({ robots, obstacles }); clearWaypoints(robot.id) }}>
                            🗑 Trajectoire
                          </ActionBtn>
                          <ActionBtn color="var(--purple)" style={{ flex: 1 }}
                            onClick={() => handleDuplicate(robot)}>
                            ⧉ Dupliquer
                          </ActionBtn>
                        </div>
                      </div>
                    )}
                  </SectionCard>
                )
              })}
            </>
          )}

          {/* ── Tab Obstacles ── */}
          {tab === 'obstacles' && (
            <>
              <SectionCard accent="var(--yellow)">
                <div style={{ padding: '9px 12px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                      Obstacles
                      {obstacles.length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--yellow)', color: '#000', borderRadius: 10, padding: '1px 6px', marginLeft: 6 }}>{obstacles.length}</span>
                      )}
                    </span>
                  </div>
                  {obstacles.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Ajoutez des obstacles statiques.</p>}
                  {obstacles.map(o => (
                    <ObsRow key={o.id} obs={o} selected={o.id === selectedObsId}
                      onSelect={() => selectObstacle(o.id)} onRemove={() => removeObstacle(o.id)} />
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, paddingBottom: 4 }}>
                    <button onClick={() => addObstacle({ shape:'rect', collisionShape:'rect' })} style={{ padding: '7px 0', borderRadius: 'var(--r)', border: '1.5px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Rectangle</button>
                    <button onClick={() => addObstacle({ shape:'circle', collisionShape:'circle' })} style={{ padding: '7px 0', borderRadius: 'var(--r)', border: '1.5px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Cercle</button>
                  </div>
                </div>
              </SectionCard>

              {selObs && (
                <SectionCard accent="var(--yellow)">
                  <div style={{ padding: '9px 12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <ColorSwatch value={selObs.color} onChange={v => uo({ color: v })} />
                      <input value={selObs.name} onChange={e => uo({ name: e.target.value })}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, minWidth: 0, color: 'var(--text)' }} />
                    </div>
                    <Field label="Forme visuelle">
                      <SegToggle value={selObs.shape}
                        options={[{ v:'rect', label:'▭ Rectangle' }, { v:'circle', label:'○ Cercle' }]}
                        onChange={v => uo({ shape: v })} />
                    </Field>
                    <Field label="Forme de collision">
                      <SegToggle value={selObs.collisionShape ?? 'rect'}
                        options={[{ v:'rect', label:'▭ Rect' }, { v:'circle', label:'○ Cercle' }]}
                        onChange={v => uo({ collisionShape: v })} />
                    </Field>
                    {selObs.shape === 'rect' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Field label="Largeur" half>
                          <NumInput value={mToMm(selObs.width)} min={10} max={2000} step={1} unit="mm" onChange={v => uo({ width: mmToM(v), radius: mmToM(v)/2/1000 })} />
                        </Field>
                        <Field label="Profondeur" half>
                          <NumInput value={mToMm(selObs.height)} min={10} max={2000} step={1} unit="mm" onChange={v => uo({ height: mmToM(v) })} />
                        </Field>
                      </div>
                    ) : (
                      <Field label="Rayon">
                        <NumInput value={mToMm(selObs.radius)} min={10} max={1000} step={1} unit="mm" onChange={v => uo({ radius: mmToM(v), width: mmToM(v)*2, height: mmToM(v)*2 })} />
                      </Field>
                    )}
                    <Field label={`Transparence  ${Math.round((1-(selObs.opacity??1))*100)}%`}>
                      <Slider value={1-(selObs.opacity??1)} min={0} max={0.95} step={0.05} onChange={v => uo({ opacity: 1-v })} accent="var(--yellow)" />
                    </Field>
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ── Tab Scène ── */}
          {tab === 'scene' && (
            <SectionCard accent="var(--green)">
              <div style={{ padding: '9px 12px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
                  Table & Grille
                </div>
                <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display: 'none' }} />
                <ActionBtn full onClick={() => bgRef.current?.click()} style={{ marginBottom: 6 }}>
                  🖼 {bgImage ? "Changer l'image de fond" : 'Ajouter image de fond'}
                </ActionBtn>
                {bgImage && (
                  <ActionBtn full color="var(--red)" style={{ marginBottom: 10 }}
                    onClick={() => { if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage); setBgImage(null) }}>
                    Supprimer l'image
                  </ActionBtn>
                )}
                <Field label="Surface de la table">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ColorSwatch value={viewportColor || '#2d6e3e'} onChange={setViewportColor} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{viewportColor || '#2d6e3e'}</span>
                  </div>
                </Field>
                <Field label="Arrière-plan (hors table)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ColorSwatch value={canvasBgColor || '#2e4a76'} onChange={setCanvasBgColor} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{canvasBgColor || '#2e4a76'}</span>
                  </div>
                </Field>
                <Toggle value={showGrid} onChange={setShowGrid} label="Afficher la grille" />
                <Field label="Couleur de la grille">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ColorSwatch value={gridColor} onChange={setGridColor} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{gridColor}</span>
                  </div>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Petite grille" half>
                    <NumInput value={gridMinorStep} min={0} max={100} step={5} unit="cm" onChange={setGridMinorStep} />
                  </Field>
                  <Field label="Grande grille" half>
                    <NumInput value={gridMajorStep} min={0} max={200} step={10} unit="cm" onChange={setGridMajorStep} />
                  </Field>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>300×200cm • Ctrl+drag = snap 15°</p>
                <ClearAutosaveBtn t={t} />
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Poignée de redimensionnement */}
      <div
        onMouseDown={onResizeStart}
        style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, transition: 'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
      />
    </div>
  )
}
