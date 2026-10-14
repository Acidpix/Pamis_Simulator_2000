import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSimStore, computeSegments, getRobotPose, pushHistory } from '../store/simStore.js'
import { useT } from '../i18n.js'
import { Icon, TrashBtn, WP_TYPES, WP_TYPE_ICON, WP_TYPE_COLOR, WP_TYPE_LABEL, WP_TYPE_DESC } from './Icons.jsx'

const TABLE_W = 3.0
const TABLE_H = 2.0

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16)
  return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 }
}

export function generateGazeboSDF(robots, obstacles, simMaxTime, step = 0.1) {
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

function HeadingInput({ value, onChange }) {
  const enabled = value != null
  const norm = v => ((v % 360) + 360) % 360
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="checkbox" checked={enabled}
        onChange={e => onChange(e.target.checked ? 0 : null)}
        style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
      <input type="number" value={enabled ? Math.round(norm(value)) : ''}
        placeholder="auto" min={0} max={359} step={1} disabled={!enabled}
        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(norm(v)) }}
        style={{
          width: 50, padding: '3px 6px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          fontSize: 12, color: 'var(--text)', opacity: enabled ? 1 : 0.5,
        }} />
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>°</span>
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
      <span style={{ fontSize: 12, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={14} />{label}</span>
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
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, marginBottom: 4, letterSpacing: '.01em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || 'var(--text)', letterSpacing: '-.02em' }}>{value}</div>
    </div>
  )
}

const WP_ACCENT = ['#818cf8','#38bdf8','#34d399','#fbbf24','#f472b6','#a78bfa','#2dd4bf','#fb923c']
const wpAccent = idx => WP_ACCENT[idx % WP_ACCENT.length]

const miniInput = {
  flex: 1, minWidth: 0, padding: '3px 5px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface2)', fontSize: 12, color: 'var(--text)',
}

// Champ X/Y en mm (valeur stockée en mètres)
function MmInput({ label, value, max, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <input type="number" value={Math.round((value ?? 0) * 1000)} min={0} max={max} step={1}
        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(v / 1000) }}
        style={miniInput} />
      <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>mm</span>
    </div>
  )
}

function Row({ label, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: color || 'var(--text)', flex: 1, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  )
}

function TypeToggle({ value, onChange, t }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', borderRadius: 'var(--r)', padding: 3 }}>
      {WP_TYPES.map(type => {
        const active = value === type, c = WP_TYPE_COLOR[type]
        return (
          <button key={type} onClick={() => onChange(type)} title={t[WP_TYPE_DESC[type]]} style={{
            flex: 1, padding: '5px 2px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all .12s',
            background: active ? c : 'transparent', color: active ? '#fff' : 'var(--text3)',
            boxShadow: active ? `0 1px 6px ${c}66` : 'none',
          }}>
            <Icon name={WP_TYPE_ICON[type]} size={13} />{t[WP_TYPE_LABEL[type]]}
          </button>
        )
      })}
    </div>
  )
}

// Fiche d'un waypoint : en-tête toujours visible (clic = replier/déplier) + détails
function WaypointCard({ robot, idx, seg, open, onToggle, ops, t }) {
  const wp = robot.waypoints[idx]
  const type = wp.type ?? 'point'
  const accent = wpAccent(idx)
  const isPass = type === 'pass'
  return (
    <div style={{
      marginBottom: 8, background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${accent}`, borderRadius: 8, overflow: 'hidden',
    }}>
      {/* En-tête */}
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer',
        borderBottom: open ? '1px solid var(--border)' : 'none', background: open ? 'var(--surface2)' : 'transparent',
      }}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} color="var(--text3)" />
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          background: `${accent}28`, color: accent,
        }}>#{idx + 1}</span>
        <span title={t[WP_TYPE_LABEL[type]]} style={{ display: 'flex', color: WP_TYPE_COLOR[type] }}>
          <Icon name={WP_TYPE_ICON[type]} size={15} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.segStartAt} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{seg.startTime} s</span>
        </span>
        {seg.pause > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'var(--yellow-dim)', color: 'var(--yellow)', fontWeight: 600 }}>
            <Icon name="timer" size={11} />{seg.pause}s
          </span>
        )}
        {seg.actionPause > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#7048e822', color: '#9b72f5', fontWeight: 600 }}>
            <Icon name="action" size={11} />{seg.actionPause}s
          </span>
        )}
        {wp.reverse && !isPass && <span title={t.reverse} style={{ display: 'flex', color: '#f97316' }}><Icon name="reverse" size={13} /></span>}
        <TrashBtn onClick={ops.remove} title={t.deleteWp} size={24} />
      </div>

      {open && (
        <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TypeToggle value={type} onChange={ops.type} t={t} />

          {/* Métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {[
              { l: t.segDistance, v: seg.dist + ' mm' },
              { l: t.segMotion,   v: seg.duration + ' s' },
              { l: t.segHeading,  v: seg.angle + '°' },
              { l: t.segTurn,     v: seg.relAngle !== null ? (seg.relAngle > 0 ? '+' : '') + seg.relAngle + '°' : '—' },
              ...(seg.rotDuration > 0 ? [{ l: t.segRotation, v: seg.rotDuration + ' s' }] : []),
              ...(seg.arrRotDuration > 0 ? [{ l: t.segArrRotation, v: seg.arrRotDuration + ' s' }] : []),
            ].map(({ l, v }) => (
              <div key={l} style={{ padding: '3px 0' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, marginBottom: 1, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Position */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <MmInput label="X" value={wp.x} max={3000} onChange={v => ops.move(v, wp.y)} />
            <MmInput label="Y" value={wp.y} max={2000} onChange={v => ops.move(wp.x, v)} />
          </div>

          {/* Poignées de Bézier */}
          {type === 'bezier' && wp.c1 && wp.c2 && ['c1', 'c2'].map((k, n) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: WP_TYPE_COLOR.bezier, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{n === 0 ? t.ctrl1 : t.ctrl2}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <MmInput label="X" value={wp[k].x} max={3000} onChange={v => ops.ctrl(k, v, wp[k].y)} />
                <MmInput label="Y" value={wp[k].y} max={2000} onChange={v => ops.ctrl(k, wp[k].x, v)} />
              </div>
            </div>
          ))}

          {isPass ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{t.wpTypePassDesc}</div>
          ) : (
            <>
              <Row label={t.pauseOnArrival}><PauseInput value={wp.pause ?? 0} onChange={ops.pause} /></Row>
              <Row label={t.actionLabel} color="#9b72f5"><PauseInput value={wp.actionPause ?? 0} onChange={ops.action} /></Row>
              <Row label={t.arrivalHeading}><HeadingInput value={wp.heading ?? null} onChange={ops.heading} /></Row>
              {!robot.holonomic && (
                <Row label={t.reverse} color={wp.reverse ? '#f97316' : 'var(--text)'}>
                  <button onClick={() => ops.reverse(!wp.reverse)} style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: wp.reverse ? '#f97316' : 'var(--surface3)', transition: 'all .2s', position: 'relative',
                  }}>
                    <span style={{ position: 'absolute', top: 3, left: wp.reverse ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                  </button>
                </Row>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RobotTrajectory({ robot, defaultOpen, makeOps, t }) {
  const [open, setOpen] = useState(defaultOpen)
  // Fiches dépliées : à l'ajout d'un waypoint, les précédentes se replient et la nouvelle se déplie
  const [openWps, setOpenWps] = useState(() => new Set())
  const prevIds = useRef(null)
  useEffect(() => {
    const ids = robot.waypoints.map(w => w.id)
    if (prevIds.current !== null) {
      const known = new Set(prevIds.current)
      const added = ids.filter(id => !known.has(id))
      if (added.length === 1) setOpenWps(new Set(added))
      else if (added.length > 1) setOpenWps(new Set())
      else setOpenWps(o => new Set(ids.filter(id => o.has(id))))
    }
    prevIds.current = ids
  }, [robot.waypoints])
  const toggleWp = id => setOpenWps(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const segments = useMemo(() => computeSegments(robot), [robot])
  const totalDistMm = segments.reduce((a,s) => a + s.dist, 0)
  const totalTime   = segments.reduce((a,s) => a + s.rotDuration + s.duration + (s.arrRotDuration||0) + (s.pause||0) + (s.actionPause||0), 0) + (robot.startDelay ?? 0)

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
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color="var(--text3)" />
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
              {segments.map((seg, i) => {
                const wp = robot.waypoints[i]
                return (
                  <WaypointCard key={wp.id ?? i} robot={robot} idx={i} seg={seg} t={t}
                    open={openWps.has(wp.id)} onToggle={() => toggleWp(wp.id)} ops={makeOps(robot, i)} />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Export JSON des trajectoires (utilisé aussi par la Toolbar)
export function exportTrajectories(robots) {
  const mm = v => Math.round(v * 1000)
  const data = robots.map(r => ({
    name: r.name, color: r.color,
    startPosition: { x_mm: mm(r.x), y_mm: mm(r.y) },
    startHeading_deg: r.heading,
    startDelay_s: r.startDelay,
    speed_mm_s: mm(r.speed),
    radius_mm: mm(r.radius),
    lookahead_mm: mm(r.lookahead ?? 0.15),
    segments: computeSegments(r).map((s, i) => {
      const wp = r.waypoints[i]
      return {
        type: s.type,
        from: { x_mm: mm(s.from.x), y_mm: mm(s.from.y) },
        to:   { x_mm: mm(s.to.x),   y_mm: mm(s.to.y) },
        ...(s.type === 'bezier' && wp?.c1 && wp?.c2 ? {
          control1: { x_mm: mm(wp.c1.x), y_mm: mm(wp.c1.y) },
          control2: { x_mm: mm(wp.c2.x), y_mm: mm(wp.c2.y) },
        } : {}),
        distance_mm: s.dist, heading_deg: s.angle, rotation_deg: s.relAngle,
        start_time_s: s.startTime, duration_s: s.duration, pause_s: s.pause,
      }
    }),
  }))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = 'pamis_trajectoires.json'; a.click()
}

export default function RightPanel() {
  const t = useT()
  const updateWaypointPause = useSimStore(s => s.updateWaypointPause)
  const updateWaypointActionPause = useSimStore(s => s.updateWaypointActionPause)
  const updateWaypointHeading = useSimStore(s => s.updateWaypointHeading)
  const moveWaypoint          = useSimStore(s => s.moveWaypoint)
  const moveWaypointCtrl      = useSimStore(s => s.moveWaypointCtrl)
  const updateWaypointType    = useSimStore(s => s.updateWaypointType)
  const updateWaypointReverse = useSimStore(s => s.updateWaypointReverse)
  const removeWaypoint        = useSimStore(s => s.removeWaypoint)
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

  const handleExport = () => exportTrajectories(robots)

  // Panneau redimensionnable (poignée sur le bord gauche)
  const [panelW, setPanelW] = useState(340)
  const onResizeStart = useCallback(e => {
    e.preventDefault()
    const startX = e.clientX, startW = panelW
    const onMove = ev => setPanelW(Math.max(260, Math.min(600, startW - (ev.clientX - startX))))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelW])

  // Actions d'une fiche waypoint (l'historique est enregistré avant chaque modification structurelle)
  const makeOps = (r, idx) => ({
    remove:  () => { pushHistory({ robots, obstacles }); removeWaypoint(r.id, idx) },
    type:    v => { pushHistory({ robots, obstacles }); updateWaypointType(r.id, idx, v) },
    move:    (x, y) => moveWaypoint(r.id, idx, x, y),
    ctrl:    (k, x, y) => moveWaypointCtrl(r.id, idx, k, x, y),
    pause:   v => updateWaypointPause(r.id, idx, v),
    action:  v => updateWaypointActionPause(r.id, idx, v),
    heading: v => updateWaypointHeading(r.id, idx, v),
    reverse: v => { pushHistory({ robots, obstacles }); updateWaypointReverse(r.id, idx, v) },
  })

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      <div
        onMouseDown={onResizeStart}
        style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, transition: 'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
      />
    <div style={{
      width: panelW, height: '100%', overflowY: 'auto', flexShrink: 0, boxSizing: 'border-box',
      padding: 10, background: 'var(--bg)',
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
          <Icon name="check" size={14} /> {t.noCollision}
        </div>
      )}

      {/* ── Trajectoires ── */}
      {robots.map(r => (
        <RobotTrajectory
          key={r.id} robot={r} t={t}
          defaultOpen={r.id === selectedRobotId || robots.length === 1}
          makeOps={makeOps}
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
    </div>
  )
}
