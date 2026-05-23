import React, { useMemo } from 'react'
import { useSimStore, computeSegments } from '../store/simStore.js'

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)', ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ children, color }) {
  return (
    <div style={{
      padding: '9px 14px', borderBottom: '1px solid #e2e8f0',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', color: color || '#94a3b8',
    }}>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function SegRow({ seg, idx, color }) {
  return (
    <div style={{ padding: '9px 14px', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: color + '22', color }}>
          #{idx + 1}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>départ à {seg.startTime}s</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { l: 'Distance', v: seg.dist + ' cm' },
          { l: 'Durée', v: seg.duration + ' s' },
          { l: 'Cap', v: seg.angle + '°' },
          { l: 'Rotation', v: seg.relAngle !== null ? (seg.relAngle > 0 ? '+' : '') + seg.relAngle + '°' : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: '#94a3b8' }}>
        ({Math.round(seg.from.x*100)}, {Math.round(seg.from.y*100)}) → ({Math.round(seg.to.x*100)}, {Math.round(seg.to.y*100)}) cm
      </div>
    </div>
  )
}

export default function RightPanel() {
  const robots = useSimStore(s => s.robots)
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const collisions = useSimStore(s => s.collisions)

  const selected = robots.find(r => r.id === selectedRobotId)
  const segments = useMemo(() => selected ? computeSegments(selected) : [], [selected])

  const totalDistCm = segments.reduce((a, s) => a + s.dist, 0)
  const totalTime   = selected
    ? segments.reduce((a, s) => a + s.duration, 0) + (selected?.startDelay ?? 0)
    : 0

  const handleExport = () => {
    const data = robots.map(r => ({
      name: r.name, color: r.color,
      startPosition: { x_cm: Math.round(r.x * 100), y_cm: Math.round(r.y * 100) },
      startHeading_deg: r.heading,
      startDelay_s: r.startDelay,
      speed_cm_s: Math.round(r.speed * 100),
      radius_cm: Math.round(r.radius * 100),
      segments: computeSegments(r).map(s => ({
        from: { x_cm: Math.round(s.from.x * 100), y_cm: Math.round(s.from.y * 100) },
        to:   { x_cm: Math.round(s.to.x * 100),   y_cm: Math.round(s.to.y * 100) },
        distance_cm: s.dist,
        heading_deg: s.angle,
        rotation_deg: s.relAngle,
        start_time_s: s.startTime,
        duration_s: s.duration,
      })),
    }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'pamis_trajectoires.json'
    a.click()
  }

  return (
    <div style={{
      width: 246, height: '100%', overflowY: 'auto', flexShrink: 0,
      padding: 12, borderLeft: '1px solid #e2e8f0', background: '#f0f2f5',
    }}>
      {/* Collisions */}
      {collisions.length > 0 && (
        <Card style={{ borderColor: '#fca5a5' }}>
          <CardHead color="#dc2626">⚠ {collisions.length} collision{collisions.length > 1 ? 's' : ''}</CardHead>
          <div style={{ padding: 10 }}>
            {collisions.map((c, i) => {
              const a = robots.find(r => r.id === c.aId)
              const b = robots.find(r => r.id === c.bId)
              return (
                <div key={i} style={{ fontSize: 12, marginBottom: 6, padding: '6px 8px', background: '#fef2f2', borderRadius: 6 }}>
                  <span style={{ color: a?.color, fontWeight: 700 }}>{a?.name}</span>
                  {' ↔ '}
                  <span style={{ color: b?.color, fontWeight: 700 }}>{b?.name}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    t = {c.t}s · ({Math.round(c.x*100)}, {Math.round(c.y*100)}) cm
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {collisions.length === 0 && robots.length > 1 && (
        <div style={{
          marginBottom: 10, padding: '8px 12px', borderRadius: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 12, color: '#16a34a', fontWeight: 500,
        }}>
          ✓ Aucune collision détectée
        </div>
      )}

      {/* Trajectoire sélectionnée */}
      {selected && (
        <Card>
          <CardHead>
            <span style={{ color: selected.color }}>●</span> {selected.name} — Trajectoire
          </CardHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
            <Stat label="Distance" value={totalDistCm > 0 ? totalDistCm + ' cm' : '—'} color="#2563eb" />
            <Stat label="Durée" value={totalTime > 0 ? totalTime.toFixed(1) + ' s' : '—'} />
            <Stat label="Points" value={segments.length} />
          </div>
          {segments.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
              Cliquez sur la table en mode <strong>Tracer</strong> pour ajouter des waypoints.
            </div>
          ) : (
            segments.map((seg, i) => <SegRow key={i} seg={seg} idx={i} color={selected.color} />)
          )}
        </Card>
      )}

      {/* Résumé tous les robots */}
      {robots.length > 1 && (
        <Card>
          <CardHead>Tous les robots</CardHead>
          {robots.map(r => {
            const segs = computeSegments(r)
            const dist = segs.reduce((a, s) => a + s.dist, 0)
            const dur  = segs.reduce((a, s) => a + s.duration, 0) + r.startDelay
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderBottom: '1px solid #e2e8f0',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{dist} cm</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{dur.toFixed(1)}s</span>
              </div>
            )
          })}
        </Card>
      )}

      {robots.length > 0 && (
        <button onClick={handleExport} style={{
          width: '100%', padding: 10, borderRadius: 8,
          border: '1.5px solid #cbd5e1', background: '#fff',
          color: '#1e293b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          ⬇ Exporter JSON
        </button>
      )}

      {robots.length === 0 && (
        <Card>
          <CardHead>Comment utiliser</CardHead>
          <div style={{ padding: 12, fontSize: 12, color: '#475569', lineHeight: 1.9 }}>
            <div>① Ajoutez un robot (panneau gauche)</div>
            <div>② Mode <strong>Tracer</strong> → cliquez la table</div>
            <div>③ Définissez l'orientation de départ</div>
            <div>④ Appuyez sur <strong>▶ Simuler</strong></div>
            <div>⑤ Bouton <strong>🧊 3D</strong> pour la vue 3D</div>
          </div>
        </Card>
      )}
    </div>
  )
}
