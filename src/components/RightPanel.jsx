import React, { useMemo, useState } from 'react'
import { useSimStore, computeSegments, getRobotPose } from '../store/simStore.js'
import { useT } from '../i18n.js'

const TABLE_W = 3.0
const TABLE_H = 2.0

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16)
  return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 }
}

function generateGazeboSDF(robots, obstacles, simMaxTime, step = 0.1) {
  const actors = robots.map(robot => {
    const waypoints = []
    for (let t = 0; t <= simMaxTime + step/2; t += step) {
      const ts = Math.min(t, simMaxTime)
      const pose = getRobotPose(robot, ts)
      const gx = (pose.x - TABLE_W/2).toFixed(4)
      const gy = (pose.y - TABLE_H/2).toFixed(4)
      const yaw = (pose.heading * Math.PI / 180).toFixed(4)
      waypoints.push(`        <waypoint><time>${ts.toFixed(2)}</time><pose>${gx} ${gy} 0 0 0 ${yaw}</pose></waypoint>`)
    }
    const c = hexToRgb(robot.color)
    return `  <actor name="${robot.name.replace(/\s/g,'_')}">
    <pose>${(robot.x - TABLE_W/2).toFixed(4)} ${(robot.y - TABLE_H/2).toFixed(4)} 0 0 0 0</pose>
    <link name="body">
      <visual name="visual">
        <geometry><cylinder><radius>${robot.radius.toFixed(4)}</radius><length>0.3</length></cylinder></geometry>
        <material><ambient>${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} 1</ambient></material>
      </visual>
    </link>
    <script>
      <loop>false</loop>
      <delay_start>${robot.startDelay ?? 0}</delay_start>
      <auto_start>true</auto_start>
      <trajectory id="0" type="walking">
${waypoints.join('\n')}
      </trajectory>
    </script>
  </actor>`
  })

  const models = obstacles.map((obs, i) => {
    const gx = (obs.x - TABLE_W/2).toFixed(4)
    const gy = (obs.y - TABLE_H/2).toFixed(4)
    const c = hexToRgb(obs.color || '#888888')
    const geom = obs.shape === 'circle'
      ? `<cylinder><radius>${obs.radius.toFixed(4)}</radius><length>0.1</length></cylinder>`
      : `<box><size>${obs.width.toFixed(4)} ${obs.height.toFixed(4)} 0.1</size></box>`
    return `  <model name="obstacle_${i+1}">
    <static>true</static>
    <pose>${gx} ${gy} 0.05 0 0 0</pose>
    <link name="link">
      <visual name="visual">
        <geometry>${geom}</geometry>
        <material><ambient>${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} ${obs.opacity ?? 1}</ambient></material>
      </visual>
      <collision name="collision"><geometry>${geom}</geometry></collision>
    </link>
  </model>`
  })

  return `<?xml version="1.0"?>
<sdf version="1.6">
  <world name="pamis_world">
    <model name="table">
      <static>true</static>
      <pose>0 0 -0.005 0 0 0</pose>
      <link name="surface">
        <visual name="visual">
          <geometry><box><size>${TABLE_W} ${TABLE_H} 0.01</size></box></geometry>
          <material><ambient>0.8 0.8 0.8 1</ambient></material>
        </visual>
        <collision name="collision"><geometry><box><size>${TABLE_W} ${TABLE_H} 0.01</size></box></geometry></collision>
      </link>
    </model>
${models.join('\n')}
${actors.join('\n')}
  </world>
</sdf>`
}

function PauseInput({ value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <input type="number" value={value} min={0} max={60} step={0.5}
        onChange={e=>{ const v=parseFloat(e.target.value); if(!isNaN(v)) onChange(v) }}
        style={{ width:52, padding:'3px 5px', borderRadius:4, border:'1.5px solid var(--border)', fontSize:12 }} />
      <span style={{ fontSize:11, color:'var(--text3)' }}>s</span>
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:'var(--r2)', marginBottom:10, overflow:'hidden',
    boxShadow:'var(--shadow)', ...style,
  }}>{children}</div>
}
function CardHead({ children, color, accent }) {
  const c = accent || color || 'var(--blue)'
  return (
    <div style={{
      padding:'10px 14px', borderBottom:'1px solid var(--border)',
      fontSize:12, fontWeight:700, letterSpacing:'.05em', color:c,
      background:`linear-gradient(90deg, ${c}15 0%, transparent 100%)`,
      borderLeft:`3px solid ${c}`,
    }}>{children}</div>
  )
}
function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign:'center', padding:'10px 4px' }}>
      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:700, color:color||'var(--text)', fontVariantNumeric:'tabular-nums' }}>{value}</div>
    </div>
  )
}
function SegRow({ seg, idx, color, t }) {
  return (
    <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
        <span style={{
          fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
          background:color+'22', color, letterSpacing:'.04em',
        }}>#{idx+1}</span>
        <span style={{ fontSize:11, color:'var(--text3)' }}>{t.segStartAt} {seg.startTime}s</span>
        {seg.pause > 0 && (
          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:'#fef3c7', color:'#d97706', fontWeight:700 }}>
            ⏱ +{seg.pause}s
          </span>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {[
          { l:t.segDistance, v:seg.dist+' mm' },
          { l:t.segMotion,   v:seg.duration+' s' },
          { l:t.segHeading,  v:seg.angle+'°' },
          { l:t.segTurn,     v:seg.relAngle!==null?(seg.relAngle>0?'+':'')+seg.relAngle+'°':'—' },
          ...(seg.rotDuration>0 ? [{ l:t.segRotation, v:seg.rotDuration+' s' }] : []),
        ].map(({l,v})=>(
          <div key={l} style={{ background:'var(--surface2)', borderRadius:'var(--r)', padding:'5px 8px' }}>
            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', fontVariantNumeric:'tabular-nums' }}>
        ({Math.round(seg.from.x*1000)}, {Math.round(seg.from.y*1000)}) → ({Math.round(seg.to.x*1000)}, {Math.round(seg.to.y*1000)}) mm
      </div>
    </div>
  )
}

function RobotTrajectory({ robot, defaultOpen, onPauseChange, t }) {
  const [open, setOpen] = useState(defaultOpen)
  const segments = useMemo(() => computeSegments(robot), [robot])
  const totalDistMm = segments.reduce((a,s)=>a+s.dist, 0)
  const totalTime = segments.reduce((a,s)=>a+s.duration+s.rotDuration, 0) + (robot.startDelay ?? 0)

  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'var(--r2)', marginBottom:10, overflow:'hidden', boxShadow:'var(--shadow)',
    }}>
      <div onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:8, padding:'11px 14px', cursor:'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          background:`linear-gradient(90deg, ${robot.color}15 0%, transparent 60%)`,
          borderLeft:`3px solid ${robot.color}`,
        }}>
        <span style={{ width:10, height:10, borderRadius:'50%', background:robot.color, flexShrink:0, boxShadow:`0 0 0 2px ${robot.color}44` }} />
        <span style={{ flex:1, fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{robot.name}</span>
        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 6px', borderRadius:99, fontVariantNumeric:'tabular-nums' }}>{totalDistMm}mm</span>
        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 6px', borderRadius:99 }}>{totalTime.toFixed(1)}s</span>
        <span style={{ fontSize:10, color:'var(--text3)', fontWeight:700 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>
            <Stat label={t.segDistance} value={totalDistMm>0?totalDistMm+' mm':'—'} color="var(--blue)" />
            <Stat label={t.segMotion}   value={totalTime>0?totalTime.toFixed(1)+' s':'—'} />
            <Stat label="Pts"           value={segments.length} color="var(--blue)" />
          </div>
          {segments.length === 0 ? (
            <div style={{ padding:14, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              {t.noWaypoints}
            </div>
          ) : segments.map((seg,i) => (
            <div key={i}>
              <SegRow seg={seg} idx={i} color={robot.color} t={t} />
              {onPauseChange && (
                <div style={{ padding:'5px 14px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--text3)', flex:1 }}>{t.pauseOnArrival}</span>
                  <PauseInput value={robot.waypoints[i]?.pause ?? 0} onChange={v=>onPauseChange(i, v)} />
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function RightPanel() {
  const t = useT()
  const updateWaypointPause = useSimStore(s=>s.updateWaypointPause)
  const robots         = useSimStore(s=>s.robots)
  const selectedRobotId= useSimStore(s=>s.selectedRobotId)
  const collisions     = useSimStore(s=>s.collisions)
  const obsCollisions  = useSimStore(s=>s.obsCollisions)
  const borderCollisions= useSimStore(s=>s.borderCollisions)
  const obstacles      = useSimStore(s=>s.obstacles)
  const simMaxTime     = useSimStore(s=>s.simMaxTime)

  const allCols = [...collisions, ...obsCollisions, ...borderCollisions]

  const handleExportGazebo = () => {
    const sdf = generateGazeboSDF(robots, obstacles, simMaxTime)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([sdf], { type: 'application/xml' }))
    a.download = 'pamis_world.world'; a.click()
  }

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
        start_time_s:s.startTime, duration_s:s.duration, pause_s:s.pause,
      })),
    }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    a.download = 'pamis_trajectoires.json'; a.click()
  }

  return (
    <div style={{ width:264, height:'100%', overflowY:'auto', flexShrink:0, padding:'10px 10px', borderLeft:'1px solid var(--border)', background:'var(--bg)' }}>

      {/* Collisions robot-robot */}
      {collisions.length>0 && (
        <Card style={{ borderColor:'#fca5a5' }}>
          <CardHead accent="var(--red)">{t.collRobotLabel(collisions.length)}</CardHead>
          <div style={{ padding:10 }}>
            {collisions.map((c,i)=>{
              const a=robots.find(r=>r.id===c.aId), b=robots.find(r=>r.id===c.bId)
              return (
                <div key={i} style={{ fontSize:13, marginBottom:6, padding:'7px 10px', background:'var(--red-dim)', borderRadius:'var(--r)', border:'1px solid #fecaca' }}>
                  <span style={{ color:a?.color, fontWeight:700 }}>{a?.name}</span>{' ↔ '}<span style={{ color:b?.color, fontWeight:700 }}>{b?.name}</span>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, fontVariantNumeric:'tabular-nums' }}>t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Collisions robot-obstacle */}
      {obsCollisions.length>0 && (
        <Card style={{ borderColor:'#fcd34d' }}>
          <CardHead accent="var(--orange)">{t.collObsLabel(obsCollisions.length)}</CardHead>
          <div style={{ padding:10 }}>
            {obsCollisions.map((c,i)=>{
              const r=robots.find(r=>r.id===c.robotId), o=obstacles.find(o=>o.id===c.obsId)
              return (
                <div key={i} style={{ fontSize:13, marginBottom:6, padding:'7px 10px', background:'#fffbeb', borderRadius:'var(--r)', border:'1px solid #fde68a' }}>
                  <span style={{ color:r?.color, fontWeight:700 }}>{r?.name}</span>{' ↔ '}<span style={{ fontWeight:700 }}>{o?.name}</span>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, fontVariantNumeric:'tabular-nums' }}>t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Collisions bord de table */}
      {borderCollisions.length>0 && (
        <Card style={{ borderColor:'var(--blue-mid)' }}>
          <CardHead accent="var(--blue)">{t.collBorderLabel(borderCollisions.length)}</CardHead>
          <div style={{ padding:10 }}>
            {borderCollisions.map((c,i)=>{
              const r=robots.find(r=>r.id===c.robotId)
              return (
                <div key={i} style={{ fontSize:13, marginBottom:6, padding:'7px 10px', background:'var(--blue-dim)', borderRadius:'var(--r)', border:'1px solid var(--blue-mid)' }}>
                  <span style={{ color:r?.color, fontWeight:700 }}>{r?.name}</span>{' ↔ '}{t.borderObs}
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, fontVariantNumeric:'tabular-nums' }}>t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {allCols.length===0 && robots.length>0 && (
        <div style={{
          marginBottom:10, padding:'10px 14px', borderRadius:'var(--r2)',
          background:'var(--green-dim)', border:'1px solid #bbf7d0',
          fontSize:13, color:'var(--green)', fontWeight:600,
          borderLeft:'3px solid var(--green)',
        }}>
          {t.noCollision}
        </div>
      )}

      {/* Trajectoires par robot */}
      {robots.map((r) => (
        <RobotTrajectory key={r.id} robot={r} t={t}
          defaultOpen={r.id === selectedRobotId || robots.length === 1}
          onPauseChange={(idx, v) => updateWaypointPause(r.id, idx, v)} />
      ))}

      {robots.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <button onClick={handleExport} style={{
            width:'100%', padding:'10px 14px', borderRadius:'var(--r2)',
            border:'1.5px solid var(--border)', background:'var(--surface)',
            color:'var(--text2)', fontSize:13, fontWeight:600, cursor:'pointer',
            boxShadow:'var(--shadow)', textAlign:'left',
            transition:'all .12s',
          }}>{t.exportJson}</button>
          <button onClick={handleExportGazebo} style={{
            width:'100%', padding:'10px 14px', borderRadius:'var(--r2)',
            border:'1.5px solid var(--blue-mid)', background:'var(--blue-dim)',
            color:'var(--blue)', fontSize:13, fontWeight:700, cursor:'pointer',
            boxShadow:'0 2px 8px rgba(109,40,217,.15)', textAlign:'left',
            transition:'all .12s',
          }}>{t.exportGazebo}</button>
        </div>
      )}

      {robots.length===0 && (
        <div style={{
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--r2)', overflow:'hidden', boxShadow:'var(--shadow)',
        }}>
          <CardHead>{t.howToUse}</CardHead>
          <div style={{ padding:'12px 14px', fontSize:13, color:'var(--text2)', lineHeight:2.1 }}>
            {t.howTo.map((s,i) => <div key={i}>{s}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
