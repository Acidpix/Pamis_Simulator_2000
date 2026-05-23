import React, { useRef, useState, useCallback } from 'react'
import { useSimStore, pushHistory } from '../store/simStore.js'

const mToMm = m => Math.round(m * 1000)
const mmToM = mm => mm / 1000

// ── Composants UI ──
function Card({ children, style }) {
  return <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:12, marginBottom:8, boxShadow:'var(--shadow)', ...style }}>{children}</div>
}
function CardTitle({ children, right }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>{children}</div>
      {right}
    </div>
  )
}
function Label({ children }) {
  return <div style={{ fontSize:12, color:'var(--text3)', fontWeight:500, marginBottom:3 }}>{children}</div>
}
function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom:8, gridColumn:half?'span 1':'span 2' }}>
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
        style={{ flex:1, padding:'5px 7px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:13, minWidth:0 }} />
      {unit && <span style={{ fontSize:11, color:'var(--text3)', minWidth:28, flexShrink:0 }}>{unit}</span>}
    </div>
  )
}
function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
      {label && <span style={{ fontSize:13, color:'var(--text2)' }}>{label}</span>}
      <button onClick={()=>onChange(!value)} style={{
        width:40, height:22, borderRadius:11, border:'none', cursor:'pointer', flexShrink:0,
        background:value?'var(--blue)':'var(--border2)', transition:'all .2s', position:'relative',
      }}>
        <span style={{ position:'absolute', top:3, left:value?20:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all .2s' }} />
      </button>
    </div>
  )
}
function ColorSwatch({ value, onChange }) {
  return (
    <input type="color" value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:32, height:28, borderRadius:'var(--r)', border:'1.5px solid var(--border)', padding:2, cursor:'pointer', background:'none', flexShrink:0 }} />
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
          flex:1, padding:'5px 0', borderRadius:'var(--r)', fontSize:12, fontWeight:500, cursor:'pointer',
          border:`1.5px solid ${value===o.v?'var(--blue)':'var(--border)'}`,
          background:value===o.v?'var(--blue-dim)':'var(--surface2)',
          color:value===o.v?'var(--blue)':'var(--text2)',
        }}>{o.label}</button>
      ))}
    </div>
  )
}
function FlatBtn({ onClick, children, danger, full, style:sx }) {
  return (
    <button onClick={onClick} style={{
      width:full?'100%':undefined, padding:'7px 10px',
      border:`1.5px solid ${danger?'#fca5a5':'var(--border)'}`,
      borderRadius:'var(--r)', background:danger?'var(--red-dim)':'var(--surface2)',
      color:danger?'var(--red)':'var(--text2)',
      fontSize:13, fontWeight:500, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:5, ...sx,
    }}>{children}</button>
  )
}
function HeadingPicker({ value, onChange }) {
  const dirs=[{l:'→',d:0},{l:'↑',d:90},{l:'←',d:180},{l:'↓',d:270}]
  const norm=((value%360)+360)%360
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:6 }}>
        {dirs.map(d=>{
          const active=Math.abs(norm-d.d)<1
          return (
            <button key={d.d} onClick={()=>onChange(d.d)} style={{
              padding:'5px 0', borderRadius:'var(--r)', fontSize:17,
              border:`1.5px solid ${active?'var(--blue)':'var(--border)'}`,
              background:active?'var(--blue-dim)':'var(--surface2)',
              color:active?'var(--blue)':'var(--text2)', cursor:'pointer',
            }}>{d.l}</button>
          )
        })}
      </div>
      <NumInput value={Math.round(value)} min={-360} max={360} step={5} unit="°" onChange={onChange} />
    </div>
  )
}

// ── Section dépliable ──
function Sec({ title, children, defaultOpen=true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:open?10:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', display:'flex', alignItems:'center', gap:6 }}>
          {title}
          {badge && <span style={{ fontSize:10, background:'var(--blue)', color:'#fff', borderRadius:10, padding:'1px 6px' }}>{badge}</span>}
        </div>
        <span style={{ fontSize:12, color:'var(--text3)' }}>{open?'▾':'▸'}</span>
      </div>
      {open && children}
    </Card>
  )
}

// ── Ligne robot ──
function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:7, padding:'7px 6px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:2,
      background:selected?'var(--blue-dim)':'transparent',
      border:`1.5px solid ${selected?'var(--blue-mid)':'transparent'}`,
    }}>
      <span style={{ width:10, height:10, borderRadius:'50%', background:robot.color, display:'inline-block', flexShrink:0 }} />
      <span style={{ flex:1, fontWeight:500, fontSize:13, color:selected?'var(--blue)':'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{robot.name}</span>
      <span style={{ fontSize:11, color:'var(--text3)', flexShrink:0 }}>{robot.waypoints.length}pt</span>
      <button onClick={e=>{e.stopPropagation();onRemove()}}
        style={{ width:20, height:20, borderRadius:4, border:'none', background:'transparent', color:'var(--text3)', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
    </div>
  )
}
function ObsRow({ obs, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:7, padding:'7px 6px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:2,
      background:selected?'#fffbeb':'transparent',
      border:`1.5px solid ${selected?'#fcd34d':'transparent'}`,
    }}>
      <span style={{ width:10, height:10, borderRadius:obs.shape==='circle'?'50%':'2px', background:obs.color, display:'inline-block', flexShrink:0 }} />
      <span style={{ flex:1, fontWeight:500, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{obs.name}</span>
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
  const updateWaypointPause = useSimStore(s=>s.updateWaypointPause)
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
  const obstacles        = useSimStore(s=>s.obstacles)
  const selectedObsId    = useSimStore(s=>s.selectedObsId)
  const addObstacle      = useSimStore(s=>s.addObstacle)
  const removeObstacle   = useSimStore(s=>s.removeObstacle)
  const selectObstacle   = useSimStore(s=>s.selectObstacle)
  const updateObstacle   = useSimStore(s=>s.updateObstacle)

  const stlRef=useRef(), bgRef=useRef()
  const sel    = robots.find(r=>r.id===selectedRobotId)
  const selObs = obstacles.find(o=>o.id===selectedObsId)

  // Largeur redimensionnable
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

  return (
    <div style={{ display:'flex', flexShrink:0, height:'100%' }}>
      <div style={{ width:panelW, height:'100%', overflowY:'auto', overflowX:'hidden', padding:10, borderRight:'1px solid var(--border)', background:'var(--bg)' }}>

        {/* ── Robots ── */}
        <Sec title="Robots" badge={robots.length||undefined}>
          {robots.length===0 && <p style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>Ajoutez un robot pour commencer.</p>}
          {robots.map(r=>(
            <RobotRow key={r.id} robot={r} selected={r.id===selectedRobotId}
              onSelect={()=>selectRobot(r.id)} onRemove={()=>{pushHistory({robots,obstacles});removeRobot(r.id)}} />
          ))}
          <button onClick={()=>addRobot()} style={{
            width:'100%', marginTop:6, padding:8, borderRadius:'var(--r)',
            border:'1.5px dashed var(--border2)', background:'transparent',
            color:'var(--blue)', fontSize:13, fontWeight:600, cursor:'pointer',
          }}>+ Ajouter un robot</button>
        </Sec>

        {/* ── Propriétés robot ── */}
        {sel && (
          <Sec title={sel.name} defaultOpen>
            {/* Nom + couleur */}
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <ColorSwatch value={sel.color} onChange={v=>ur({color:v})} />
              <input value={sel.name} onChange={e=>ur({name:e.target.value})}
                style={{ flex:1, padding:'5px 7px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:13, fontWeight:600, minWidth:0 }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <Field label="Délai départ" half>
                <NumInput value={sel.startDelay} min={0} max={60} step={0.5} unit="s" onChange={v=>ur({startDelay:v})} />
              </Field>
              <Field label="Vitesse" half>
                <NumInput value={mToMm(sel.speed)} min={1} max={3000} step={10} unit="mm/s" onChange={v=>ur({speed:mmToM(v)})} />
              </Field>
              <Field label="Accélération" half>
                <NumInput value={Math.round((sel.accel??1)*1000)} min={100} max={10000} step={100} unit="mm/s²" onChange={v=>ur({accel:v/1000})} />
              </Field>
              <Field label="Largeur" half>
                <NumInput value={mToMm(sel.width)} min={10} max={500} step={1} unit="mm" onChange={v=>ur({width:mmToM(v)})} />
              </Field>
              <Field label="Profondeur" half>
                <NumInput value={mToMm(sel.height)} min={10} max={500} step={1} unit="mm" onChange={v=>ur({height:mmToM(v)})} />
              </Field>
              <Field label="Rayon collision" half>
                <NumInput value={mToMm(sel.radius)} min={10} max={400} step={1} unit="mm" onChange={v=>ur({radius:mmToM(v)})} />
              </Field>
            </div>

            <Field label="Mode de déplacement">
              <ShapeToggle value={sel.waypointMode??'stop'}
                options={[{v:'stop',label:'⏸ Stop aux pts'},{v:'continuous',label:'→ Continu'}]}
                onChange={v=>ur({waypointMode:v})} />
            </Field>

            <Field label="Forme de collision">
              <ShapeToggle value={sel.collisionShape??'circle'}
                options={[{v:'circle',label:'○ Cercle'},{v:'rect',label:'▭ Rect'}]}
                onChange={v=>ur({collisionShape:v})} />
            </Field>

            <Field label={`Transparence  ${Math.round((1-(sel.opacity??1))*100)}%`}>
              <Slider value={1-(sel.opacity??1)} min={0} max={0.95} step={0.05} onChange={v=>ur({opacity:1-v})} />
            </Field>

            <Field label="Orientation de départ">
              <HeadingPicker value={sel.heading} onChange={v=>ur({heading:v})} />
            </Field>

            {/* Pauses aux waypoints */}
            {sel.waypoints.length>0 && (
              <Field label="Pauses aux waypoints">
                <div style={{ maxHeight:140, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:6 }}>
                  {sel.waypoints.map((wp,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--text3)', minWidth:40 }}>Pt {i+1}</span>
                      <NumInput value={wp.pause??0} min={0} max={60} step={0.5} unit="s" onChange={v=>updateWaypointPause(sel.id,i,v)} />
                    </div>
                  ))}
                </div>
              </Field>
            )}

            {/* STL */}
            <Field label="Géométrie STL">
              <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display:'none' }} />
              <FlatBtn full onClick={()=>stlRef.current?.click()}>
                📦 {sel.hasStl?'✓ STL importé — changer':'Importer fichier STL'}
              </FlatBtn>
            </Field>

            {sel.hasStl && (
              <Field label="Rotation STL">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[['X',sel.stlRotX??-90],['Y',sel.stlRotY??0],['Z',sel.stlRotZ??0]].map(([ax,val])=>(
                    <div key={ax}>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{ax}</div>
                      <NumInput value={val} min={-360} max={360} step={15} unit="°" onChange={v=>ur({[`stlRot${ax}`]:v})} />
                    </div>
                  ))}
                </div>
              </Field>
            )}

            <FlatBtn full danger onClick={()=>{pushHistory({robots,obstacles});clearWaypoints(sel.id)}}>
              🗑 Effacer la trajectoire
            </FlatBtn>
          </Sec>
        )}

        {/* ── Obstacles ── */}
        <Sec title="Obstacles" defaultOpen={false} badge={obstacles.length||undefined}>
          {obstacles.length===0 && <p style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>Ajoutez des obstacles statiques (détection de collision).</p>}
          {obstacles.map(o=>(
            <ObsRow key={o.id} obs={o} selected={o.id===selectedObsId}
              onSelect={()=>selectObstacle(o.id)} onRemove={()=>removeObstacle(o.id)} />
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
            <button onClick={()=>addObstacle({shape:'rect',collisionShape:'rect'})} style={{ padding:7, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'transparent', color:'var(--text2)', fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Rectangle</button>
            <button onClick={()=>addObstacle({shape:'circle',collisionShape:'circle'})} style={{ padding:7, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'transparent', color:'var(--text2)', fontSize:12, fontWeight:500, cursor:'pointer' }}>+ Cercle</button>
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
            <Field label="Forme visuelle">
              <ShapeToggle value={selObs.shape}
                options={[{v:'rect',label:'▭ Rectangle'},{v:'circle',label:'○ Cercle'}]}
                onChange={v=>uo({shape:v})} />
            </Field>
            <Field label="Forme de collision">
              <ShapeToggle value={selObs.collisionShape??'rect'}
                options={[{v:'rect',label:'▭ Rect'},{v:'circle',label:'○ Cercle'}]}
                onChange={v=>uo({collisionShape:v})} />
            </Field>
            {selObs.shape==='rect' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label="Largeur" half>
                  <NumInput value={mToMm(selObs.width)} min={10} max={2000} step={1} unit="mm" onChange={v=>uo({width:mmToM(v),radius:mmToM(v)/2/1000})} />
                </Field>
                <Field label="Profondeur" half>
                  <NumInput value={mToMm(selObs.height)} min={10} max={2000} step={1} unit="mm" onChange={v=>uo({height:mmToM(v)})} />
                </Field>
              </div>
            ) : (
              <Field label="Rayon">
                <NumInput value={mToMm(selObs.radius)} min={10} max={1000} step={1} unit="mm" onChange={v=>uo({radius:mmToM(v),width:mmToM(v)*2,height:mmToM(v)*2})} />
              </Field>
            )}
            <Field label={`Transparence  ${Math.round((1-(selObs.opacity??1))*100)}%`}>
              <Slider value={1-(selObs.opacity??1)} min={0} max={0.95} step={0.05} onChange={v=>uo({opacity:1-v})} />
            </Field>
          </Sec>
        )}

        {/* ── Table & Grille ── */}
        <Sec title="Table & Grille" defaultOpen={false}>
          <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display:'none' }} />
          <FlatBtn full onClick={()=>bgRef.current?.click()} style={{ marginBottom:6 }}>
            🖼 {bgImage?"Changer l'image de fond":'Ajouter image de fond'}
          </FlatBtn>
          {bgImage && <FlatBtn full danger style={{ marginBottom:8 }} onClick={()=>{if(bgImage?.startsWith('blob:'))URL.revokeObjectURL(bgImage);setBgImage(null)}}>Supprimer l'image</FlatBtn>}

          <Field label="Couleur du fond">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ColorSwatch value={viewportColor||'#2d6e3e'} onChange={setViewportColor} />
              <span style={{ fontSize:12, color:'var(--text3)' }}>{viewportColor||'#2d6e3e'}</span>
            </div>
          </Field>

          <Toggle value={showGrid} onChange={setShowGrid} label="Afficher la grille" />

          <Field label="Couleur de la grille">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ColorSwatch value={gridColor} onChange={setGridColor} />
              <span style={{ fontSize:12, color:'var(--text3)' }}>{gridColor}</span>
            </div>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Petite grille" half>
              <NumInput value={gridMinorStep} min={0} max={100} step={5} unit="cm" onChange={setGridMinorStep} />
            </Field>
            <Field label="Grande grille" half>
              <NumInput value={gridMajorStep} min={0} max={200} step={10} unit="cm" onChange={setGridMajorStep} />
            </Field>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>300×200cm • Ctrl+drag = snap 15°</p>
        </Sec>
      </div>

      {/* Poignée de redimensionnement */}
      <div onMouseDown={onResizeStart}
        style={{ width:5, cursor:'col-resize', background:'var(--border)', flexShrink:0, transition:'background .15s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--blue)'}
        onMouseLeave={e=>e.currentTarget.style.background='var(--border)'} />
    </div>
  )
}
