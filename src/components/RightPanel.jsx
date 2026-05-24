import React, { useMemo, useState } from 'react'
import { useSimStore, computeSegments, getRobotPose, pushHistory } from '../store/simStore.js'
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

// ── Composants UI ──

function PauseInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={value} min={0} max={60} step={0.5}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }}
        style={{
          width: 50, padding: '3px 6px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          fontSize: 12, color: 'var(--text)',
        }} />
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
    </div>
  )
}

function CollisionBadge({ count, color, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 12px', borderRadius: 'var(--r)',
      background: `${color}18`,
      border: `1px solid ${color}44`,
      marginBottom: 6,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
        background: color, color: '#fff',
      }}>{count}</span>
    </div>
  )
}

function CollisionItem({ children, color }) {
  return (
    <div style={{
      fontSize: 12, marginBottom: 4, padding: '6px 10px',
      background: `${color}10`, borderRadius: 6,
      borderLeft: `3px solid ${color}`,
    }}>
      {children}
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: '9px 6px',
      background: 'var(--surface2)', borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, marginBottom: 4, letterSpacing: '.01em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text)', letterSpacing: '-.02em' }}>{value}</div>
    </div>
  )
}

const WP_ACCENT = ['#818cf8','#38bdf8','#34d399','#fbbf24','#f472b6','#a78bfa','#2dd4bf','#fb923c']
const wpAccent = idx => WP_ACCENT[idx % WP_ACCENT.length]

function MetricRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.01em' }}>{value}</span>
    </div>
  )
}

function SegRow({ seg, idx, robotColor, t, onRemove }) {
  const accent = wpAccent(idx)
  return (
    <div style={{
      margin: '0 0 10px',
      borderRadius: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Bandeau supérieur */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px 8px',
        borderLeft: `3px solid ${accent}`,
      }}>
        {/* Numéro élégant */}
        <div style={{
          fontSize: 18, fontWeight: 300, color: accent,
          letterSpacing: '-.04em', lineHeight: 1, flexShrink: 0, minWidth: 24,
          fontVariantNumeric: 'tabular-nums',
        }}>{String(idx + 1).padStart(2, '0')}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
            Départ à <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{seg.startTime} s</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            {Math.round(seg.from.x * 1000)}, {Math.round(seg.from.y * 1000)}
            <span style={{ margin: '0 4px', color: 'var(--border)', fontSize: 10 }}>→</span>
            {Math.round(seg.to.x * 1000)}, {Math.round(seg.to.y * 1000)} <span style={{ fontSize: 10 }}>mm</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {seg.pause > 0 && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'var(--yellow-dim)', color: 'var(--yellow)', fontWeight: 500,
            }}>+{seg.pause} s</span>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              title="Supprimer ce waypoint"
              style={{
                width: 24, height: 24, borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text3)', fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red)11' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
            >×</button>
          )}
        </div>
      </div>

      {/* Métriques */}
      <div style={{ padding: '2px 12px 4px' }}>
        <MetricRow label={t.segDistance} value={seg.dist + ' mm'} />
        <MetricRow label={t.segMotion}   value={seg.duration + ' s'} />
        <MetricRow label={t.segHeading}  value={seg.angle + '°'} />
        {seg.relAngle !== null && (
          <MetricRow label={t.segTurn} value={(seg.relAngle > 0 ? '+' : '') + seg.relAngle + '°'} />
        )}
        {seg.rotDuration > 0 && (
          <MetricRow label={t.segRotation} value={seg.rotDuration + ' s'} />
        )}
      </div>
    </div>
  )
}

function RobotTrajectory({ robot, defaultOpen, onPauseChange, onRemoveWaypoint, t }) {
  const [open, setOpen] = useState(defaultOpen)
  const segments = useMemo(() => computeSegments(robot), [robot])
  const totalDistMm = segments.reduce((a,s) => a + s.dist, 0)
  const totalTime   = segments.reduce((a,s) => a + s.duration + s.rotDuration, 0) + (robot.startDelay ?? 0)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${robot.color}`,
      borderRadius: 'var(--r2)',
      marginBottom: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
          cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: robot.color,
          flexShrink: 0, boxShadow: `0 0 6px ${robot.color}90`,
        }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {robot.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, flexShrink: 0 }}>{totalDistMm} mm</span>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, flexShrink: 0 }}>{totalTime.toFixed(1)} s</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <StatPill label={t.segDistance} value={totalDistMm > 0 ? totalDistMm + ' mm' : '—'} color="var(--accent)" />
            <StatPill label={t.segMotion}   value={totalTime > 0 ? totalTime.toFixed(1) + ' s' : '—'} />
            <StatPill label="Pts"           value={segments.length} color="var(--purple)" />
          </div>

          {segments.length === 0 ? (
            <div style={{ padding: 14, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t.noWaypoints}</div>
          ) : (
            <div style={{ padding: '10px 12px 4px' }}>
              {segments.map((seg, i) => (
                <div key={i}>
                  <SegRow seg={seg} idx={i} robotColor={robot.color} t={t}
                    onRemove={onRemoveWaypoint ? () => onRemoveWaypoint(i) : null} />
                  {onPauseChange && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-4px 0 10px', padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1, fontWeight: 400 }}>{t.pauseOnArrival}</span>
                      <PauseInput value={robot.waypoints[i]?.pause ?? 0} onChange={v => onPauseChange(i, v)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function RightPanel() {
  const t = useT()
  const updateWaypointPause = useSimStore(s => s.updateWaypointPause)
  const removeWaypoint  = useSimStore(s => s.removeWaypoint)
  const robots          = useSimStore(s => s.robots)
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const collisions      = useSimStore(s => s.collisions)
  const obsCollisions   = useSimStore(s => s.obsCollisions)
  const borderCollisions= useSimStore(s => s.borderCollisions)
  const obstacles       = useSimStore(s => s.obstacles)
  const simMaxTime      = useSimStore(s => s.simMaxTime)

  const allCols = [...collisions, ...obsCollisions, ...borderCollisions]

  const handleExportGazebo = () => {
    const sdf = generateGazeboSDF(robots, obstacles, simMaxTime)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([sdf], { type: 'application/xml' }))
    a.download = 'pamis_world.world'; a.click()
  }

  const handleExport = () => {
    const data = robots.map(r => ({
      name: r.name, color: r.color,
      startPosition: { x_mm: Math.round(r.x*1000), y_mm: Math.round(r.y*1000) },
      startHeading_deg: r.heading,
      startDelay_s: r.startDelay,
      speed_mm_s: Math.round(r.speed*1000),
      radius_mm: Math.round(r.radius*1000),
      segments: computeSegments(r).map(s => ({
        from: { x_mm: Math.round(s.from.x*1000), y_mm: Math.round(s.from.y*1000) },
        to:   { x_mm: Math.round(s.to.x*1000),   y_mm: Math.round(s.to.y*1000) },
        distance_mm: s.dist, heading_deg: s.angle, rotation_deg: s.relAngle,
        start_time_s: s.startTime, duration_s: s.duration, pause_s: s.pause,
      })),
    }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    a.download = 'pamis_trajectoires.json'; a.click()
  }

  return (
    <div style={{
      width: 260, height: '100%', overflowY: 'auto', flexShrink: 0,
      padding: 10, borderLeft: '1px solid var(--border)', background: 'var(--bg)',
    }}>

      {/* ── Collisions ── */}
      {collisions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <CollisionBadge count={collisions.length} color="var(--red)" label={t.collRobotLabel(collisions.length)} />
          {collisions.map((c, i) => {
            const a = robots.find(r => r.id === c.aId)
            const b = robots.find(r => r.id === c.bId)
            return (
              <CollisionItem key={i} color="var(--red)">
                <span style={{ color: a?.color, fontWeight: 700 }}>{a?.name}</span>
                {' ↔ '}
                <span style={{ color: b?.color, fontWeight: 700 }}>{b?.name}</span>
                <div className="tabular" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm
                </div>
              </CollisionItem>
            )
          })}
        </div>
      )}

      {obsCollisions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <CollisionBadge count={obsCollisions.length} color="var(--red)" label={t.collObsLabel(obsCollisions.length)} />
          {obsCollisions.map((c, i) => {
            const r = robots.find(r => r.id === c.robotId)
            const o = obstacles.find(o => o.id === c.obsId)
            return (
              <CollisionItem key={i} color="var(--red)">
                <span style={{ color: r?.color, fontWeight: 700 }}>{r?.name}</span>
                {' ↔ '}
                <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{o?.name}</span>
                <div className="tabular" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm
                </div>
              </CollisionItem>
            )
          })}
        </div>
      )}

      {borderCollisions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <CollisionBadge count={borderCollisions.length} color="var(--red)" label={t.collBorderLabel(borderCollisions.length)} />
          {borderCollisions.map((c, i) => {
            const r = robots.find(r => r.id === c.robotId)
            return (
              <CollisionItem key={i} color="var(--red)">
                <span style={{ color: r?.color, fontWeight: 700 }}>{r?.name}</span>
                {' ↔ '}
                <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{t.borderObs}</span>
                <div className="tabular" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  t={c.t}s · ({Math.round(c.x*1000)}, {Math.round(c.y*1000)}) mm
                </div>
              </CollisionItem>
            )
          })}
        </div>
      )}

      {allCols.length === 0 && robots.length > 0 && (
        <div style={{
          marginBottom: 8, padding: '8px 12px', borderRadius: 'var(--r2)',
          background: 'var(--green-dim)', border: '1px solid var(--green)',
          fontSize: 12, color: 'var(--green)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span>✓</span> {t.noCollision}
        </div>
      )}

      {/* ── Trajectoires ── */}
      {robots.map(r => (
        <RobotTrajectory
          key={r.id} robot={r} t={t}
          defaultOpen={r.id === selectedRobotId || robots.length === 1}
          onPauseChange={(idx, v) => updateWaypointPause(r.id, idx, v)}
          onRemoveWaypoint={idx => { pushHistory({ robots, obstacles }); removeWaypoint(r.id, idx) }}
        />
      ))}

      {/* ── Export ── */}
      {robots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <button onClick={handleExport} style={{
            width: '100%', padding: '10px 0', borderRadius: 'var(--r2)',
            border: '1px solid var(--accent-mid)', background: 'var(--accent-dim)',
            color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all .15s',
          }}>{t.exportJson}</button>
          <button onClick={handleExportGazebo} style={{
            width: '100%', padding: '10px 0', borderRadius: 'var(--r2)',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all .15s',
          }}>{t.exportGazebo}</button>
        </div>
      )}

      {/* ── Aide ── */}
      {robots.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: '3px solid var(--purple)',
          borderRadius: 'var(--r2)', overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '9px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
              {t.howToUse}
            </span>
          </div>
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 2 }}>
            {t.howTo.map((s, i) => <div key={i}>{s}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
