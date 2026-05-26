import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSimStore, pushHistory, computeSegments } from '../store/simStore.js'
import { useT } from '../i18n.js'
import { importGazeboSDF } from '../utils/importGazeboSDF.js'

const GIT_SERVER = 'http://localhost:3001'

function buildPayload(robots, obstacles, meta) {
  return JSON.stringify({
    version: 2, savedAt: new Date().toISOString(), meta,
    robots: robots.map(r => ({
      id:r.id, name:r.name, color:r.color,
      x:r.x, y:r.y, heading:r.heading,
      width:r.width, height:r.height, radius:r.radius,
      speed:r.speed, startDelay:r.startDelay,
      shapeType: r.shapeType==='stl'?'rect':r.shapeType,
      waypoints:r.waypoints,
    })),
    obstacles: obstacles.map(o => ({ ...o })),
  }, null, 2)
}

const SAVE_VERSION = 2

function saveToFile(robots, obstacles, meta) {
  const payload = {
    version: SAVE_VERSION, savedAt: new Date().toISOString(), meta,
    robots: robots.map(r => ({
      id:r.id, name:r.name, color:r.color,
      x:r.x, y:r.y, heading:r.heading,
      width:r.width, height:r.height, radius:r.radius,
      speed:r.speed, startDelay:r.startDelay,
      shapeType: r.shapeType==='stl'?'rect':r.shapeType,
      waypoints:r.waypoints,
    })),
    obstacles: obstacles.map(o => ({ ...o })),
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}))
  a.download = `pamis_save_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','h')}.json`
  a.click()
}

// Prefer MP4/H.264 (WhatsApp-compatible) when the browser supports it,
// fall back to WebM otherwise.
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
  return candidates.find(t => window.MediaRecorder?.isTypeSupported(t)) || ''
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

function loadFromFile(file, onLoad, onError) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result)
      if (!data.robots || !Array.isArray(data.robots)) throw new Error('Format invalide')
      onLoad(data.robots, data.obstacles||[], data.meta||{})
    } catch (err) { onError(err.message) }
  }
  reader.readAsText(file)
}

function TBtn({ active, onClick, children, title, accent }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '0 12px', height: 32, borderRadius: 'var(--r)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', lineHeight: 1, transition: 'all .12s', flexShrink: 0,
  }
  if (active && accent) {
    return <button title={title} onClick={onClick} style={{ ...base, background: 'var(--accent)', border: '1px solid var(--accent-dark)', color: '#fff', boxShadow: '0 2px 8px var(--accent-mid)' }}>{children}</button>
  }
  if (active) {
    return <button title={title} onClick={onClick} style={{ ...base, background: 'var(--surface3)', border: '1px solid var(--border2)', color: 'var(--text)' }}>{children}</button>
  }
  return <button title={title} onClick={onClick} style={{ ...base, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)' }}>{children}</button>
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
}

function BtnGroup({ children }) {
  return (
    <div style={{ display: 'flex', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
      {children}
    </div>
  )
}

function BtnGroupItem({ active, onClick, children, accent }) {
  return (
    <button onClick={onClick} style={{
      padding: '0 10px', height: 32, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: 'none', borderRight: '1px solid var(--border)', lineHeight: 1,
      background: active ? (accent ? 'var(--accent)' : 'var(--surface3)') : 'var(--surface)',
      color: active ? (accent ? '#fff' : 'var(--text)') : 'var(--text3)',
      transition: 'all .12s', flexShrink: 0,
    }}>
      {children}
    </button>
  )
}

function DropdownBtn({ label, items, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0 10px', height: 32, borderRadius: 'var(--r)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap', lineHeight: 1,
          background: open ? 'var(--surface3)' : 'transparent',
          border: '1px solid var(--border)', color: 'var(--text2)',
          transition: 'all .12s',
        }}
      >
        {label}
        <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 1000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          minWidth: 180, overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); item.action() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', border: 'none', background: 'transparent',
                color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CommitModal({ t, onClose, onCommit, step, progress, error }) {
  const [msg, setMsg] = useState('')
  const inputRef = useRef()
  useEffect(() => { inputRef.current?.focus() }, [])

  const busy = step !== null && step !== 'done' && !error

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (!busy && e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 400, background: 'var(--surface)', borderRadius: 12,
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,.4)',
        padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          🐙 {t.gitCommitTitle}
        </div>

        <textarea
          ref={inputRef}
          value={msg}
          onChange={e => setMsg(e.target.value)}
          disabled={busy}
          placeholder={t.gitCommitPlaceholder}
          rows={3}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && msg.trim() && !busy) onCommit(msg) }}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 'var(--r)',
            border: '1px solid var(--border)', background: 'var(--surface2)',
            fontSize: 13, color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        {/* Barre de progression */}
        {step !== null && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
              {error ? (
                <span style={{ color: 'var(--red)' }}>✗ {error}</span>
              ) : step === 'done' ? (
                <span style={{ color: 'var(--green)' }}>{t.gitCommitSuccess}</span>
              ) : (
                t[step] || step
              )}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: error ? 'var(--red)' : step === 'done' ? 'var(--green)' : 'var(--accent)',
                width: `${progress}%`, transition: 'width .4s ease',
              }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r)', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >{t.gitCancelBtn}</button>
          <button
            onClick={() => msg.trim() && !busy && onCommit(msg)}
            disabled={!msg.trim() || busy}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r)',
              border: '1px solid var(--purple)',
              background: 'var(--purple)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: !msg.trim() || busy ? 'not-allowed' : 'pointer',
              opacity: !msg.trim() || busy ? 0.5 : 1,
            }}
          >🐙 {t.gitCommitBtn}</button>
        </div>
      </div>
    </div>
  )
}

function GitPickerModal({ t, onClose, onPick }) {
  const [files,   setFiles]   = useState(null)   // null = loading, [] = empty, [...] = list
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [pulling,  setPulling]  = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (!pulling && e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 420, background: 'var(--surface)', borderRadius: 12,
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,.4)',
        padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          🐙 {t.gitPickTitle}
        </div>

        <GitPickerList t={t} onFiles={setFiles} onError={setError} onLoadingChange={setLoading} selected={selected} onSelect={setSelected} />

        {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>✗ {error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={pulling} style={{
            padding: '7px 16px', borderRadius: 'var(--r)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t.gitCancelBtn}</button>
          <button
            disabled={!selected || pulling || loading}
            onClick={() => { setPulling(true); onPick(selected) }}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r)',
              border: '1px solid var(--purple)', background: 'var(--purple)', color: '#fff',
              fontSize: 13, fontWeight: 700,
              cursor: !selected || pulling || loading ? 'not-allowed' : 'pointer',
              opacity: !selected || pulling || loading ? 0.5 : 1,
            }}
          >
            {pulling ? t.gitPulling : `⬇ ${t.gitPullBtn}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function GitPickerList({ t, onFiles, onError, onLoadingChange, selected, onSelect }) {
  const gitConfig = useSimStore(s => s.gitConfig)
  const [files, setFiles] = useState(null)

  useEffect(() => {
    onLoadingChange(true)
    fetch(`${GIT_SERVER}/git/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl:  gitConfig.repoUrl,
        authType: gitConfig.authType,
        token:    gitConfig.token,
        username: gitConfig.username,
        password: gitConfig.password,
        branch:   gitConfig.branch || 'main',
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error)
        setFiles(data.files)
        onFiles(data.files)
        onLoadingChange(false)
      })
      .catch(err => {
        const msg = String(err).includes('fetch') ? t.gitErrServer : String(err).replace('Error: ', '')
        onError(msg)
        onLoadingChange(false)
      })
  }, [])

  if (files === null) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
      ⏳ {t.gitListLoading}
    </div>
  )
  if (files.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
      {t.gitListEmpty}
    </div>
  )
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface2)' }}>
      {files.map(f => (
        <div
          key={f}
          onClick={() => onSelect(f)}
          style={{
            padding: '9px 12px', cursor: 'pointer', fontSize: 13,
            borderBottom: '1px solid var(--border)',
            background: selected === f ? 'var(--accent-dim)' : 'transparent',
            color: selected === f ? 'var(--accent)' : 'var(--text)',
            fontWeight: selected === f ? 700 : 400,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background .1s',
          }}
          onMouseEnter={e => { if (selected !== f) e.currentTarget.style.background = 'var(--surface3)' }}
          onMouseLeave={e => { if (selected !== f) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ opacity: 0.5 }}>📄</span> {f}
        </div>
      ))}
    </div>
  )
}

function GitStatusBar({ t, msg, isError, onDismiss }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1500, background: isError ? 'var(--red)' : 'var(--surface)',
      border: `1px solid ${isError ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600,
      color: isError ? '#fff' : 'var(--text)', boxShadow: '0 8px 32px rgba(0,0,0,.25)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {msg}
      <button onClick={onDismiss} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

export default function Toolbar() {
  const mode         = useSimStore(s => s.mode)
  const setMode      = useSimStore(s => s.setMode)
  const showGrid     = useSimStore(s => s.showGrid)
  const setShowGrid  = useSimStore(s => s.setShowGrid)
  const viewMode     = useSimStore(s => s.viewMode)
  const setViewMode  = useSimStore(s => s.setViewMode)
  const darkMode     = useSimStore(s => s.darkMode)
  const setDarkMode  = useSimStore(s => s.setDarkMode)
  const lang         = useSimStore(s => s.lang)
  const setLang      = useSimStore(s => s.setLang)
  const robots       = useSimStore(s => s.robots)
  const obstacles    = useSimStore(s => s.obstacles)
  const loadState    = useSimStore(s => s.loadState)
  const gridColor    = useSimStore(s => s.gridColor)
  const gridMinorStep= useSimStore(s => s.gridMinorStep)
  const gridMajorStep= useSimStore(s => s.gridMajorStep)
  const canvasBgColor= useSimStore(s => s.canvasBgColor)
  const viewportColor= useSimStore(s => s.viewportColor)
  const simMaxTime   = useSimStore(s => s.simMaxTime)
  const simSpeed     = useSimStore(s => s.simSpeed)
  const undo         = useSimStore(s => s.undo)
  const redo         = useSimStore(s => s.redo)

  const gitConfig          = useSimStore(s => s.gitConfig)
  const triggerOpenSettings= useSimStore(s => s.triggerOpenSettings)

  const t = useT()

  const loadRef   = useRef()
  const gazeboRef = useRef()

  const [recording, setRecording] = useState(false)

  // Git state
  const [commitModal, setCommitModal] = useState(false)
  const [pickerModal, setPickerModal] = useState(false)
  const [gitStep,     setGitStep]     = useState(null)   // null | key in t | 'done'
  const [gitProgress, setGitProgress] = useState(0)
  const [gitError,    setGitError]    = useState(null)
  const [statusMsg,   setStatusMsg]   = useState(null)
  const [statusErr,   setStatusErr]   = useState(false)
  const progressTimer = useRef(null)

  const animProgress = useCallback((from, to, durationMs) => {
    clearInterval(progressTimer.current)
    const start = Date.now()
    progressTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / durationMs)
      setGitProgress(from + (to - from) * p)
      if (p >= 1) clearInterval(progressTimer.current)
    }, 30)
  }, [])

  const isGitConfigured = () => gitConfig.repoUrl.trim() !== '' && gitConfig.filename.trim() !== ''

  const handleGitSave = () => {
    if (!isGitConfigured()) {
      triggerOpenSettings()
      showStatus(t.gitErrNotConfigured, true)
      return
    }
    setGitStep(null); setGitProgress(0); setGitError(null)
    setCommitModal(true)
  }

  const doGitCommit = useCallback(async (message) => {
    const store = useSimStore.getState()
    const content = buildPayload(store.robots, store.obstacles, {
      simMaxTime: store.simMaxTime, simSpeed: store.simSpeed,
      gridColor: store.gridColor, gridMinorStep: store.gridMinorStep, gridMajorStep: store.gridMajorStep,
      viewportColor: store.viewportColor, canvasBgColor: store.canvasBgColor,
    })
    setGitError(null)
    setGitStep('gitStepWrite'); setGitProgress(5); animProgress(5, 30, 600)

    try {
      const res = await fetch(`${GIT_SERVER}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: gitConfig.filename,
          content,
          message,
          repoUrl:  gitConfig.repoUrl,
          authType: gitConfig.authType,
          token:    gitConfig.token,
          username: gitConfig.username,
          password: gitConfig.password,
          branch:   gitConfig.branch || 'main',
        }),
      })
      setGitStep('gitStepCommit'); animProgress(30, 65, 800)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setGitStep('gitStepPush'); animProgress(65, 95, 1000)
      await new Promise(r => setTimeout(r, 400))
      clearInterval(progressTimer.current)
      setGitProgress(100); setGitStep('done')
      setTimeout(() => { setCommitModal(false); showStatus(t.gitCommitSuccess, false) }, 800)
    } catch (err) {
      clearInterval(progressTimer.current)
      const msg = String(err).includes('fetch') ? t.gitErrServer : String(err).replace('Error: ', '')
      setGitError(msg)
    }
  }, [gitConfig, animProgress, t])

  const handleGitOpen = useCallback(() => {
    if (!isGitConfigured()) {
      triggerOpenSettings()
      showStatus(t.gitErrNotConfigured, true)
      return
    }
    setPickerModal(true)
  }, [gitConfig, triggerOpenSettings, t])

  const doPull = useCallback(async (filename) => {
    setPickerModal(false)
    showStatus(t.gitPulling, false)
    try {
      const res = await fetch(`${GIT_SERVER}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          repoUrl:  gitConfig.repoUrl,
          authType: gitConfig.authType,
          token:    gitConfig.token,
          username: gitConfig.username,
          password: gitConfig.password,
          branch:   gitConfig.branch || 'main',
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      const parsed = JSON.parse(data.content)
      if (!parsed.robots || !Array.isArray(parsed.robots)) throw new Error('Format invalide')
      loadState(parsed.robots, parsed.obstacles || [], parsed.meta || {})
      showStatus(t.gitPullSuccess, false)
    } catch (err) {
      const msg = String(err).includes('fetch') ? t.gitErrServer : String(err).replace('Error: ', '')
      showStatus(msg, true)
    }
  }, [gitConfig, loadState, t])

  function showStatus(msg, isErr) {
    setStatusMsg(msg); setStatusErr(isErr)
    setTimeout(() => setStatusMsg(null), 5000)
  }
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const unsubRef    = useRef(null)

  const finalizeRecording = () => {
    const rec = recorderRef.current
    if (!rec) { setRecording(false); return }
    const mime = rec.mimeType || 'video/webm'
    const blob = new Blob(chunksRef.current, { type: mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pamis_recording_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','h')}.${extForMime(mime)}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
  }

  const startRecording = () => {
    if (!window.MediaRecorder) { alert('MediaRecorder API not supported in this browser.'); return }
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const mime = pickRecordingMime()
    let stream
    try { stream = canvas.captureStream(30) } catch { alert('Canvas capture not supported.'); return }
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 5_000_000 })
    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
      finalizeRecording()
    }
    recorderRef.current = rec

    const store = useSimStore.getState()
    const stopAt = lastWaypointTime(store.robots)
    if (stopAt <= 0) {
      alert('No waypoints to record.')
      return
    }
    store.setSimPlaying(false)
    store.setSimTime(0)
    setRecording(true)
    rec.start(100)
    // Defer play one frame so the recorder is fully started.
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
    const rec = recorderRef.current
    if (!rec) return
    useSimStore.getState().setSimPlaying(false)
    if (rec.state === 'recording') rec.stop()
  }

  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current()
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); redo() }
      if (e.key==='q'||e.key==='Q') { setMode(mode==='draw' ? 'move' : 'draw') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, mode, setMode])

  return (
    <>
    {pickerModal && (
      <GitPickerModal
        t={t}
        onClose={() => setPickerModal(false)}
        onPick={doPull}
      />
    )}
    {commitModal && (
      <CommitModal
        t={t}
        onClose={() => { if (!gitStep || gitStep === 'done' || gitError) setCommitModal(false) }}
        onCommit={doGitCommit}
        step={gitStep}
        progress={gitProgress}
        error={gitError}
      />
    )}
    <GitStatusBar t={t} msg={statusMsg} isError={statusErr} onDismiss={() => setStatusMsg(null)} />
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', height: 56,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>

      {/* ── Logo (gauche absolu) ── */}
      <div style={{ position: 'absolute', left: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '.04em',
          fontFamily: "'Orbitron', sans-serif",
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>
          PAMIS SIM
        </span>
        <span style={{
          fontSize: 13, fontWeight: 800, color: 'var(--text3)',
          background: 'var(--surface3)', borderRadius: 4, padding: '2px 6px',
          letterSpacing: '.08em', lineHeight: 1,
        }}>2000</span>
      </div>

      {/* ── Outils centrés ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Mode */}
        <BtnGroup>
          <BtnGroupItem active={mode==='draw'} accent onClick={() => setMode('draw')} >
            {t.draw}
          </BtnGroupItem>
          <BtnGroupItem active={mode==='move'} onClick={() => setMode('move')}>
            {t.move}
          </BtnGroupItem>
        </BtnGroup>

        <Sep />

        {/* Vue */}
        <BtnGroup>
          <BtnGroupItem active={viewMode==='2d'} onClick={() => setViewMode('2d')}>2D</BtnGroupItem>
          <BtnGroupItem active={viewMode==='3d'} onClick={() => setViewMode('3d')}>3D</BtnGroupItem>
        </BtnGroup>

        <TBtn active={showGrid} onClick={() => setShowGrid(!showGrid)} title={t.grid}>
          {t.grid}
        </TBtn>

        <Sep />

        {/* Fichiers */}
        <DropdownBtn label={t.save} items={[
          { label: t.saveLocal, action: () => saveToFile(robots, obstacles, { simMaxTime, simSpeed, gridColor, gridMinorStep, gridMajorStep, viewportColor, canvasBgColor }) },
          { label: t.saveGit,   action: handleGitSave },
        ]} />
        <input type="file" accept=".json" ref={loadRef} style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files[0]; if (!f) return
            loadFromFile(f, (r,o,m) => loadState(r,o,m), msg => alert(t.errorPrefix+msg))
            e.target.value = ''
          }} />
        <DropdownBtn label={t.open} items={[
          { label: t.openLocal, action: () => loadRef.current?.click() },
          { label: t.openGit,   action: handleGitOpen },
        ]} />

        <input type="file" accept=".world,.sdf,.xml" ref={gazeboRef} style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files[0]; if (!f) return
            const reader = new FileReader()
            reader.onload = ev => {
              try {
                const { robots: r, obstacles: o } = importGazeboSDF(ev.target.result)
                pushHistory({ robots, obstacles })
                loadState(r, o, {})
              } catch (err) { alert(t.errorPrefix + err.message) }
            }
            reader.readAsText(f)
            e.target.value = ''
          }} />
        <TBtn onClick={() => gazeboRef.current?.click()} title={t.importGazeboTitle}>
          {t.importGazebo}
        </TBtn>

        <Sep />

        {/* Record */}
        <button
          onClick={recording ? stopRecording : startRecording}
          title={recording ? t.recordingTitle : t.recordTitle}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '0 12px', height: 32, borderRadius: 'var(--r)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0,
            background: recording ? '#dc2626' : 'transparent',
            border: recording ? '1px solid #b91c1c' : '1px solid var(--border)',
            color: recording ? '#fff' : 'var(--text2)',
            boxShadow: recording ? '0 2px 8px rgba(220,38,38,.45)' : 'none',
            transition: 'all .12s',
          }}
        >
          {recording ? t.recording : t.record}
        </button>

        <Sep />

        {/* Undo / Redo */}
        <TBtn onClick={undo} title={t.undoTitle}>↩</TBtn>
        <TBtn onClick={redo} title={t.redoTitle}>↪</TBtn>
      </div>

      {/* ── Langue + thème (droite absolu) ── */}
      <div style={{ position: 'absolute', right: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <a
          href="https://github.com/Acidpix/Pamis_Simulator_2000"
          target="_blank" rel="noreferrer"
          title="Doc"
          style={{
            width: 64, height: 32, borderRadius: 'var(--r)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text2)', textDecoration: 'none', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
          </svg> Doc
        </a>
        <BtnGroup>
          {['fr','en'].map(l => (
            <BtnGroupItem key={l} active={lang===l} accent={lang===l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </BtnGroupItem>
          ))}
        </BtnGroup>

        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
          style={{
            width: 32, height: 32, borderRadius: 'var(--r)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
    </>
  )
}
