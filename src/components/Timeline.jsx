import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { useSimStore, computeSegments, detectCollisions, detectObstacleCollisions, detectBorderCollisions } from '../store/simStore.js'
import { useT } from '../i18n.js'

const TRACK_H = 18
const LABEL_W = 80

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <polygon points="3,1 13,7 3,13" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="1" width="4" height="12" rx="1" />
      <rect x="8" y="1" width="4" height="12" rx="1" />
    </svg>
  )
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="2.5" height="12" rx="1" />
      <polygon points="5,2 13,7 5,12" />
    </svg>
  )
}

export default function Timeline() {
  const simPlaying    = useSimStore(s => s.simPlaying)
  const setSimPlaying = useSimStore(s => s.setSimPlaying)
  const simTime       = useSimStore(s => s.simTime)
  const setSimTime    = useSimStore(s => s.setSimTime)
  const simMaxTime    = useSimStore(s => s.simMaxTime)
  const setSimMaxTime = useSimStore(s => s.setSimMaxTime)
  const simSpeed      = useSimStore(s => s.simSpeed)
  const setSimSpeed   = useSimStore(s => s.setSimSpeed)
  const robots        = useSimStore(s => s.robots)
  const obstacles     = useSimStore(s => s.obstacles)
  const tableW        = useSimStore(s => s.tableW)
  const tableH        = useSimStore(s => s.tableH)

  const setCollisions      = useSimStore(s => s.setCollisions)
  const setObsCollisions   = useSimStore(s => s.setObsCollisions)
  const setBorderCollisions= useSimStore(s => s.setBorderCollisions)

  const rafRef        = useRef(null)
  const lastRef       = useRef(null)
  const simTimeRef    = useRef(simTime)
  const simSpeedRef   = useRef(simSpeed)
  const simMaxTimeRef = useRef(simMaxTime)
  const trackRef      = useRef(null)

  const t = useT()

  useEffect(() => { simTimeRef.current    = simTime    }, [simTime])
  useEffect(() => { simSpeedRef.current   = simSpeed   }, [simSpeed])
  useEffect(() => { simMaxTimeRef.current = simMaxTime }, [simMaxTime])

  // Boucle de simulation
  useEffect(() => {
    if (!simPlaying) { cancelAnimationFrame(rafRef.current); lastRef.current = null; return }
    const tick = ts => {
      if (lastRef.current !== null) {
        const next = simTimeRef.current + (ts - lastRef.current) / 1000 * simSpeedRef.current
        if (next >= simMaxTimeRef.current) { setSimTime(simMaxTimeRef.current); setSimPlaying(false); return }
        setSimTime(next)
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [simPlaying])

  // Détection des collisions
  useEffect(() => {
    setCollisions(robots.length >= 2 ? detectCollisions(robots, simMaxTime) : [])
    setObsCollisions(robots.length > 0 && obstacles.length > 0 ? detectObstacleCollisions(robots, obstacles, simMaxTime) : [])
    setBorderCollisions(robots.length > 0 ? detectBorderCollisions(robots, tableW, tableH, simMaxTime) : [])
  }, [robots, obstacles, simMaxTime, tableW, tableH])

  // Calcul des plages de temps par robot
  const robotTimelines = useMemo(() => robots.map(r => {
    const segs = computeSegments(r)
    const start = r.startDelay ?? 0
    const duration = segs.reduce((a, s) => a + s.duration + s.rotDuration + (s.pause ?? 0), 0)
    return { id: r.id, name: r.name, color: r.color, start, end: start + duration }
  }), [robots])

  const handleTrackClick = useCallback(e => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setSimPlaying(false)
    setSimTime(ratio * simMaxTime)
  }, [simMaxTime])

  const handlePlayPause = () => {
    if (simTime >= simMaxTime) setSimTime(0)
    setSimPlaying(!simPlaying)
  }

  const pct = simMaxTime > 0 ? (simTime / simMaxTime) * 100 : 0

  const hasRobots = robotTimelines.length > 0
  const tracksHeight = hasRobots ? Math.min(robotTimelines.length, 5) * (TRACK_H + 4) + 8 : 0

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
      userSelect: 'none',
    }}>

      {/* ── Pistes par robot ── */}
      {hasRobots && (
        <div style={{
          padding: '6px 14px 0',
          maxHeight: 5 * (TRACK_H + 4) + 14,
          overflowY: 'auto',
        }}>
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            style={{ position: 'relative', cursor: 'crosshair' }}
          >
            {robotTimelines.map(rt => {
              const startPct = simMaxTime > 0 ? (rt.start / simMaxTime) * 100 : 0
              const widthPct = simMaxTime > 0 ? Math.max(0, (rt.end - rt.start) / simMaxTime * 100) : 0
              return (
                <div key={rt.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 4, height: TRACK_H,
                }}>
                  {/* Label */}
                  <div style={{
                    width: LABEL_W, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                    overflow: 'hidden',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: rt.color, flexShrink: 0,
                      boxShadow: `0 0 6px ${rt.color}80`,
                    }} />
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{rt.name}</span>
                  </div>

                  {/* Piste */}
                  <div style={{ flex: 1, position: 'relative', height: TRACK_H }}>
                    {/* Fond de piste */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'var(--surface3)',
                      borderRadius: 4,
                    }} />
                    {/* Barre active */}
                    {widthPct > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        top: 3, bottom: 3,
                        background: rt.color,
                        opacity: 0.7,
                        borderRadius: 3,
                        minWidth: 3,
                      }} />
                    )}
                    {/* Point de départ */}
                    {rt.start > 0 && startPct > 0 && startPct < 100 && (
                      <div style={{
                        position: 'absolute',
                        left: `${startPct}%`,
                        top: 0, bottom: 0, width: 2,
                        background: rt.color, opacity: 0.5,
                        borderRadius: 1,
                      }} />
                    )}
                  </div>
                </div>
              )
            })}

            {/* Playhead */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0,
              left: `calc(${LABEL_W}px + 8px + (100% - ${LABEL_W}px - 8px) * ${pct / 100})`,
              width: 2,
              background: 'var(--accent)',
              borderRadius: 2,
              pointerEvents: 'none',
              boxShadow: `0 0 8px var(--accent)`,
              zIndex: 2,
            }}>
              <div style={{
                position: 'absolute', top: -4, left: '50%',
                transform: 'translateX(-50%)',
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Transport ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
      }}>

        {/* Boutons transport */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => { setSimPlaying(false); setSimTime(0) }}
            title={t.reset}
            style={{
              width: 32, height: 32, borderRadius: 'var(--r)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <ResetIcon />
          </button>

          <button
            onClick={handlePlayPause}
            title={simPlaying ? t.pause : t.play}
            style={{
              width: 40, height: 32, borderRadius: 'var(--r)',
              background: simPlaying ? 'var(--accent)' : 'var(--green)',
              border: 'none', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
              boxShadow: simPlaying ? '0 2px 8px var(--accent-mid)' : '0 2px 8px var(--green-dim)',
            }}
          >
            {simPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>

        {/* Affichage du temps */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 3,
          padding: '0 10px', borderRadius: 'var(--r)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          height: 32, flexShrink: 0,
        }}>
          <span className="tabular" style={{
            fontSize: 14, fontWeight: 700, color: 'var(--accent)',
            minWidth: 38, textAlign: 'right',
          }}>
            {simTime.toFixed(1)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>s</span>
          <span style={{ fontSize: 12, color: 'var(--border2)', margin: '0 2px' }}>/</span>
          <span className="tabular" style={{ fontSize: 12, color: 'var(--text3)' }}>{simMaxTime}s</span>
        </div>

        {/* Slider de timeline */}
        <div style={{ flex: 1, position: 'relative', height: 32, display: 'flex', alignItems: 'center' }}>
          <input
            type="range" min={0} max={simMaxTime} step={0.05} value={simTime}
            onMouseDown={() => setSimPlaying(false)}
            onChange={e => { setSimPlaying(false); setSimTime(+e.target.value) }}
            style={{
              width: '100%', cursor: 'pointer',
              accentColor: 'var(--accent)', height: 4,
            }}
          />
        </div>

        {/* Vitesse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>×</span>
          <select
            value={simSpeed} onChange={e => setSimSpeed(+e.target.value)}
            style={{
              padding: '5px 6px', borderRadius: 'var(--r)',
              border: '1px solid var(--border)', background: 'var(--surface2)',
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              cursor: 'pointer', height: 32,
            }}
          >
            {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Durée max */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          padding: '0 8px', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', background: 'var(--surface2)',
          height: 32,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.duration}</span>
          <input
            type="number" min={5} max={120} step={5} value={simMaxTime}
            onChange={e => setSimMaxTime(+e.target.value)}
            style={{
              width: 44, padding: '0 2px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
        </div>
      </div>
    </div>
  )
}
