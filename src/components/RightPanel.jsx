import React, { useMemo } from 'react'
import { useSimStore, computeSegments } from '../store/simStore.js'

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, marginBottom: 10, overflow: 'hidden',
      boxShadow: 'var(--shadow)', ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ children, color }) {
  return (
    <div style={{
      padding: '9px 14px', borderBottom: '1px solid var(--border)',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', color: color || 'var(--text3)',
    }}>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function SegRow({ seg, idx, color }) {
  return (
    <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
          background: color + '20', color: color,
        }}>#{idx + 1}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>départ à {seg.startTime}s</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { l: 'Distance', v: seg.dist + ' mm' },
          { l: 'Durée', v: seg.duration + ' s' },
          { l: 'Cap', v: seg.angle + '°' },
          { l: 'Rotation', v: seg.relAngle !== null ? (seg.relAngle > 0 ? '+' : '') + seg.relAngle + '°' : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text3)' }}>
        ({seg.from.x.toFixed(2)}, {seg.from.y.toFixed(2)}) → ({seg.to.x.toFixed(2)}, {seg.to.y.toFixed(2)}) m
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

  const totalDist = segments.reduce((a, s) => a + s.dist, 0)
  const totalTime = selected
    ? segments.reduce((a, s) => a + s.duration, 0) + (selected?.startDelay ?? 0)
    : 0

  const handleExport = () => {
    const data = robots.map(r => ({
      name: r.name, color: r.color,
      startPosition: { x: r.x, y: r.y },
      startDelay: r.startDelay, speed: r.speed, radius: r.radius,
      segments: computeSegments(r).map(s => ({
        from: { x: Math.round(s.from.x * 1000), y: Math.round(s.from.y * 1000) },
        to:   { x: Math.round(s.to.x * 1000),   y: Math.round(s.to.y * 1000) },
        distance_mm: s.dist, heading_deg: s.angle,
        rotation_deg: s.relAngle, start_time_s: s.startTime, duration_s: s.duration,
      })),
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pamis_trajectoires.json'
    a.click()
  }

  return (
    <div style={{
      width: 240, height: '100%', overflowY: 'auto', flexShrink: 0,
      padding: 12, borderLeft: '1px solid var(--border)', background: 'var(--bg)',
    }}>
      {/* Collisions */}
      {collisions.length > 0 && (
        <Card style={{ borderColor: '#fca5a5' }}>
          <CardHead color="var(--red)">⚠ {collisions.length} collision{collisions.length > 1 ? 's' : ''}</CardHead>
          <div style={{ padding: 10 }}>
            {collisions.map((c, i) => {
              const a = robots.find(r => r.id === c.aId)
              const b = robots.find(r => r.id === c.bId)
              return (
                <div key={i} style={{ fontSize: 12, marginBottom: 6, padding: '6px 8px', background: 'var(--red-dim)', borderRadius: 6 }}>
                  <span style={{ color: a?.color, fontWeight: 600 }}>{a?.name}</span>
                  {' ↔ '}
                  <span style={{ color: b?.color, fontWeight: 600 }}>{b?.name}</span>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>t = {c.t}s — ({c.x.toFixed(2)}, {c.y.toFixed(2)}) m</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {collisions.length === 0 && robots.length > 1 && (
        <div style={{
          marginBottom: 10, padding: '8px 12px', borderRadius: 8,
          background: 'var(--green-dim)', border: '1px solid #bbf7d0',
          fontSize: 12, color: 'var(--green)', fontWeight: 500,
        }}>
          ✓ Aucune collision détectée
        </div>
      )}

      {/* Trajectoire robot sélectionné */}
      {selected && (
        <Card>
          <CardHead>
            <span style={{ color: selected.color }}>●</span> {selected.name} — Trajectoire
          </CardHead>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
            <Stat label="Distance" value={totalDist > 0 ? (totalDist / 1000).toFixed(2) + ' m' : '—'} color="var(--blue)" />
            <Stat label="Durée" value={totalTime > 0 ? totalTime.toFixed(1) + ' s' : '—'} />
            <Stat label="Points" value={segments.length} />
          </div>

          {segments.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
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
            const dur = segs.reduce((a, s) => a + s.duration, 0) + r.startDelay
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{dist}mm</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{dur.toFixed(1)}s</span>
              </div>
            )
          })}
        </Card>
      )}

      {/* Export */}
      {robots.length > 0 && (
        <button onClick={handleExport} style={{
          width: '100%', padding: 10, borderRadius: 8,
          border: '1.5px solid var(--border2)', background: 'var(--surface)',
          color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: 'var(--shadow)',
        }}>
          ⬇ Exporter JSON
        </button>
      )}

      {/* Aide */}
      {robots.length === 0 && (
        <Card>
          <CardHead>Comment utiliser</CardHead>
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
            <div>① Ajoutez un robot (panneau gauche)</div>
            <div>② Mode <strong>Tracer</strong> → cliquez sur la table</div>
            <div>③ Appuyez sur <strong>▶ Simuler</strong></div>
            <div>④ Scroll pour zoomer sur la table</div>
          </div>
        </Card>
      )}
    </div>
  )
}
