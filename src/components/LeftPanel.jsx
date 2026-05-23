import React, { useRef, useState, useCallback } from 'react'
import { useSimStore, pushHistory } from '../store/simStore.js'
import { useT } from '../i18n.js'

const mToMm = m => Math.round(m * 1000)
const mmToM = mm => mm / 1000

// Conversions unités linéaires (stocké en m/s et m/s²)
const LIN = {
  'mm/s':  { toDisp: v => Math.round(v*1000),            toStore: v => v/1000,       step: 10,   stepA: 100 },
  'm/s':   { toDisp: v => Math.round(v*1000)/1000,        toStore: v => v,            step: 0.01, stepA: 0.1 },
}
// Conversions unités angulaires (stocké en deg/s et deg/s²)
const ANG = {
  '°/s':   { toDisp: v => Math.round(v*10)/10,            toStore: v => v,            step: 5,    stepA: 10  },
  'rad/s': { toDisp: v => Math.round(v*Math.PI/180*1000)/1000, toStore: v => v*180/Math.PI, step: 0.05, stepA: 0.1 },
}

// ── Composants UI ──
function Card({ children, style }) {
  return <div style={{
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--r2)', padding:'14px 14px 10px',
    marginBottom:10, boxShadow:'var(--shadow)', ...style,
  }}>{children}</div>
}
function Label({ children }) {
  return <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4, letterSpacing:'.03em' }}>{children}</div>
}
function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom:9, gridColumn:half?'span 1':'span 2' }}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  )
}
function NumInput({ value, min, max, step=1, unit, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))onChange(v)}}
        style={{
          flex:1, padding:'6px 8px', borderRadius:'var(--r)',
          border:'1.5px solid var(--border)', fontSize:13, minWidth:0,
          background:'var(--surface2)', fontWeight:500,
        }} />
      {unit && <span style={{ fontSize:11, color:'var(--text3)', minWidth:28, flexShrink:0, fontWeight:600 }}>{unit}</span>}
    </div>
  )
}
function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
      {label && <span style={{ fontSize:13, color:'var(--text2)', fontWeight:500 }}>{label}</span>}
      <button onClick={()=>onChange(!value)} style={{
        width:42, height:24, borderRadius:12, border:'none', cursor:'pointer', flexShrink:0,
        background: value ? 'var(--blue)' : 'var(--border2)',
        transition:'all .2s', position:'relative',
        boxShadow: value ? '0 2px 6px rgba(109,40,217,.30)' : 'none',
      }}>
        <span style={{ position:'absolute', top:3, left:value?21:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'all .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
      </button>
    </div>
  )
}
function ColorSwatch({ value, onChange }) {
  return (
    <input type="color" value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:34, height:30, borderRadius:'var(--r)', border:'2px solid var(--border)', padding:2, cursor:'pointer', background:'none', flexShrink:0 }} />
  )
}
function Slider({ value, min=0, max=1, step=0.05, onChange }) {
  return (
    <input type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(+e.target.value)}
      style={{ width:'100%', accentColor:'var(--blue)' }} />
  )
}
function ShapeToggle({ value, options, onChange }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)} style={{
          flex:1, padding:'6px 4px', borderRadius:'var(--r)', fontSize:12, fontWeight:600, cursor:'pointer',
          border:`1.5px solid ${value===o.v?'var(--blue)':'var(--border)'}`,
          background: value===o.v ? 'var(--blue-dim)' : 'var(--surface2)',
          color: value===o.v ? 'var(--blue)' : 'var(--text2)',
          transition:'all .12s',
        }}>{o.label}</button>
      ))}
    </div>
  )
}
function FlatBtn({ onClick, children, danger, full, style:sx }) {
  return (
    <button onClick={onClick} style={{
      width:full?'100%':undefined, padding:'8px 12px',
      border:`1.5px solid ${danger?'#fca5a5':'var(--border)'}`,
      borderRadius:'var(--r)', background:danger?'var(--red-dim)':'var(--surface2)',
      color:danger?'var(--red)':'var(--text2)',
      fontSize:13, fontWeight:600, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
      transition:'all .12s', ...sx,
    }}>{children}</button>
  )
}

// Sub-section collapsible (sans carte autour)
function SubSec({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 0', marginBottom: open ? 8 : 0,
        borderBottom:`1.5px solid var(--border)`,
      }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--blue)', textTransform:'uppercase', letterSpacing:'.08em' }}>{title}</span>
        <span style={{ fontSize:10, color:'var(--text3)', fontWeight:700 }}>{open?'▾':'▸'}</span>
      </div>
      {open && children}
    </div>
  )
}

// ── Section dépliable ──
function Sec({ title, children, defaultOpen=true, badge, accent }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = accent || 'var(--blue)'
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'var(--r2)', marginBottom:10,
      boxShadow:'var(--shadow)', overflow:'hidden',
    }}>
      {/* Header coloré */}
      <div onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'10px 14px',
        borderBottom: open ? '1px solid var(--border)' : 'none',
        background:`linear-gradient(90deg, ${color}18 0%, transparent 100%)`,
        borderLeft:`3px solid ${color}`,
      }}>
        <div style={{ fontSize:12, fontWeight:700, color, display:'flex', alignItems:'center', gap:7 }}>
          {title}
          {badge !== undefined && (
            <span style={{ fontSize:10, background:color, color:'#fff', borderRadius:99, padding:'1px 7px', fontWeight:700 }}>{badge}</span>
          )}
        </div>
        <span style={{ fontSize:11, color:'var(--text3)', fontWeight:700 }}>{open?'▾':'▸'}</span>
      </div>
      {open && <div style={{ padding:'12px 14px 10px' }}>{children}</div>}
    </div>
  )
}

function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:3,
      background: selected ? 'var(--blue-dim)' : 'var(--surface2)',
      border: `1.5px solid ${selected ? 'var(--blue-mid)' : 'transparent'}`,
      transition:'all .12s',
    }}>
      <span style={{
        width:12, height:12, borderRadius:'50%', background:robot.color,
        display:'inline-block', flexShrink:0,
        boxShadow:`0 0 0 2px ${robot.color}44`,
      }} />
      <span style={{ flex:1, fontWeight:600, fontSize:13, color:selected?'var(--blue)':'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{robot.name}</span>
      <span style={{
        fontSize:10, color: selected ? 'var(--blue)' : 'var(--text3)',
        background: selected ? 'var(--blue-mid)' : 'var(--border)',
        borderRadius:99, padding:'1px 6px', fontWeight:700, flexShrink:0,
      }}>{robot.waypoints.length}pt</span>
      <button onClick={e=>{e.stopPropagation();onRemove()}}
        style={{ width:20, height:20, borderRadius:4, border:'none', background:'transparent', color:'var(--text3)', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
    </div>
  )
}
function ObsRow({ obs, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:3,
      background: selected ? '#fefce8' : 'var(--surface2)',
      border: `1.5px solid ${selected ? '#fcd34d' : 'transparent'}`,
      transition:'all .12s',
    }}>
      <span style={{
        width:12, height:12, borderRadius:obs.shape==='circle'?'50%':'3px',
        background:obs.color, display:'inline-block', flexShrink:0,
        boxShadow:`0 0 0 2px ${obs.color}44`,
      }} />
      <span style={{ flex:1, fontWeight:600, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{obs.name}</span>
      <button onClick={e=>{e.stopPropagation();onRemove()}}
        style={{ width:20, height:20, borderRadius:4, border:'none', background:'transparent', color:'var(--text3)', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
    </div>
  )
}

// ── Panel principal ──
export default function LeftPanel() {
  const robots           = useSimStore(s=>s.robots)
  const selectedRobotId  = useSimStore(s=>s.selectedRobotId)
  const addRobot         = useSimStore(s=>s.addRobot)
  const removeRobot      = useSimStore(s=>s.removeRobot)
  const selectRobot      = useSimStore(s=>s.selectRobot)
  const updateRobot      = useSimStore(s=>s.updateRobot)
  const setStlData       = useSimStore(s=>s.setStlData)
  const clearWaypoints   = useSimStore(s=>s.clearWaypoints)
  const setBgImage       = useSimStore(s=>s.setBgImage)
  const bgImage          = useSimStore(s=>s.bgImage)
  const showGrid         = useSimStore(s=>s.showGrid)
  const setShowGrid      = useSimStore(s=>s.setShowGrid)
  const gridColor        = useSimStore(s=>s.gridColor)
  const setGridColor     = useSimStore(s=>s.setGridColor)
  const gridMinorStep    = useSimStore(s=>s.gridMinorStep)
  const setGridMinorStep = useSimStore(s=>s.setGridMinorStep)
  const gridMajorStep    = useSimStore(s=>s.gridMajorStep)
  const setGridMajorStep = useSimStore(s=>s.setGridMajorStep)
  const viewportColor    = useSimStore(s=>s.viewportColor)
  const setViewportColor = useSimStore(s=>s.setViewportColor)
  const canvasBgColor    = useSimStore(s=>s.canvasBgColor)
  const setCanvasBgColor = useSimStore(s=>s.setCanvasBgColor)
  const obstacles        = useSimStore(s=>s.obstacles)
  const selectedObsId    = useSimStore(s=>s.selectedObsId)
  const addObstacle      = useSimStore(s=>s.addObstacle)
  const removeObstacle   = useSimStore(s=>s.removeObstacle)
  const selectObstacle   = useSimStore(s=>s.selectObstacle)
  const updateObstacle   = useSimStore(s=>s.updateObstacle)

  const stlRef=useRef(), bgRef=useRef()
  const sel    = robots.find(r=>r.id===selectedRobotId)
  const selObs = obstacles.find(o=>o.id===selectedObsId)

  const [linUnit, setLinUnit] = useState('mm/s')
  const [angUnit, setAngUnit] = useState('°/s')
  const t = useT()

  const [panelW, setPanelW] = useState(300)
  const resizing = useRef(false)
  const onResizeStart = useCallback(e => {
    resizing.current = true
    const startX = e.clientX, startW = panelW
    const onMove = ev => { if(resizing.current) setPanelW(Math.max(240, Math.min(480, startW+(ev.clientX-startX)))) }
    const onUp   = ()  => { resizing.current=false; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [panelW])

  const handleStlImport = e => {
    const file=e.target.files[0]; if(!file||!sel) return
    const reader=new FileReader()
    reader.onload=ev=>setStlData(sel.id,ev.target.result)
    reader.readAsArrayBuffer(file); e.target.value=''
  }
  const handleBgImport = e => {
    const file=e.target.files[0]; if(!file) return
    if(bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file)); e.target.value=''
  }

  const ur = (patch) => updateRobot(sel.id, patch)
  const uo = (patch) => updateObstacle(selObs.id, patch)

  const norm360 = v => ((v%360)+360)%360

  return (
    <div style={{ display:'flex', flexShrink:0, height:'100%' }}>
      <div style={{ width:panelW, height:'100%', overflowY:'auto', overflowX:'hidden', padding:'10px 10px', borderRight:'1px solid var(--border)', background:'var(--bg)' }}>

        {/* ── Robots ── */}
        <Sec title={t.robots} badge={robots.length||undefined}>
          {robots.length===0 && <p style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{t.noRobotYet}</p>}
          {robots.map(r=>(
            <RobotRow key={r.id} robot={r} selected={r.id===selectedRobotId}
              onSelect={()=>selectRobot(r.id)} onRemove={()=>{pushHistory({robots,obstacles});removeRobot(r.id)}} />
          ))}
          <button onClick={()=>addRobot()} style={{
            width:'100%', marginTop:6, padding:9, borderRadius:'var(--r)',
            border:'1.5px dashed var(--blue-mid)', background:'var(--blue-dim)',
            color:'var(--blue)', fontSize:13, fontWeight:700, cursor:'pointer',
            transition:'all .12s',
          }}>{t.addRobot}</button>
        </Sec>

        {/* ── Propriétés robot ── */}
        {sel && (
          <Sec title={sel.name} defaultOpen>
            {/* Nom + couleur */}
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
              <ColorSwatch value={sel.color} onChange={v=>ur({color:v})} />
              <input value={sel.name} onChange={e=>ur({name:e.target.value})}
                style={{ flex:1, padding:'5px 7px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:13, fontWeight:600, minWidth:0 }} />
            </div>

            {/* Dimensions */}
            <SubSec title={t.dimensions}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label={t.width} half>
                  <NumInput value={mToMm(sel.width)} min={10} max={500} step={1} unit="mm" onChange={v=>ur({width:mmToM(v)})} />
                </Field>
                <Field label={t.depth} half>
                  <NumInput value={mToMm(sel.height)} min={10} max={500} step={1} unit="mm" onChange={v=>ur({height:mmToM(v)})} />
                </Field>
              </div>
            </SubSec>

            {/* Vitesse & Accélération */}
            <SubSec title={t.speedAccel}>
              {/* Sélecteurs d'unités */}
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                {Object.keys(LIN).map(u=>(
                  <button key={u} onClick={()=>setLinUnit(u)} style={{
                    flex:1, padding:'3px 0', borderRadius:'var(--r)', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:`1.5px solid ${linUnit===u?'var(--blue)':'var(--border)'}`,
                    background:linUnit===u?'var(--blue-dim)':'var(--surface2)',
                    color:linUnit===u?'var(--blue)':'var(--text3)',
                  }}>{u}</button>
                ))}
                <div style={{ width:1, background:'var(--border)', margin:'0 2px' }} />
                {Object.keys(ANG).map(u=>(
                  <button key={u} onClick={()=>setAngUnit(u)} style={{
                    flex:1, padding:'3px 0', borderRadius:'var(--r)', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:`1.5px solid ${angUnit===u?'var(--blue)':'var(--border)'}`,
                    background:angUnit===u?'var(--blue-dim)':'var(--surface2)',
                    color:angUnit===u?'var(--blue)':'var(--text3)',
                  }}>{u}</button>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label={t.speed} half>
                  <NumInput value={LIN[linUnit].toDisp(sel.speed)} min={0} max={linUnit==='mm/s'?5000:5}
                    step={LIN[linUnit].step} unit={linUnit} onChange={v=>ur({speed:LIN[linUnit].toStore(v)})} />
                </Field>
                <Field label={t.accel} half>
                  <NumInput value={LIN[linUnit].toDisp(sel.accel??1)} min={0} max={linUnit==='mm/s'?20000:20}
                    step={LIN[linUnit].stepA} unit={linUnit.replace('/s','/s²')} onChange={v=>ur({accel:LIN[linUnit].toStore(v)})} />
                </Field>
                <Field label={t.rotSpeed} half>
                  <NumInput value={ANG[angUnit].toDisp(sel.rotSpeed??90)} min={0} max={angUnit==='°/s'?1080:6}
                    step={ANG[angUnit].step} unit={angUnit} onChange={v=>ur({rotSpeed:ANG[angUnit].toStore(v)})} />
                </Field>
                <Field label={t.rotAccel} half>
                  <NumInput value={ANG[angUnit].toDisp(sel.rotAccel??360)} min={0} max={angUnit==='°/s'?7200:40}
                    step={ANG[angUnit].stepA} unit={angUnit.replace('/s','/s²')} onChange={v=>ur({rotAccel:ANG[angUnit].toStore(v)})} />
                </Field>
              </div>
            </SubSec>

            {/* Déplacement */}
            <SubSec title={t.motion}>
              <Field label={t.startDelay}>
                <NumInput value={sel.startDelay} min={0} max={60} step={0.5} unit="s" onChange={v=>ur({startDelay:v})} />
              </Field>
              <Field label={t.mode}>
                <ShapeToggle value={sel.waypointMode??'stop'}
                  options={[{v:'stop',label:t.stopMode},{v:'continuous',label:t.contMode}]}
                  onChange={v=>ur({waypointMode:v})} />
              </Field>
            </SubSec>

            {/* Collision */}
            <SubSec title={t.collision}>
              <Field label={t.collShape}>
                <ShapeToggle value={sel.collisionShape??'circle'}
                  options={[{v:'circle',label:t.circleLabel},{v:'rect',label:t.rectLabel}]}
                  onChange={v=>ur({collisionShape:v})} />
              </Field>
              <Field label={t.collRadius}>
                <NumInput value={mToMm(sel.radius)} min={10} max={400} step={1} unit="mm" onChange={v=>ur({radius:mmToM(v)})} />
              </Field>
            </SubSec>

            {/* Apparence */}
            <SubSec title={t.appearance}>
              <Field label={`${t.opacity}  ${Math.round((1-(sel.opacity??1))*100)}%`}>
                <Slider value={1-(sel.opacity??1)} min={0} max={0.95} step={0.05} onChange={v=>ur({opacity:1-v})} />
              </Field>
              <Field label={`${t.startHeading}  ${Math.round(norm360(sel.heading))}°`}>
                <input type="range" min={0} max={359} step={1} value={norm360(sel.heading)}
                  onChange={e=>ur({heading:+e.target.value})}
                  style={{ width:'100%', accentColor:'var(--blue)' }} />
              </Field>
            </SubSec>

            {/* STL */}
            <SubSec title={t.stlGeometry} defaultOpen={false}>
              <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display:'none' }} />
              <FlatBtn full onClick={()=>stlRef.current?.click()}>
                📦 {sel.hasStl ? t.stlImported : t.stlImport}
              </FlatBtn>
              {sel.hasStl && (
                <div style={{ marginTop:8 }}>
                  <Label>{t.stlRotation}</Label>
                  {[['X', sel.stlRotX??-90], ['Y', sel.stlRotY??0], ['Z', sel.stlRotZ??0]].map(([ax,val])=>(
                    <div key={ax} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text3)', width:14, flexShrink:0 }}>{ax}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <NumInput value={val} min={-360} max={360} step={15} unit="°" onChange={v=>ur({[`stlRot${ax}`]:v})} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SubSec>

            <FlatBtn full danger onClick={()=>{pushHistory({robots,obstacles});clearWaypoints(sel.id)}}>
              {t.clearTrajectory}
            </FlatBtn>
          </Sec>
        )}

        {/* ── Obstacles ── */}
        <Sec title={t.obstacles} defaultOpen={false} badge={obstacles.length||undefined}>
          {obstacles.length===0 && <p style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{t.noObstacleYet}</p>}
          {obstacles.map(o=>(
            <ObsRow key={o.id} obs={o} selected={o.id===selectedObsId}
              onSelect={()=>selectObstacle(o.id)} onRemove={()=>removeObstacle(o.id)} />
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
            <button onClick={()=>addObstacle({shape:'rect',collisionShape:'rect'})} style={{ padding:8, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'var(--surface2)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .12s' }}>{t.addRect}</button>
            <button onClick={()=>addObstacle({shape:'circle',collisionShape:'circle'})} style={{ padding:8, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'var(--surface2)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .12s' }}>{t.addCircle}</button>
          </div>
        </Sec>

        {/* ── Propriétés obstacle ── */}
        {selObs && (
          <Sec title={selObs.name} defaultOpen>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <ColorSwatch value={selObs.color} onChange={v=>uo({color:v})} />
              <input value={selObs.name} onChange={e=>uo({name:e.target.value})}
                style={{ flex:1, padding:'5px 7px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:13, fontWeight:600, minWidth:0 }} />
            </div>
            <Field label={t.visualShape}>
              <ShapeToggle value={selObs.shape}
                options={[{v:'rect',label:t.rectLabel2},{v:'circle',label:t.circleLabel2}]}
                onChange={v=>uo({shape:v})} />
            </Field>
            <Field label={t.collShape}>
              <ShapeToggle value={selObs.collisionShape??'rect'}
                options={[{v:'rect',label:t.rectLabel},{v:'circle',label:t.circleLabel}]}
                onChange={v=>uo({collisionShape:v})} />
            </Field>
            {selObs.shape==='rect' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label={t.width} half>
                  <NumInput value={mToMm(selObs.width)} min={10} max={2000} step={1} unit="mm" onChange={v=>uo({width:mmToM(v),radius:mmToM(v)/2/1000})} />
                </Field>
                <Field label={t.depth} half>
                  <NumInput value={mToMm(selObs.height)} min={10} max={2000} step={1} unit="mm" onChange={v=>uo({height:mmToM(v)})} />
                </Field>
              </div>
            ) : (
              <Field label={t.radius}>
                <NumInput value={mToMm(selObs.radius)} min={10} max={1000} step={1} unit="mm" onChange={v=>uo({radius:mmToM(v),width:mmToM(v)*2,height:mmToM(v)*2})} />
              </Field>
            )}
            <Field label={`${t.opacity}  ${Math.round((1-(selObs.opacity??1))*100)}%`}>
              <Slider value={1-(selObs.opacity??1)} min={0} max={0.95} step={0.05} onChange={v=>uo({opacity:1-v})} />
            </Field>
          </Sec>
        )}

        {/* ── Table & Grille ── */}
        <Sec title={t.tableGrid} defaultOpen={false}>
          <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display:'none' }} />
          <FlatBtn full onClick={()=>bgRef.current?.click()} style={{ marginBottom:6 }}>
            🖼 {bgImage ? t.changeBgImage : t.addBgImage}
          </FlatBtn>
          {bgImage && <FlatBtn full danger style={{ marginBottom:8 }} onClick={()=>{if(bgImage?.startsWith('blob:'))URL.revokeObjectURL(bgImage);setBgImage(null)}}>{t.removeBgImage}</FlatBtn>}

          <Field label={t.tableSurface}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ColorSwatch value={viewportColor||'#2d6e3e'} onChange={setViewportColor} />
              <span style={{ fontSize:12, color:'var(--text3)' }}>{viewportColor||'#2d6e3e'}</span>
            </div>
          </Field>

          <Field label={t.canvasBg}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ColorSwatch value={canvasBgColor||'#2e4a76'} onChange={setCanvasBgColor} />
              <span style={{ fontSize:12, color:'var(--text3)' }}>{canvasBgColor||'#2e4a76'}</span>
            </div>
          </Field>

          <Toggle value={showGrid} onChange={setShowGrid} label={t.showGrid} />

          <Field label={t.gridColor}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ColorSwatch value={gridColor} onChange={setGridColor} />
              <span style={{ fontSize:12, color:'var(--text3)' }}>{gridColor}</span>
            </div>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label={t.minorGrid} half>
              <NumInput value={gridMinorStep} min={0} max={100} step={5} unit="cm" onChange={setGridMinorStep} />
            </Field>
            <Field label={t.majorGrid} half>
              <NumInput value={gridMajorStep} min={0} max={200} step={10} unit="cm" onChange={setGridMajorStep} />
            </Field>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{t.hint}</p>
        </Sec>
      </div>

      {/* Poignée de redimensionnement */}
      <div onMouseDown={onResizeStart}
        style={{ width:4, cursor:'col-resize', background:'var(--border)', flexShrink:0, transition:'background .15s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--blue)'}
        onMouseLeave={e=>e.currentTarget.style.background='var(--border)'} />
    </div>
  )
}
