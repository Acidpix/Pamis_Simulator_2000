import React, { useMemo } from 'react'
import { useSimStore, computeSegments } from '../store/simStore.js'

function Card({ children, style }) {
  return <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', marginBottom:10, overflow:'hidden', boxShadow:'var(--shadow)', ...style }}>{children}</div>
}
function CardHead({ children, color }) {
  return <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:color||'var(--text3)' }}>{children}</div>
}
function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign:'center', padding:'9px 4px' }}>
      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:color||'var(--text)', fontVariantNumeric:'tabular-nums' }}>{value}</div>
    </div>
  )
}
function SegRow({ seg, idx, color }) {
  return (
    <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:color+'22', color }}>#{idx+1}</span>
        <span style={{ fontSize:12, color:'var(--text3)' }}>départ à {seg.startTime}s</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {[
          { l:'Distance', v:seg.dist+' mm' },
          { l:'Durée',    v:seg.duration+' s' },
          { l:'Cap',      v:seg.angle+'°' },
          { l:'Rotation', v:seg.relAngle!==null?(seg.relAngle>0?'+':'')+seg.relAngle+'°':'—' },
        ].map(({l,v})=>(
          <div key={l}>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{l}</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:5, fontSize:11, color:'var(--text3)' }}>
        ({Math.round(seg.from.x*1000)}, {Math.round(seg.from.y*1000)}) → ({Math.round(seg.to.x*1000)}, {Math.round(seg.to.y*1000)}) mm
      </div>
    </div>
  )
}

export default function RightPanel() {
  const robots        = useSimStore(s=>s.robots)
  const selectedRobotId= useSimStore(s=>s.selectedRobotId)
  const collisions    = useSimStore(s=>s.collisions)
  const obsCollisions = useSimStore(s=>s.obsCollisions)
  const obstacles     = useSimStore(s=>s.obstacles)

  const selected = robots.find(r=>r.id===selectedRobotId)
  const segments = useMemo(()=>selected?computeSegments(selected):[], [selected])

  const totalDistMm = segments.reduce((a,s)=>a+s.dist, 0)
  const totalTime   = selected ? segments.reduce((a,s)=>a+s.duration,0)+(selected?.startDelay??0) : 0

  const allCols = [...collisions, ...obsCollisions]

  const handleExport = () => {
    const data = robots.map(r=>({
      name:r.name, color:r.color,
      startPosition:{ x_mm:Math.round(r.x*1000), y_mm:Math.round(r.y*1000) },
      startHeading_deg:r.heading,
      startDelay_s:r.startDelay,
      speed_mm_s:Math.round(r.speed*1000),
      radius_mm:Math.round(r.radius*1000),
      segments:computeSegments(r).map(s=>({
        from:{ x_mm:Math.round(s.from.x*1000), y_mm:Math.round(s.from.y*1000) },
        to:  { x_mm:Math.round(s.to.x*1000),   y_mm:Math.round(s.to.y*1000) },
        distance_mm:s.dist, heading_deg:s.angle, rotation_deg:s.relAngle,
        start_time_s:s.startTime, duration_s:s.duration,
      })),
    }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    a.download = 'pamis_trajectoires.json'; a.click()
  }

  return (
    <div style={{ width:256, height:'100%', overflowY:'auto', flexShrink:0, padding:12, borderLeft:'1px solid var(--border)', background:'var(--bg)' }}>

      {/* Collisions robot-robot */}
      {collisions.length>0 && (
        <Card style={{ borderColor:'#fca5a5' }}>
          <CardHead color="var(--red)">⚠ {collisions.length} collision{collisions.length>1?'s':''} robot-robot</CardHead>
          <div style={{ padding:10 }}>
            {collisions.map((c,i)=>{
              const a=robots.find(r=>r.id===c.aId), b=robots.find(r=>r.id===c.bId)
              return (
                <div key={i} style={{ fontSize:13, marginBottom:6, padding:'6px 8px', background:'var(--red-dim)', borderRadius:6 }}>
                  <span style={{ color:a?.color, fontWeight:700 }}>{a?.name}</span>{' ↔ '}<span style={{ color:b?.color, fontWeight:700 }}>{b?.name}</span>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Collisions robot-obstacle */}
      {obsCollisions.length>0 && (
        <Card style={{ borderColor:'#fcd34d' }}>
          <CardHead color="var(--orange)">⚠ {obsCollisions.length} collision{obsCollisions.length>1?'s':''} robot-obstacle</CardHead>
          <div style={{ padding:10 }}>
            {obsCollisions.map((c,i)=>{
              const r=robots.find(r=>r.id===c.robotId), o=obstacles.find(o=>o.id===c.obsId)
              return (
                <div key={i} style={{ fontSize:13, marginBottom:6, padding:'6px 8px', background:'#fffbeb', borderRadius:6 }}>
                  <span style={{ color:r?.color, fontWeight:700 }}>{r?.name}</span>{' ↔ '}<span style={{ color:o?.color, fontWeight:700 }}>{o?.name}</span>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {allCols.length===0 && robots.length>0 && (
        <div style={{ marginBottom:10, padding:'9px 12px', borderRadius:'var(--r2)', background:'var(--green-dim)', border:'1px solid #bbf7d0', fontSize:13, color:'var(--green)', fontWeight:500 }}>
          ✓ Aucune collision détectée
        </div>
      )}

      {/* Trajectoire sélectionnée */}
      {selected && (
        <Card>
          <CardHead><span style={{ color:selected.color }}>●</span> {selected.name} — Trajectoire</CardHead>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid var(--border)' }}>
            <Stat label="Distance" value={totalDistMm>0?totalDistMm+' mm':'—'} color="var(--blue)" />
            <Stat label="Durée"    value={totalTime>0?totalTime.toFixed(1)+' s':'—'} />
            <Stat label="Points"   value={segments.length} />
          </div>
          {segments.length===0 ? (
            <div style={{ padding:16, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              Mode <strong>Tracer</strong> → cliquez la table pour ajouter des waypoints.<br/>
              <span style={{ fontSize:12, marginTop:4, display:'block' }}>En mode Tracer, cliquez un waypoint existant pour le supprimer.</span>
            </div>
          ) : segments.map((seg,i)=><SegRow key={i} seg={seg} idx={i} color={selected.color} />)}
        </Card>
      )}

      {/* Résumé */}
      {robots.length>1 && (
        <Card>
          <CardHead>Tous les robots</CardHead>
          {robots.map(r=>{
            const segs=computeSegments(r)
            const dist=segs.reduce((a,s)=>a+s.dist,0)
            const dur=segs.reduce((a,s)=>a+s.duration,0)+r.startDelay
            return (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:r.color, display:'inline-block', flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{dist}mm</span>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{dur.toFixed(1)}s</span>
              </div>
            )
          })}
        </Card>
      )}

      {robots.length>0 && (
        <button onClick={handleExport} style={{
          width:'100%', padding:11, borderRadius:'var(--r2)',
          border:'1.5px solid var(--border2)', background:'var(--surface)',
          color:'var(--text)', fontSize:14, fontWeight:600, cursor:'pointer',
          boxShadow:'var(--shadow)',
        }}>⬇ Exporter JSON trajectoires</button>
      )}

      {robots.length===0 && (
        <Card>
          <CardHead>Comment utiliser</CardHead>
          <div style={{ padding:12, fontSize:13, color:'var(--text2)', lineHeight:2 }}>
            <div>① Ajoutez un robot (gauche)</div>
            <div>② Mode <strong>Tracer</strong> → cliquez la table</div>
            <div>③ Cliquez un waypoint pour le supprimer</div>
            <div>④ Définissez l'orientation de départ</div>
            <div>⑤ ▶ Simuler pour animer</div>
            <div>⑥ 🧊 3D pour la vue 3D</div>
            <div>⑦ 🌙 pour le mode sombre</div>
          </div>
        </Card>
      )}
    </div>
  )
}
