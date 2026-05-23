import React, { useMemo } from 'react'
import { useSimStore, computeSegments } from '../store/simStore.js'

function angleArrow(deg) {
  if (deg === null) return '●'
  if (Math.abs(deg) < 5) return '→'
  if (deg > 0) return `↻ +${deg}°`
  return `↺ ${deg}°`
}

function SegmentRow({ seg, idx, color }) {
  return (
    <div style={{
      padding: '7px 8px',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, padding: '1px 5px',
          background: color + '22',
          border: `1px solid ${color}55`,
          borderRadius: 2,
          color: color,
        }}>SEG {idx + 1}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>t={seg.startTime}s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>DISTANCE</div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{seg.dist}<span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>mm</span></div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>CAP</div>
          <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 700 }}>{seg.angle}°</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>DURÉE</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{seg.duration}s</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ROTATION</div>
          <div style={{ fontSize: 11, color: seg.relAngle !== null ? 'var(--warn)' : 'var(--text-muted)' }}>
            {angleArrow(seg.relAngle)}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 5,
        fontSize: 9,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        ({Math.round(seg.from.x*100)/100}, {Math.round(seg.from.y*100)/100})
        {' → '}
        ({Math.round(seg.to.x*100)/100}, {Math.round(seg.to.y*100)/100})
      </div>
    </div>
  )
}

function CollisionAlert({ collision, robots }) {
  const a = robots.find(r => r.id === collision.aId)
  const b = robots.find(r => r.id === collision.bId)
  if (!a || !b) return null
  return (
    <div style={{
      padding: '6px 8px',
      background: 'var(--danger-dim)',
      border: '1px solid rgba(255,61,90,0.4)',
      borderRadius: 4,
      marginBottom: 5,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, marginBottom: 2 }}>
        ⚠ COLLISION t={collision.t}s
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
        <span style={{ color: a.color }}>{a.name}</span>
        {' ↔ '}
        <span style={{ color: b.color }}>{b.name}</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
        @ ({Math.round(collision.x*100)/100}m, {Math.round(collision.y*100)/100}m)
      </div>
    </div>
  )
}

export default function RightPanel() {
  const robots = useSimStore(s => s.robots)
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const collisions = useSimStore(s => s.collisions)
  const simTime = useSimStore(s => s.simTime)

  const selected = robots.find(r => r.id === selectedRobotId)
  const segments = useMemo(() => selected ? computeSegments(selected) : [], [selected])

  const totalDist = segments.reduce((acc, s) => acc + s.dist, 0)
  const totalTime = selected
    ? segments.reduce((acc, s) => acc + s.duration, 0) + (selected?.startDelay ?? 0)
    : 0

  const handleExport = () => {
    const data = robots.map(r => ({
      name: r.name,
      color: r.color,
      startPosition: { x: r.x, y: r.y },
      startDelay: r.startDelay,
      speed: r.speed,
      radius: r.radius,
      segments: computeSegments(r).map(s => ({
        from: { x: Math.round(s.from.x*1000), y: Math.round(s.from.y*1000) },
        to:   { x: Math.round(s.to.x*1000),   y: Math.round(s.to.y*1000) },
        distance_mm: s.dist,
        heading_deg: s.angle,
        rotation_deg: s.relAngle,
        start_time_s: s.startTime,
        duration_s: s.duration,
      })),
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'krabi_trajectoires.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
  }

  const sectionHeaderStyle = {
    padding: '8px 14px',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-display)',
    fontSize: 9,
    letterSpacing: '.15em',
    color: 'var(--accent)',
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      width: 230,
      height: '100%',
      overflowY: 'auto',
      padding: '12px 10px',
      borderLeft: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Collisions */}
      {collisions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...sectionHeaderStyle, color: 'var(--danger)', paddingLeft: 0 }}>
            ⚠ {collisions.length} Collision{collisions.length > 1 ? 's' : ''} détectée{collisions.length > 1 ? 's' : ''}
          </div>
          <div style={{ marginTop: 6 }}>
            {collisions.map((c, i) => (
              <CollisionAlert key={i} collision={c} robots={robots} />
            ))}
          </div>
        </div>
      )}

      {collisions.length === 0 && robots.length > 1 && (
        <div style={{
          marginBottom: 10, padding: '6px 10px',
          background: 'var(--accent2-dim)',
          border: '1px solid rgba(10,255,157,0.2)',
          borderRadius: 4,
          fontSize: 10,
          color: 'var(--accent2)',
          fontFamily: 'var(--font-mono)',
        }}>
          ✓ Aucune collision détectée
        </div>
      )}

      {/* Segments du robot sélectionné */}
      {selected && (
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={{ color: selected.color }}>{selected.name}</span> — Trajectoire
          </div>

          {/* Résumé */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1, borderBottom: '1px solid var(--border)',
          }}>
            {[
              { label: 'DISTANCE', value: totalDist + 'mm' },
              { label: 'DURÉE', value: totalTime.toFixed(1) + 's' },
              { label: 'SEGMENTS', value: segments.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Liste des segments */}
          {segments.length === 0 ? (
            <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              Cliquez sur la table en mode<br />
              <span style={{ color: 'var(--accent)' }}>Tracer</span> pour ajouter des waypoints
            </div>
          ) : (
            segments.map((seg, i) => (
              <SegmentRow key={i} seg={seg} idx={i} color={selected.color} />
            ))
          )}
        </div>
      )}

      {/* Tous les robots résumé */}
      {robots.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>Tous les robots</div>
          {robots.map(r => {
            const segs = computeSegments(r)
            const dist = segs.reduce((a, s) => a + s.dist, 0)
            const dur = segs.reduce((a, s) => a + s.duration, 0) + r.startDelay
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, boxShadow: `0 0 5px ${r.color}`, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{dist}mm</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{dur.toFixed(1)}s</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Export */}
      {robots.length > 0 && (
        <button
          onClick={handleExport}
          style={{
            width: '100%', padding: '9px',
            background: 'var(--accent-glow)',
            border: '1px solid var(--border-bright)',
            borderRadius: 5,
            color: 'var(--accent)',
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            letterSpacing: '.1em',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-glow)'}
        >
          ↓ EXPORTER JSON
        </button>
      )}

      {/* Aide */}
      <div style={{
        marginTop: 10,
        padding: '10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.7,
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>— Aide —</div>
        <div><span style={{ color: 'var(--accent)' }}>Clic table</span> → waypoint</div>
        <div><span style={{ color: 'var(--accent)' }}>Mode déplacer</span> → drag robot</div>
        <div><span style={{ color: 'var(--accent)' }}>Scroll</span> → zoom</div>
        <div><span style={{ color: 'var(--accent)' }}>▶ Simuler</span> → animation</div>
        <div><span style={{ color: 'var(--accent2)' }}>Angles</span> = cap absolu</div>
        <div><span style={{ color: 'var(--warn)' }}>Rotation</span> = relatif seg</div>
      </div>
    </div>
  )
}
