import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { useSimStore, computeSegments, detectCollisions, detectObstacleCollisions, detectBorderCollisions } from '../store/simStore.js'
import { useT } from '../i18n.js'

// ── Helpers enregistrement ───────────────────────────────────────────────────
function pickRecordingMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  return candidates.find(m => window.MediaRecorder?.isTypeSupported(m)) || ''
}

function extForMime(mime) {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm'
}

function lastWaypointTime(robots) {
  let maxEnd = 0
  for (const r of robots) {
    if (!r.waypoints || r.waypoints.length === 0) continue
    const segs = computeSegments(r)
    const dur = segs.reduce((a, s) => a + s.rotDuration + s.duration + (s.arrRotDuration ?? 0) + (s.pause ?? 0) + (s.actionPause ?? 0), 0)
    maxEnd = Math.max(maxEnd, (r.startDelay ?? 0) + dur)
  }
  return maxEnd
}

const QUALITY_PRESETS = [
  { label: '480p',  bitrate: 2_000_000 },
  { label: '720p',  bitrate: 5_000_000 },
  { label: '1080p', bitrate: 10_000_000 },
]

function RecordBtn({ t, robots, simMaxTime }) {
  const [open,      setOpen]      = useState(false)
  const [recording, setRecording] = useState(false)
  const [quality,   setQuality]   = useState(1)        // index dans QUALITY_PRESETS
  const [fps,       setFps]       = useState(30)
  const [startSec,  setStartSec]  = useState(0)
  const [endSec,    setEndSec]    = useState('')       // '' = auto

  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const unsubRef    = useRef(null)
  const panelRef    = useRef(null)

  const autoEnd = useMemo(() => lastWaypointTime(robots), [robots])
  const effectiveEnd = endSec !== '' ? Number(endSec) : autoEnd

  // Ferme le panneau si clic extérieur
  useEffect(() => {
    if (!open) return
    const close = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Nettoyage au démontage
  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const finalizeRecording = () => {
    const rec = recorderRef.current
    if (!rec) { setRecording(false); return }
    const mime = rec.mimeType || 'video/webm'
    const blob = new Blob(chunksRef.current, { type: mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pamis_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','h')}.${extForMime(mime)}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
  }

  const startRecording = () => {
    if (!window.MediaRecorder) { alert('MediaRecorder API non supportée.'); return }
    if (autoEnd <= 0) { alert(t.recNoWaypoints); return }
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const mime = pickRecordingMime()
    let stream
    try { stream = canvas.captureStream(fps) } catch { alert('Canvas capture non supporté.'); return }
    const rec = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: QUALITY_PRESETS[quality].bitrate,
    })
    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
      finalizeRecording()
    }
    recorderRef.current = rec
    const stopAt = effectiveEnd > 0 ? effectiveEnd : autoEnd
    const store = useSimStore.getState()
    store.setSimPlaying(false)
    store.setSimTime(Number(startSec) || 0)
    setOpen(false)
    setRecording(true)
    rec.start(100)
    requestAnimationFrame(() => {
      useSimStore.getState().setSimPlaying(true)
      unsubRef.current = useSimStore.subscribe((state, prev) => {
        if (rec.state !== 'recording') return
        if (state.simTime >= stopAt) {
          useSimStore.getState().setSimPlaying(false)
          useSimStore.getState().setSimTime(stopAt)
          rec.stop()
        } else if (prev.simPlaying && !state.simPlaying) {
          rec.stop()
        }
      })
    })
  }

  const stopRecording = () => {
    useSimStore.getState().setSimPlaying(false)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const inputStyle = {
    padding: '4px 8px', borderRadius: 'var(--r)',
    border: '1px solid var(--border)', background: 'var(--surface2)',
    color: 'var(--text)', fontSize: 12, width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 3, display: 'block' }

  return (
    <div ref={panelRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Panneau de réglages */}
      {open && !recording && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
          background: 'var(--surface)', border: '2px solid #dc2626',
          borderRadius: 10, boxShadow: '0 -8px 32px rgba(220,38,38,.15)',
          padding: '16px', width: 230, zIndex: 1000,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 12 }}>
            ⏺ {t.recSettings}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Qualité */}
            <div>
              <label style={labelStyle}>{t.recQuality}</label>
              <select value={quality} onChange={e => setQuality(Number(e.target.value))} style={inputStyle}>
                {QUALITY_PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* FPS */}
            <div>
              <label style={labelStyle}>{t.recFramerate}</label>
              <select value={fps} onChange={e => setFps(Number(e.target.value))} style={inputStyle}>
                {[24, 30, 60].map(f => <option key={f} value={f}>{f} fps</option>)}
              </select>
            </div>

            {/* Timing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>{t.recStartTime}</label>
                <input
                  type="number" min={0} max={simMaxTime} step={0.5}
                  value={startSec}
                  onChange={e => setStartSec(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.recEndTime}</label>
                <input
                  type="number" min={0} max={simMaxTime} step={0.5}
                  value={endSec}
                  placeholder={`${autoEnd.toFixed(1)}`}
                  onChange={e => setEndSec(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 'var(--r)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >{t.recCancel}</button>
            <button
              onClick={startRecording}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 'var(--r)',
                border: '1px solid #dc2626', background: '#dc2626',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >{t.recRecord}</button>
          </div>
        </div>
      )}

      {/* Bouton principal */}
      <button
        onClick={() => recording ? stopRecording() : setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '0 14px', height: 36, borderRadius: 'var(--r)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0,
          background: recording ? '#dc2626' : 'transparent',
          border: recording ? '2px solid #b91c1c' : '2px solid #dc2626',
          color: recording ? '#fff' : '#dc2626',
          boxShadow: recording ? '0 0 14px rgba(220,38,38,.5)' : '0 0 0 rgba(220,38,38,0)',
          transition: 'all .15s',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: recording ? '#fff' : '#dc2626',
          boxShadow: recording ? '0 0 6px #fff' : 'none',
        }} />
        {recording ? t.recStop : t.recTitle}
      </button>
    </div>
  )
}

const TRACK_H = 20
const LABEL_W = 80

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <polygon points="2,1 11,6 2,11" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="3.5" height="10" rx="1" />
      <rect x="7" y="1" width="3.5" height="10" rx="1" />
    </svg>
  )
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <rect x="9" y="1" width="2.5" height="10" rx="1" />
      <polygon points="8,1.5 1,6 8,10.5" />
    </svg>
  )
}
function GoToEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0.5" y="1" width="2.5" height="10" rx="1" />
      <polygon points="4,1.5 11,6 4,10.5" />
    </svg>
  )
}
function PrevWpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0.5" y="1" width="2" height="10" rx="1" />
      <polygon points="10,1.5 3.5,6 10,10.5" />
      <polygon points="6,1.5 0,6 6,10.5" opacity="0" />
    </svg>
  )
}
function NextWpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
      <rect x="9.5" y="1" width="2" height="10" rx="1" />
      <polygon points="2,1.5 8.5,6 2,10.5" />
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

  useEffect(() => {
    setCollisions(robots.length >= 2 ? detectCollisions(robots, simMaxTime) : [])
    setObsCollisions(robots.length > 0 && obstacles.length > 0 ? detectObstacleCollisions(robots, obstacles, simMaxTime) : [])
    setBorderCollisions(robots.length > 0 ? detectBorderCollisions(robots, tableW, tableH, simMaxTime) : [])
  }, [robots, obstacles, simMaxTime, tableW, tableH])

  const robotTimelines = useMemo(() => robots.map(r => {
    const segs = computeSegments(r)
    const start = r.startDelay ?? 0
    const duration = segs.reduce((a, s) => a + s.rotDuration + s.duration + (s.arrRotDuration ?? 0) + (s.pause ?? 0) + (s.actionPause ?? 0), 0)
    const waypointTimes = segs.map(seg => seg.startTime + seg.rotDuration + seg.duration + (seg.arrRotDuration ?? 0))
    return { id: r.id, name: r.name, color: r.color, start, end: start + duration, waypointTimes }
  }), [robots])

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

  const allWaypointTimes = useMemo(() => {
    const times = new Set()
    robotTimelines.forEach(rt => rt.waypointTimes.forEach(t => times.add(t)))
    return [...times].sort((a, b) => a - b)
  }, [robotTimelines])

  const goToPrevWaypoint = useCallback(() => {
    const prev = [...allWaypointTimes].reverse().find(t => t < simTimeRef.current - 0.05)
    setSimPlaying(false)
    setSimTime(prev !== undefined ? prev : 0)
  }, [allWaypointTimes])

  const goToNextWaypoint = useCallback(() => {
    const next = allWaypointTimes.find(t => t > simTimeRef.current + 0.05)
    if (next !== undefined) { setSimPlaying(false); setSimTime(next) }
  }, [allWaypointTimes])

  const pct       = simMaxTime > 0 ? (simTime / simMaxTime) * 100 : 0
  const remaining = Math.max(0, simMaxTime - simTime)
  const hasRobots = robotTimelines.length > 0

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
      userSelect: 'none',
    }}>

      {/* ── Pistes robot ── */}
      {hasRobots && (
        <div style={{ padding: '18px 16px 0', maxHeight: 5 * (TRACK_H + 4) + 28, overflowY: 'auto', overflowX: 'visible' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {robotTimelines.map(rt => {
              const startPct = simMaxTime > 0 ? (rt.start / simMaxTime) * 100 : 0
              const widthPct = simMaxTime > 0 ? Math.max(0, (rt.end - rt.start) / simMaxTime * 100) : 0
              return (
                <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, height: TRACK_H }}>
                  <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: rt.color, flexShrink: 0, boxShadow: `0 0 5px ${rt.color}90` }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rt.name}</span>
                  </div>
                  <div
                    ref={trackAreaRef}
                    onMouseDown={handleTrackMouseDown}
                    style={{ flex: 1, position: 'relative', height: TRACK_H, cursor: 'pointer' }}
                  >
                    <div style={{ position: 'absolute', inset: 0, background: 'var(--surface3)', borderRadius: 4 }} />
                    {widthPct > 0 && (
                      <div style={{
                        position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`,
                        top: 4, bottom: 4,
                        background: rt.color, opacity: 0.55, borderRadius: 3, minWidth: 3,
                      }} />
                    )}
                    {rt.waypointTimes.map((wt, wi) => {
                      const wpPct = simMaxTime > 0 ? (wt / simMaxTime) * 100 : 0
                      if (wpPct <= 0 || wpPct >= 100) return null
                      return (
                        <div key={wi} style={{
                          position: 'absolute', left: `${wpPct}%`, top: 2, bottom: 2, width: 2,
                          background: rt.color, opacity: 0.95, borderRadius: 1, zIndex: 1,
                          transform: 'translateX(-50%)', boxShadow: `0 0 4px ${rt.color}`,
                        }}>
                          <div style={{
                            position: 'absolute', bottom: 'calc(100% + 3px)', left: '50%', transform: 'translateX(-50%)',
                            fontSize: 11, fontWeight: 900, color: '#fff', lineHeight: 1,
                            background: rt.color, padding: '2px 5px', borderRadius: 4,
                            whiteSpace: 'nowrap', pointerEvents: 'none',
                            boxShadow: `0 1px 6px ${rt.color}80, 0 1px 3px rgba(0,0,0,.4)`,
                            letterSpacing: '-.01em',
                          }}>{wi + 1}</div>
                        </div>
                      )
                    })}
                    <div style={{
                      position: 'absolute', top: -2, bottom: -2, left: `${pct}%`, width: 2,
                      background: 'var(--accent)', borderRadius: 2, zIndex: 3,
                      transform: 'translateX(-50%)', boxShadow: '0 0 6px var(--accent)',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
                        width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Barre de transport ── */}
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 16px', gap: 10,
        minHeight: 60,
      }}>

        {/* ── Gauche : enregistrement ── */}
        <div style={{ position: 'absolute', left: 16 }}>
          <RecordBtn t={t} robots={robots} simMaxTime={simMaxTime} />
        </div>

        {/* ── Centre : boutons transport ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Retour au début */}
          <button onClick={() => { setSimPlaying(false); setSimTime(0) }} title={t.reset}
            style={{ width: 34, height: 36, borderRadius: 'var(--r)', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ResetIcon />
          </button>

          {/* Waypoint précédent */}
          <button onClick={goToPrevWaypoint} title="Waypoint précédent"
            style={{ width: 34, height: 36, borderRadius: 'var(--r)', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <PrevWpIcon />
          </button>

          {/* Play / Pause */}
          <button onClick={handlePlayPause} title={simPlaying ? t.pause : t.play}
            style={{ width: 50, height: 36, borderRadius: 'var(--r)', background: simPlaying ? 'var(--accent)' : 'var(--green)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: simPlaying ? '0 2px 10px var(--accent-mid)' : '0 2px 10px var(--green-dim)' }}>
            {simPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Waypoint suivant */}
          <button onClick={goToNextWaypoint} title="Waypoint suivant"
            style={{ width: 34, height: 36, borderRadius: 'var(--r)', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <NextWpIcon />
          </button>

          {/* Aller à la fin */}
          <button onClick={() => { setSimPlaying(false); setSimTime(simMaxTime) }} title="Aller à la fin"
            style={{ width: 34, height: 36, borderRadius: 'var(--r)', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <GoToEndIcon />
          </button>
        </div>

        {/* ── Droite : timer + vitesse + durée ── */}
        <div style={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 14px', borderRadius: 'var(--r2)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 1 }}>Écoulé</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {simTime.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2, color: 'var(--text3)' }}>s</span>
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 1 }}>Restant</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text2)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {remaining.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2, color: 'var(--text3)' }}>s</span>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

          {!hasRobots && (
            <input type="range" min={0} max={simMaxTime} step={0.05} value={simTime}
              onMouseDown={() => setSimPlaying(false)}
              onChange={e => { setSimPlaying(false); setSimTime(+e.target.value) }}
              style={{ width: 120, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>×</span>
            <select value={simSpeed} onChange={e => setSimSpeed(+e.target.value)}
              style={{ padding: '0 6px', height: 32, borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
              {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '0 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--surface2)', height: 32 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t.duration}</span>
            <input type="number" min={5} max={120} step={5} value={simMaxTime}
              onChange={e => setSimMaxTime(+e.target.value)}
              style={{ width: 40, padding: '0 2px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, textAlign: 'center', color: 'var(--text)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>s</span>
          </div>
        </div>
      </div>
    </div>
  )
}
