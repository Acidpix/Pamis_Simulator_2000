import React, { useRef, useState, useCallback } from 'react'
import { useSimStore, pushHistory } from '../store/simStore.js'
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

function SectionCard({ accent, children, style }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r2)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent || 'var(--border)'}`,
      marginBottom: 8, overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHead({ title, open, onToggle, badge, accent }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 12px', cursor: 'pointer',
      background: open ? 'var(--surface2)' : 'transparent',
      transition: 'background .12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent || 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          {title}
        </span>
        {badge != null && (
          <span style={{
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            background: accent || 'var(--surface3)',
            color: accent ? '#fff' : 'var(--text2)',
            borderRadius: 10, padding: '2px 6px',
            opacity: accent ? 0.85 : 1,
          }}>
            {badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
    </div>
  )
}

function Sec({ title, children, defaultOpen = true, badge, accent }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <SectionCard accent={accent}>
      <SectionHead title={title} open={open} onToggle={() => setOpen(o => !o)} badge={badge} accent={accent} />
      {open && <div style={{ padding: '8px 12px 12px' }}>{children}</div>}
    </SectionCard>
  )
}

function SubSec({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', padding: '4px 0', marginBottom: open ? 6 : 0,
        borderBottom: '1px dashed var(--border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
      </div>
      {open && children}
    </div>
  )
}

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
        style={{
          flex: 1, padding: '5px 8px', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', background: 'var(--surface2)',
          fontSize: 13, minWidth: 0, color: 'var(--text)',
        }} />
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
        <span style={{
          position: 'absolute', top: 3, left: value ? 18 : 3, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'all .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  )
}

function ColorSwatch({ value, onChange }) {
  return (
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: 30, height: 28, borderRadius: 'var(--r)',
        border: '1px solid var(--border)', padding: 2, cursor: 'pointer',
        background: 'none', flexShrink: 0,
      }} />
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

function ActionBtn({ onClick, children, danger, full, style: sx }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : undefined, padding: '7px 10px',
      border: `1px solid ${danger ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 'var(--r)',
      background: danger ? 'var(--red-dim)' : 'var(--surface2)',
      color: danger ? 'var(--red)' : 'var(--text2)',
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

// ── Ligne robot ──
function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 3,
      background: selected ? 'var(--accent-dim)' : 'transparent',
      border: `1px solid ${selected ? 'var(--accent-mid)' : 'transparent'}`,
      transition: 'all .12s',
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%', background: robot.color,
        display: 'inline-block', flexShrink: 0,
        boxShadow: selected ? `0 0 8px ${robot.color}` : 'none',
        transition: 'box-shadow .2s',
      }} />
      <span style={{
        flex: 1, fontWeight: 600, fontSize: 13,
        color: selected ? 'var(--accent)' : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{robot.name}</span>
      <span style={{
        fontSize: 10, color: 'var(--text3)', flexShrink: 0,
        background: 'var(--surface3)', borderRadius: 4, padding: '2px 5px', fontWeight: 600,
      }}>{robot.waypoints.length}pt</span>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        style={{
          width: 20, height: 20, borderRadius: 4, border: 'none',
          background: 'transparent', color: 'var(--text3)', fontSize: 16,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}

function ObsRow({ obs, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 3,
      background: selected ? 'var(--yellow-dim)' : 'transparent',
      border: `1px solid ${selected ? 'var(--yellow)' : 'transparent'}`,
      transition: 'all .12s',
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: obs.shape==='circle' ? '50%' : '2px',
        background: obs.color, display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {obs.name}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
      >×</button>
    </div>
  )
}

// ── Onglets ──
const TABS = [
  { id: 'robots',    icon: '🤖', label: null },
  { id: 'obstacles', icon: '🧱', label: null },
  { id: 'scene',     icon: '🎨', label: null },
]

function TabBar({ active, onChange, labels }) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={labels[tab.id]}
            style={{
              flex: 1, padding: '10px 6px', border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--accent)' : 'var(--text3)',
              transition: 'all .12s',
              marginBottom: -1,
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {labels[tab.id]}
            </span>
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
  const sel    = robots.find(r => r.id === selectedRobotId)
  const selObs = obstacles.find(o => o.id === selectedObsId)

  const [linUnit, setLinUnit] = useState('mm/s')
  const [angUnit, setAngUnit] = useState('°/s')
  const [tab, setTab]         = useState('robots')
  const t = useT()

  const [panelW, setPanelW] = useState(280)
  const resizing = useRef(false)
  const onResizeStart = useCallback(e => {
    resizing.current = true
    const startX = e.clientX, startW = panelW
    const onMove = ev => { if (resizing.current) setPanelW(Math.max(220, Math.min(500, startW + (ev.clientX - startX)))) }
    const onUp   = ()  => { resizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelW])

  const handleStlImport = e => {
    const file = e.target.files[0]; if (!file || !sel) return
    const reader = new FileReader()
    reader.onload = ev => setStlData(sel.id, ev.target.result)
    reader.readAsArrayBuffer(file); e.target.value = ''
  }
  const handleBgImport = e => {
    const file = e.target.files[0]; if (!file) return
    if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file)); e.target.value = ''
  }

  const ur = patch => updateRobot(sel.id, patch)
  const uo = patch => updateObstacle(selObs.id, patch)
  const norm360 = v => ((v % 360) + 360) % 360

  const tabLabels = { robots: t.robots, obstacles: t.obstacles, scene: t.tableGrid }

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      <div style={{
        width: panelW, height: '100%', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
      }}>
        {/* Onglets */}
        <TabBar active={tab} onChange={setTab} labels={tabLabels} />

        {/* Contenu de l'onglet */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 10 }}>

          {/* ── Tab Robots ── */}
          {tab === 'robots' && (
            <>
              <Sec title={t.robots} badge={robots.length || undefined} accent="var(--accent)" defaultOpen>
                {robots.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t.noRobotYet}</p>
                )}
                {robots.map(r => (
                  <RobotRow key={r.id} robot={r} selected={r.id === selectedRobotId}
                    onSelect={() => selectRobot(r.id)}
                    onRemove={() => { pushHistory({ robots, obstacles }); removeRobot(r.id) }} />
                ))}
                <button onClick={() => addRobot()} style={{
                  width: '100%', marginTop: 6, padding: '7px 10px', borderRadius: 'var(--r)',
                  border: '1.5px dashed var(--accent-mid)', background: 'var(--accent-dim)',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>+ {t.addRobot}</button>
              </Sec>

              {sel && (
                <Sec title={sel.name} defaultOpen accent="var(--purple)">
                  {/* Nom + couleur */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <ColorSwatch value={sel.color} onChange={v => ur({ color: v })} />
                    <input value={sel.name} onChange={e => ur({ name: e.target.value })}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 'var(--r)',
                        border: '1px solid var(--border)', background: 'var(--surface2)',
                        fontSize: 13, fontWeight: 700, minWidth: 0, color: 'var(--text)',
                      }} />
                  </div>

                  <SubSec title={t.dimensions}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label={t.width} half>
                        <NumInput value={mToMm(sel.width)} min={10} max={500} step={1} unit="mm" onChange={v => ur({ width: mmToM(v) })} />
                      </Field>
                      <Field label={t.depth} half>
                        <NumInput value={mToMm(sel.height)} min={10} max={500} step={1} unit="mm" onChange={v => ur({ height: mmToM(v) })} />
                      </Field>
                    </div>
                  </SubSec>

                  <SubSec title={t.speedAccel}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <UnitPicker units={Object.keys(LIN)} active={linUnit} onChange={setLinUnit} />
                      <UnitPicker units={Object.keys(ANG)} active={angUnit} onChange={setAngUnit} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label={t.speed} half>
                        <NumInput value={LIN[linUnit].toDisp(sel.speed)} min={0} max={linUnit==='mm/s'?5000:5}
                          step={LIN[linUnit].step} unit={linUnit} onChange={v => ur({ speed: LIN[linUnit].toStore(v) })} />
                      </Field>
                      <Field label={t.accel} half>
                        <NumInput value={LIN[linUnit].toDisp(sel.accel??1)} min={0} max={linUnit==='mm/s'?20000:20}
                          step={LIN[linUnit].stepA} unit={linUnit.replace('/s','/s²')} onChange={v => ur({ accel: LIN[linUnit].toStore(v) })} />
                      </Field>
                      <Field label={t.rotSpeed} half>
                        <NumInput value={ANG[angUnit].toDisp(sel.rotSpeed??90)} min={0} max={angUnit==='°/s'?1080:6}
                          step={ANG[angUnit].step} unit={angUnit} onChange={v => ur({ rotSpeed: ANG[angUnit].toStore(v) })} />
                      </Field>
                      <Field label={t.rotAccel} half>
                        <NumInput value={ANG[angUnit].toDisp(sel.rotAccel??360)} min={0} max={angUnit==='°/s'?7200:40}
                          step={ANG[angUnit].stepA} unit={angUnit.replace('/s','/s²')} onChange={v => ur({ rotAccel: ANG[angUnit].toStore(v) })} />
                      </Field>
                    </div>
                  </SubSec>

                  <SubSec title={t.motion}>
                    <Field label={t.startDelay}>
                      <NumInput value={sel.startDelay} min={0} max={60} step={0.5} unit="s" onChange={v => ur({ startDelay: v })} />
                    </Field>
                    <Field label={t.mode}>
                      <SegToggle value={sel.waypointMode ?? 'stop'}
                        options={[{ v:'stop', label:t.stopMode }, { v:'continuous', label:t.contMode }]}
                        onChange={v => ur({ waypointMode: v })} />
                    </Field>
                  </SubSec>

                  <SubSec title={t.collision}>
                    <Field label={t.collShape}>
                      <SegToggle value={sel.collisionShape ?? 'circle'}
                        options={[{ v:'circle', label:t.circleLabel }, { v:'rect', label:t.rectLabel }]}
                        onChange={v => ur({ collisionShape: v })} />
                    </Field>
                    <Field label={t.collRadius}>
                      <NumInput value={mToMm(sel.radius)} min={10} max={400} step={1} unit="mm" onChange={v => ur({ radius: mmToM(v) })} />
                    </Field>
                  </SubSec>

                  <SubSec title={t.appearance}>
                    <Field label={`${t.opacity}  ${Math.round((1-(sel.opacity??1))*100)}%`}>
                      <Slider value={1-(sel.opacity??1)} min={0} max={0.95} step={0.05} onChange={v => ur({ opacity: 1-v })} accent="var(--purple)" />
                    </Field>
                    <Field label={`${t.startHeading}  ${Math.round(norm360(sel.heading))}°`}>
                      <input type="range" min={0} max={359} step={1} value={norm360(sel.heading)}
                        onChange={e => ur({ heading: +e.target.value })}
                        style={{ width: '100%', accentColor: 'var(--purple)' }} />
                    </Field>
                  </SubSec>

                  <SubSec title={t.stlGeometry} defaultOpen={false}>
                    <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display: 'none' }} />
                    <ActionBtn full onClick={() => stlRef.current?.click()}>
                      📦 {sel.hasStl ? t.stlImported : t.stlImport}
                    </ActionBtn>
                    {sel.hasStl && (
                      <div style={{ marginTop: 10 }}>
                        <Label>{t.stlRotation}</Label>
                        {[['X', sel.stlRotX??-90], ['Y', sel.stlRotY??0], ['Z', sel.stlRotZ??0]].map(([ax,val]) => (
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

                  <ActionBtn full danger onClick={() => { pushHistory({ robots, obstacles }); clearWaypoints(sel.id) }}>
                    🗑 {t.clearTrajectory}
                  </ActionBtn>
                </Sec>
              )}
            </>
          )}

          {/* ── Tab Obstacles ── */}
          {tab === 'obstacles' && (
            <>
              <Sec title={t.obstacles} badge={obstacles.length || undefined} accent="var(--yellow)" defaultOpen>
                {obstacles.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t.noObstacleYet}</p>
                )}
                {obstacles.map(o => (
                  <ObsRow key={o.id} obs={o} selected={o.id === selectedObsId}
                    onSelect={() => selectObstacle(o.id)}
                    onRemove={() => removeObstacle(o.id)} />
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <button onClick={() => addObstacle({ shape:'rect', collisionShape:'rect' })} style={{
                    padding: '7px 0', borderRadius: 'var(--r)',
                    border: '1.5px dashed var(--border2)', background: 'transparent',
                    color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>+ {t.addRect}</button>
                  <button onClick={() => addObstacle({ shape:'circle', collisionShape:'circle' })} style={{
                    padding: '7px 0', borderRadius: 'var(--r)',
                    border: '1.5px dashed var(--border2)', background: 'transparent',
                    color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>+ {t.addCircle}</button>
                </div>
              </Sec>

              {selObs && (
                <Sec title={selObs.name} defaultOpen accent="var(--yellow)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ColorSwatch value={selObs.color} onChange={v => uo({ color: v })} />
                    <input value={selObs.name} onChange={e => uo({ name: e.target.value })}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, minWidth: 0, color: 'var(--text)' }} />
                  </div>
                  <Field label={t.visualShape}>
                    <SegToggle value={selObs.shape}
                      options={[{ v:'rect', label:t.rectLabel2 }, { v:'circle', label:t.circleLabel2 }]}
                      onChange={v => uo({ shape: v })} />
                  </Field>
                  <Field label={t.collShape}>
                    <SegToggle value={selObs.collisionShape ?? 'rect'}
                      options={[{ v:'rect', label:t.rectLabel }, { v:'circle', label:t.circleLabel }]}
                      onChange={v => uo({ collisionShape: v })} />
                  </Field>
                  {selObs.shape === 'rect' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label={t.width} half>
                        <NumInput value={mToMm(selObs.width)} min={10} max={2000} step={1} unit="mm" onChange={v => uo({ width: mmToM(v), radius: mmToM(v)/2/1000 })} />
                      </Field>
                      <Field label={t.depth} half>
                        <NumInput value={mToMm(selObs.height)} min={10} max={2000} step={1} unit="mm" onChange={v => uo({ height: mmToM(v) })} />
                      </Field>
                    </div>
                  ) : (
                    <Field label={t.radius}>
                      <NumInput value={mToMm(selObs.radius)} min={10} max={1000} step={1} unit="mm" onChange={v => uo({ radius: mmToM(v), width: mmToM(v)*2, height: mmToM(v)*2 })} />
                    </Field>
                  )}
                  <Field label={`${t.opacity}  ${Math.round((1-(selObs.opacity??1))*100)}%`}>
                    <Slider value={1-(selObs.opacity??1)} min={0} max={0.95} step={0.05} onChange={v => uo({ opacity: 1-v })} accent="var(--yellow)" />
                  </Field>
                </Sec>
              )}
            </>
          )}

          {/* ── Tab Scène ── */}
          {tab === 'scene' && (
            <Sec title={t.tableGrid} accent="var(--green)" defaultOpen>
              <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display: 'none' }} />
              <ActionBtn full onClick={() => bgRef.current?.click()} style={{ marginBottom: 6 }}>
                🖼 {bgImage ? t.changeBgImage : t.addBgImage}
              </ActionBtn>
              {bgImage && (
                <ActionBtn full danger style={{ marginBottom: 10 }}
                  onClick={() => { if (bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage); setBgImage(null) }}>
                  {t.removeBgImage}
                </ActionBtn>
              )}

              <Field label={t.tableSurface}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ColorSwatch value={viewportColor || '#2d6e3e'} onChange={setViewportColor} />
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text3)' }}>{viewportColor || '#2d6e3e'}</span>
                </div>
              </Field>
              <Field label={t.canvasBg}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ColorSwatch value={canvasBgColor || '#2e4a76'} onChange={setCanvasBgColor} />
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text3)' }}>{canvasBgColor || '#2e4a76'}</span>
                </div>
              </Field>

              <Toggle value={showGrid} onChange={setShowGrid} label={t.showGrid} />

              <Field label={t.gridColor}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ColorSwatch value={gridColor} onChange={setGridColor} />
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text3)' }}>{gridColor}</span>
                </div>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label={t.minorGrid} half>
                  <NumInput value={gridMinorStep} min={0} max={100} step={5} unit="cm" onChange={setGridMinorStep} />
                </Field>
                <Field label={t.majorGrid} half>
                  <NumInput value={gridMajorStep} min={0} max={200} step={10} unit="cm" onChange={setGridMajorStep} />
                </Field>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t.hint}</p>
            </Sec>
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
