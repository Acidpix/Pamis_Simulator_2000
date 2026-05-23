import React, { useRef, useState } from 'react'
import { useSimStore, pushHistory } from '../store/simStore.js'

const mToMm  = m  => Math.round(m * 1000)
const mmToM  = mm => mm / 1000
const mToMs  = m  => Math.round(m * 1000) // speed: m/s -> mm/s

function Card({ children }) {
  return <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:14, marginBottom:10, boxShadow:'var(--shadow)' }}>{children}</div>
}
function CardTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>{children}</div>
}
function Label({ children }) {
  return <div style={{ fontSize:12, color:'var(--text3)', fontWeight:500, marginBottom:3 }}>{children}</div>
}
function Field({ label, children }) {
  return <div style={{ marginBottom:10 }}><Label>{label}</Label>{children}</div>
}
function NumInput({ value, min, max, step=1, unit, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => { const v=parseFloat(e.target.value); if(!isNaN(v)) onChange(v) }}
        style={{ flex:1, padding:'6px 8px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:14 }} />
      {unit && <span style={{ fontSize:12, color:'var(--text3)', minWidth:26 }}>{unit}</span>}
    </div>
  )
}

function HeadingPicker({ value, onChange }) {
  const dirs = [{ l:'→', d:0 },{ l:'↑', d:90 },{ l:'←', d:180 },{ l:'↓', d:270 }]
  const norm = ((value%360)+360)%360
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:6 }}>
        {dirs.map(d => {
          const active = Math.abs(norm - d.d) < 1
          return (
            <button key={d.d} onClick={() => onChange(d.d)} style={{
              padding:'6px 0', borderRadius:'var(--r)', fontSize:18,
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

function ColorSwatch({ value, onChange, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <input type="color" value={value} onChange={e=>onChange(e.target.value)}
        style={{ width:36, height:30, borderRadius:'var(--r)', border:'1.5px solid var(--border)', padding:2, cursor:'pointer', background:'none' }} />
      {label && <span style={{ fontSize:13, color:'var(--text2)' }}>{label}</span>}
    </div>
  )
}

function RobotRow({ robot, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 8px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:3,
      background:selected?'var(--blue-dim)':'transparent',
      border:`1.5px solid ${selected?'var(--blue-mid)':'transparent'}`,
    }}>
      <span style={{ width:11, height:11, borderRadius:'50%', background:robot.color, display:'inline-block', flexShrink:0 }} />
      <span style={{ flex:1, fontWeight:500, fontSize:14, color:selected?'var(--blue)':'var(--text)' }}>{robot.name}</span>
      <span style={{ fontSize:12, color:'var(--text3)' }}>{robot.waypoints.length}pt</span>
      <button onClick={e=>{e.stopPropagation();onRemove()}}
        style={{ width:22, height:22, borderRadius:4, border:'none', background:'transparent', color:'var(--text3)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
    </div>
  )
}

function ObsRow({ obs, selected, onSelect, onRemove }) {
  return (
    <div onClick={onSelect} style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 8px',
      borderRadius:'var(--r)', cursor:'pointer', marginBottom:3,
      background:selected?'#fffbeb':'transparent',
      border:`1.5px solid ${selected?'#fcd34d':'transparent'}`,
    }}>
      <span style={{ width:11, height:11, borderRadius:obs.shape==='circle'?'50%':'2px', background:obs.color, display:'inline-block', flexShrink:0 }} />
      <span style={{ flex:1, fontWeight:500, fontSize:14, color:'var(--text)' }}>{obs.name}</span>
      <span style={{ fontSize:12, color:'var(--text3)' }}>{obs.shape==='circle'?'○':'▭'}</span>
      <button onClick={e=>{e.stopPropagation();onRemove()}}
        style={{ width:22, height:22, borderRadius:4, border:'none', background:'transparent', color:'var(--text3)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
    </div>
  )
}

function FlatBtn({ onClick, children, danger, full, style:sx }) {
  return (
    <button onClick={onClick} style={{
      width:full?'100%':undefined, padding:'7px 12px',
      border:`1.5px solid ${danger?'#fca5a5':'var(--border)'}`,
      borderRadius:'var(--r)', background:danger?'var(--red-dim)':'var(--surface2)',
      color:danger?'var(--red)':'var(--text2)',
      fontSize:14, fontWeight:500, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6, ...sx,
    }}>{children}</button>
  )
}

// ── Sections dépliables ──
function Section({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom: open ? 10 : 0 }}>
        <CardTitle>{title}</CardTitle>
        <span style={{ fontSize:12, color:'var(--text3)', marginBottom:open?10:0 }}>{open?'▾':'▸'}</span>
      </div>
      {open && children}
    </Card>
  )
}

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

  const obstacles        = useSimStore(s=>s.obstacles)
  const selectedObsId    = useSimStore(s=>s.selectedObsId)
  const addObstacle      = useSimStore(s=>s.addObstacle)
  const removeObstacle   = useSimStore(s=>s.removeObstacle)
  const selectObstacle   = useSimStore(s=>s.selectObstacle)
  const updateObstacle   = useSimStore(s=>s.updateObstacle)

  const stlRef = useRef(); const bgRef = useRef()
  const selected = robots.find(r=>r.id===selectedRobotId)
  const selObs   = obstacles.find(o=>o.id===selectedObsId)

  const handleStlImport = e => {
    const file = e.target.files[0]; if(!file||!selected) return
    const reader = new FileReader()
    reader.onload = ev => setStlData(selected.id, ev.target.result)
    reader.readAsArrayBuffer(file); e.target.value=''
  }
  const handleBgImport = e => {
    const file = e.target.files[0]; if(!file) return
    if(bgImage?.startsWith('blob:')) URL.revokeObjectURL(bgImage)
    setBgImage(URL.createObjectURL(file)); e.target.value=''
  }

  return (
    <div style={{ width:264, height:'100%', overflowY:'auto', flexShrink:0, padding:12, borderRight:'1px solid var(--border)', background:'var(--bg)' }}>

      {/* ── Robots ── */}
      <Section title="Robots">
        {robots.length===0 && <p style={{ fontSize:13, color:'var(--text3)', marginBottom:8 }}>Ajoutez un robot pour commencer.</p>}
        {robots.map(r=>(
          <RobotRow key={r.id} robot={r} selected={r.id===selectedRobotId}
            onSelect={()=>selectRobot(r.id)} onRemove={()=>removeRobot(r.id)} />
        ))}
        <button onClick={()=>addRobot()} style={{
          width:'100%', marginTop:8, padding:9, borderRadius:'var(--r)',
          border:'1.5px dashed var(--border2)', background:'transparent',
          color:'var(--blue)', fontSize:14, fontWeight:600, cursor:'pointer',
        }}>+ Ajouter un robot</button>
      </Section>

      {/* ── Propriétés robot ── */}
      {selected && (
        <Section title={`⚙ ${selected.name}`}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <ColorSwatch value={selected.color} onChange={v=>updateRobot(selected.id,{color:v})} />
            <input value={selected.name} onChange={e=>updateRobot(selected.id,{name:e.target.value})}
              style={{ flex:1, padding:'6px 8px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:14, fontWeight:600 }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Délai départ">
              <NumInput value={selected.startDelay} min={0} max={60} step={0.5} unit="s" onChange={v=>updateRobot(selected.id,{startDelay:v})} />
            </Field>
            <Field label="Vitesse">
              <NumInput value={mToMs(selected.speed)} min={1} max={2000} step={10} unit="mm/s" onChange={v=>updateRobot(selected.id,{speed:mmToM(v)})} />
            </Field>
            <Field label="Largeur">
              <NumInput value={mToMm(selected.width)} min={10} max={500} step={1} unit="mm" onChange={v=>updateRobot(selected.id,{width:mmToM(v)})} />
            </Field>
            <Field label="Profondeur">
              <NumInput value={mToMm(selected.height)} min={10} max={500} step={1} unit="mm" onChange={v=>updateRobot(selected.id,{height:mmToM(v)})} />
            </Field>
          </div>

          <Field label="Rayon de collision">
            <NumInput value={mToMm(selected.radius)} min={10} max={400} step={1} unit="mm" onChange={v=>updateRobot(selected.id,{radius:mmToM(v)})} />
          </Field>

          <Field label="Orientation de départ">
            <HeadingPicker value={selected.heading} onChange={v=>updateRobot(selected.id,{heading:v})} />
          </Field>

          <Field label="Géométrie STL">
            <input type="file" ref={stlRef} accept=".stl" onChange={handleStlImport} style={{ display:'none' }} />
            <FlatBtn full onClick={()=>stlRef.current?.click()}>
              📦 {selected.hasStl?'✓ STL importé — changer':'Importer fichier STL'}
            </FlatBtn>
          </Field>

          {selected.hasStl && (
            <Field label="Rotation STL (X / Y / Z)">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[['X',selected.stlRotX??-90],['Y',selected.stlRotY??0],['Z',selected.stlRotZ??0]].map(([ax,val])=>(
                  <div key={ax}>
                    <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{ax}</div>
                    <NumInput value={val} min={-360} max={360} step={15} unit="°"
                      onChange={v=>updateRobot(selected.id,{ [`stlRot${ax}`]:v })} />
                  </div>
                ))}
              </div>
            </Field>
          )}

          <FlatBtn full danger onClick={()=>clearWaypoints(selected.id)}>🗑 Effacer la trajectoire</FlatBtn>
        </Section>
      )}

      {/* ── Obstacles ── */}
      <Section title="Obstacles statiques" defaultOpen={false}>
        {obstacles.length===0 && <p style={{ fontSize:13, color:'var(--text3)', marginBottom:8 }}>Aucun obstacle. Les obstacles bloquent la trajectoire.</p>}
        {obstacles.map(o=>(
          <ObsRow key={o.id} obs={o} selected={o.id===selectedObsId}
            onSelect={()=>selectObstacle(o.id)} onRemove={()=>removeObstacle(o.id)} />
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
          <button onClick={()=>addObstacle({shape:'rect'})} style={{ padding:8, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'transparent', color:'var(--text2)', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            + Rectangle
          </button>
          <button onClick={()=>addObstacle({shape:'circle'})} style={{ padding:8, borderRadius:'var(--r)', border:'1.5px dashed var(--border2)', background:'transparent', color:'var(--text2)', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            + Cercle
          </button>
        </div>
      </Section>

      {/* ── Propriétés obstacle ── */}
      {selObs && (
        <Section title={`▭ ${selObs.name}`}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <ColorSwatch value={selObs.color} onChange={v=>updateObstacle(selObs.id,{color:v})} />
            <input value={selObs.name} onChange={e=>updateObstacle(selObs.id,{name:e.target.value})}
              style={{ flex:1, padding:'6px 8px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:14, fontWeight:600 }} />
          </div>

          <Field label="Forme">
            <div style={{ display:'flex', gap:6 }}>
              {['rect','circle'].map(sh=>(
                <button key={sh} onClick={()=>updateObstacle(selObs.id,{shape:sh})} style={{
                  flex:1, padding:'6px 0', borderRadius:'var(--r)', fontSize:13, fontWeight:500, cursor:'pointer',
                  border:`1.5px solid ${selObs.shape===sh?'var(--blue)':'var(--border)'}`,
                  background:selObs.shape===sh?'var(--blue-dim)':'var(--surface2)',
                  color:selObs.shape===sh?'var(--blue)':'var(--text2)',
                }}>{sh==='rect'?'▭ Rectangle':'○ Cercle'}</button>
              ))}
            </div>
          </Field>

          {selObs.shape==='rect' ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <Field label="Largeur">
                <NumInput value={mToMm(selObs.width)} min={10} max={2000} step={1} unit="mm" onChange={v=>updateObstacle(selObs.id,{width:mmToM(v),radius:mmToM(v)/2})} />
              </Field>
              <Field label="Profondeur">
                <NumInput value={mToMm(selObs.height)} min={10} max={2000} step={1} unit="mm" onChange={v=>updateObstacle(selObs.id,{height:mmToM(v)})} />
              </Field>
            </div>
          ) : (
            <Field label="Rayon">
              <NumInput value={mToMm(selObs.radius)} min={10} max={1000} step={1} unit="mm" onChange={v=>updateObstacle(selObs.id,{radius:mmToM(v),width:mmToM(v)*2,height:mmToM(v)*2})} />
            </Field>
          )}
        </Section>
      )}

      {/* ── Table & grille ── */}
      <Section title="Table & Grille" defaultOpen={false}>
        <input type="file" ref={bgRef} accept="image/*" onChange={handleBgImport} style={{ display:'none' }} />
        <FlatBtn full onClick={()=>bgRef.current?.click()}>
          🖼 {bgImage?"Changer l'image de fond":'Ajouter une image de fond'}
        </FlatBtn>
        {bgImage && <FlatBtn full danger style={{ marginTop:6 }} onClick={()=>{ if(bgImage?.startsWith('blob:'))URL.revokeObjectURL(bgImage); setBgImage(null) }}>Supprimer l'image</FlatBtn>}

        <div style={{ marginTop:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <Label>Afficher la grille</Label>
            <button onClick={()=>setShowGrid(!showGrid)} style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background:showGrid?'var(--blue)':'var(--border2)', transition:'all .2s', position:'relative',
            }}>
              <span style={{ position:'absolute', top:3, left:showGrid?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'all .2s' }} />
            </button>
          </div>

          <Field label="Couleur de la grille">
            <ColorSwatch value={gridColor} onChange={setGridColor} label={gridColor} />
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Petite grille">
              <NumInput value={gridMinorStep} min={0} max={100} step={5} unit="cm" onChange={setGridMinorStep} />
            </Field>
            <Field label="Grande grille">
              <NumInput value={gridMajorStep} min={0} max={200} step={10} unit="cm" onChange={setGridMajorStep} />
            </Field>
          </div>
        </div>

        <p style={{ fontSize:12, color:'var(--text3)', marginTop:6 }}>Table 300 × 200 cm • Scroll pour zoomer</p>
      </Section>
    </div>
  )
}
