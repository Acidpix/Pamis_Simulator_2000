import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { useSimStore, computeSegments, detectCollisions, detectObstacleCollisions, detectBorderCollisions } from '../store/simStore.js'
import { useT } from '../i18n.js'

const TRACK_H = 20
const LABEL_W = 76

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <polygon points="2,1 11,6 2,11" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="3.5" height="10" rx="1" />
      <rect x="7" y="1" width="3.5" height="10" rx="1" />
    </svg>
  )
}
function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0.5" y="1" width="2.5" height="10" rx="1" />
      <polygon points="4,1.5 11,6 4,10.5" />
    </svg>
  )
}

export default function Timeline() {
  const simPlaying     = useSimStore(s => s.simPlaying)
  const setSimPlaying  = useSimStore(s => s.setSimPlaying)
  const simTime        = useSimStore(s => s.simTime)
  const setSimTime     = useSimStore(s => s.setSimTime)
  const simMaxTime     = useSimStore(s => s.simMaxTime)
  const setSimMaxTime  = useSimStore(s => s.setSimMaxTime)
  const simSpeed       = useSimStore(s => s.simSpeed)
  const setSimSpeed    = useSimStore(s => s.setSimSpeed)
  const robots         = useSimStore(s => s.robots)
  const obstacles      = useSimStore(s => s.obstacles)
  const tableW         = useSimStore(s => s.tableW)
  const tableH         = useSimStore(s => s.tableH)

  const setCollisions       = useSimStore(s => s.setCollisions)
  const setObsCollisions    = useSimStore(s => s.setObsCollisions)
  const setBorderCollisions = useSimStore(s => s.setBorderCollisions)

  const rafRef        = useRef(null)
  const lastRef       = useRef(null)
  const simTimeRef    = useRef(simTime)
  const simSpeedRef   = useRef(simSpeed)
  const simMaxTimeRef = useRef(simMaxTime)
  const trackAreaRef  = useRef(null)
  const isDragging    = useRef(false)

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

  // Calcul des plages de temps + waypoints par robot
  const robotTimelines = useMemo(() => robots.map(r => {
    const segs = computeSegments(r)
    const start = r.startDelay ?? 0
    const duration = segs.reduce((a, s) => a + s.duration + s.rotDuration + (s.pause ?? 0), 0)

    // Temps d'arrivée à chaque waypoint (hors waypoint de départ)
    const waypointTimes = segs.map(seg => seg.startTime + seg.rotDuration + seg.duration)

    return { id: r.id, name: r.name, color: r.color, start, end: start + duration, waypointTimes }
  }), [robots])

  // Seek depuis la zone de piste (clic ou drag)
  const seekFromEvent = useCallback(clientX => {
    if (!trackAreaRef.current) return
    const rect = trackAreaRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setSimTime(ratio * simMaxTimeRef.current)
  }, [])

  const handleTrackMouseDown = useCallback(e => {
    setSimPlaying(false)
    isDragging.current = true
    seekFromEvent(e.clientX)

    const onMove = ev => { if (isDragging.current) seekFromEvent(ev.clientX) }
    const onUp   = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [seekFromEvent])

  const handlePlayPause = () => {
    if (simTime >= simMaxTime) setSimTime(0)
    setSimPlaying(!simPlaying)
  }

  const pct = simMaxTime > 0 ? (simTime / simMaxTime) * 100 : 0
  const hasRobots = robotTimelines.length > 0

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
        <div style={{ padding: '6px 14px 0', maxHeight: 5 * (TRACK_H + 4) + 14, overflowY: 'auto' }}>
          {/* Zone de pistes draggable */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {robotTimelines.map(rt => {
              const startPct  = simMaxTime > 0 ? (rt.start / simMaxTime) * 100 : 0
              const widthPct  = simMaxTime > 0 ? Math.max(0, (rt.end - rt.start) / simMaxTime * 100) : 0

              return (
                <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, height: TRACK_H }}>
                  {/* Label robot */}
                  <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: rt.color, flexShrink: 0, boxShadow: `0 0 5px ${rt.color}90` }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rt.name}
                    </span>
                  </div>

                  {/* Piste cliquable/draggable */}
                  <div
                    ref={trackAreaRef}
                    onMouseDown={handleTrackMouseDown}
                    style={{ flex: 1, position: 'relative', height: TRACK_H, cursor: 'pointer' }}
                  >
                    {/* Fond */}
                    <div style={{ position: 'absolute', inset: 0, background: 'var(--surface3)', borderRadius: 4 }} />

                    {/* Barre active (période de mouvement) */}
                    {widthPct > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: `${startPct}%`, width: `${widthPct}%`,
                        top: 4, bottom: 4,
                        background: rt.color, opacity: 0.55,
                        borderRadius: 3, minWidth: 3,
                      }} />
                    )}

                    {/* Ticks de waypoints */}
                    {rt.waypointTimes.map((wt, wi) => {
                      const wpPct = simMaxTime > 0 ? (wt / simMaxTime) * 100 : 0
                      if (wpPct <= 0 || wpPct >= 100) return null
                      return (
                        <div key={wi} style={{
                          position: 'absolute',
                          left: `${wpPct}%`, top: 2, bottom: 2, width: 2,
                          background: rt.color, opacity: 0.95,
                          borderRadius: 1, zIndex: 1,
                          transform: 'translateX(-50%)',
                          boxShadow: `0 0 4px ${rt.color}`,
                        }} />
                      )
                    })}

                    {/* Playhead */}
                    <div style={{
                      position: 'absolute', top: -2, bottom: -2,
                      left: `${pct}%`, width: 2,
                      background: 'var(--accent)', borderRadius: 2,
                      zIndex: 3, transform: 'translateX(-50%)',
                      boxShadow: '0 0 6px var(--accent)',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        position: 'absolute', top: -3, left: '50%',
                        transform: 'translateX(-50%)',
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'var(--accent)',
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Transport ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px' }}>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => { setSimPlaying(false); setSimTime(0) }}
            title={t.reset}
            style={{
              width: 30, height: 30, borderRadius: 'var(--r)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          ><ResetIcon /></button>

          <button
            onClick={handlePlayPause}
            title={simPlaying ? t.pause : t.play}
            style={{
              width: 38, height: 30, borderRadius: 'var(--r)',
              background: simPlaying ? 'var(--accent)' : 'var(--green)',
              border: 'none', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: simPlaying ? '0 2px 8px var(--accent-mid)' : '0 2px 8px var(--green-dim)',
            }}
          >{simPlaying ? <PauseIcon /> : <PlayIcon />}</button>
        </div>

        {/* Temps */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 2,
          padding: '0 9px', borderRadius: 'var(--r)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          height: 30, flexShrink: 0,
        }}>
          <span className="tabular" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>
            {simTime.toFixed(1)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
          <span style={{ fontSize: 11, color: 'var(--border2)', margin: '0 2px' }}>/</span>
          <span className="tabular" style={{ fontSize: 11, color: 'var(--text3)' }}>{simMaxTime}s</span>
        </div>

        {/* Slider de temps (si pas de pistes) */}
        {!hasRobots && (
          <input
            type="range" min={0} max={simMaxTime} step={0.05} value={simTime}
            onMouseDown={() => setSimPlaying(false)}
            onChange={e => { setSimPlaying(false); setSimTime(+e.target.value) }}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
        )}

        {hasRobots && <div style={{ flex: 1 }} />}

        {/* Vitesse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>×</span>
          <select
            value={simSpeed} onChange={e => setSimSpeed(+e.target.value)}
            style={{
              padding: '0 6px', height: 30, borderRadius: 'var(--r)',
              border: '1px solid var(--border)', background: 'var(--surface2)',
              fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer',
            }}
          >
            {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Durée */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          padding: '0 8px', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', background: 'var(--surface2)', height: 30,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.duration}</span>
          <input
            type="number" min={5} max={120} step={5} value={simMaxTime}
            onChange={e => setSimMaxTime(+e.target.value)}
            style={{ width: 40, padding: '0 2px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, textAlign: 'center', color: 'var(--text)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
        </div>
      </div>
    </div>
  )
}
