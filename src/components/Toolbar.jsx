import React, { useEffect, useRef } from 'react'
import { useSimStore, canUndo, canRedo, pushHistory } from '../store/simStore.js'
import { useT } from '../i18n.js'
import { importGazeboSDF } from '../utils/importGazeboSDF.js'

const SAVE_VERSION = 2

function saveToFile(robots, obstacles, meta) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta,
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

/* ── Bouton toolbar ── */
function TBtn({ active, onClick, children, title, accent, danger }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', borderRadius: 'var(--r)', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    lineHeight: 1, transition: 'all .12s', height: 32,
  }
  let style = { ...base }
  if (active && accent) {
    style = { ...base, background: 'var(--accent)', border: '1px solid var(--accent-dark)', color: '#fff', boxShadow: '0 2px 8px var(--accent-mid)' }
  } else if (active) {
    style = { ...base, background: 'var(--surface3)', border: '1px solid var(--border2)', color: 'var(--text)' }
  } else if (danger) {
    style = { ...base, background: 'transparent', border: '1px solid var(--border)', color: 'var(--red)' }
  } else {
    style = { ...base, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)' }
  }
  return (
    <button title={title} onClick={onClick} style={style}>
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
}

/* ── Groupe de boutons juxtaposés ── */
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
      padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: 'none', borderRight: '1px solid var(--border)', lineHeight: 1, height: 32,
      background: active ? (accent ? 'var(--accent)' : 'var(--surface3)') : 'var(--surface)',
      color: active ? (accent ? '#fff' : 'var(--text)') : 'var(--text3)',
      transition: 'all .12s',
    }}>
      {children}
    </button>
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

  const loadRef   = useRef()
  const gazeboRef = useRef()

  // Thème sombre
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Raccourcis Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const t = useT()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap',
      padding: '0 14px', height: 48,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0, overflow: 'hidden',
    }}>

      {/* Logo */}
      <span style={{
        fontSize: 13, fontWeight: 900, letterSpacing: '.05em', whiteSpace: 'nowrap',
        fontFamily: "'Orbitron', sans-serif",
        background: 'linear-gradient(135deg, var(--accent), var(--purple))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginRight: 6, flexShrink: 0,
      }}>
        PAMIS SIM
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
        background: 'var(--surface3)', borderRadius: 4, padding: '2px 6px',
        letterSpacing: '.05em', flexShrink: 0,
      }}>
        2000
      </span>

      <Sep />

      {/* Mode dessin / déplacement */}
      <BtnGroup>
        <BtnGroupItem active={mode==='draw'} accent onClick={() => setMode('draw')}>
          ✏ {t.draw}
        </BtnGroupItem>
        <BtnGroupItem active={mode==='move'} onClick={() => setMode('move')}>
          ↔ {t.move}
        </BtnGroupItem>
      </BtnGroup>

      <Sep />

      {/* Vue */}
      <BtnGroup>
        <BtnGroupItem active={viewMode==='2d'} onClick={() => setViewMode('2d')}>
          2D
        </BtnGroupItem>
        <BtnGroupItem active={viewMode==='3d'} onClick={() => setViewMode('3d')}>
          3D
        </BtnGroupItem>
      </BtnGroup>

      <TBtn active={showGrid} onClick={() => setShowGrid(!showGrid)} title={t.grid}>
        ⊞ {t.grid}
      </TBtn>

      <Sep />

      {/* Fichiers */}
      <TBtn onClick={() => saveToFile(robots, obstacles, { simMaxTime, simSpeed, gridColor, gridMinorStep, gridMajorStep, viewportColor, canvasBgColor })}>
        💾 {t.save}
      </TBtn>
      <input type="file" accept=".json" ref={loadRef} style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files[0]; if (!f) return
          loadFromFile(f, (r,o,m) => loadState(r,o,m), msg => alert(t.errorPrefix+msg))
          e.target.value = ''
        }} />
      <TBtn onClick={() => loadRef.current?.click()}>
        📂 {t.open}
      </TBtn>

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
        Gazebo
      </TBtn>

      <Sep />

      {/* Undo / Redo */}
      <TBtn onClick={undo} title={t.undoTitle}>↩</TBtn>
      <TBtn onClick={redo} title={t.redoTitle}>↪</TBtn>

      {/* Espaceur */}
      <div style={{ flex: 1 }} />

      {/* Langue */}
      <BtnGroup>
        {['fr','en'].map(l => (
          <BtnGroupItem key={l} active={lang===l} accent={lang===l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </BtnGroupItem>
        ))}
      </BtnGroup>

      {/* Thème */}
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
  )
}
