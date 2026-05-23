import React, { useEffect, useRef } from 'react'
import { useSimStore, detectCollisions, detectObstacleCollisions, detectBorderCollisions, canUndo, canRedo } from '../store/simStore.js'

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

function Btn({ active, onClick, children, variant='default', title, small }) {
  const pad = small ? '5px 10px' : '7px 13px'
  const fz  = small ? 13 : 14
  const v = {
    default: { background:active?'#2563eb':'var(--surface)', border:`1.5px solid ${active?'#2563eb':'var(--border)'}`, color:active?'#fff':'var(--text2)' },
    green:   { background:active?'#16a34a':'var(--surface)', border:`1.5px solid ${active?'#16a34a':'var(--border)'}`, color:active?'#fff':'var(--text2)' },
    ghost:   { background:'transparent', border:'1.5px solid var(--border)', color:'var(--text2)' },
  }
  return (
    <button title={title} onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:pad, borderRadius:'var(--r)', fontSize:fz, fontWeight:500,
      cursor:'pointer', whiteSpace:'nowrap', lineHeight:1, transition:'all .12s',
      ...(v[variant]||v.default),
    }}>
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width:1, height:24, background:'var(--border)', margin:'0 3px', flexShrink:0 }} />
}

export default function Toolbar() {
  const mode         = useSimStore(s=>s.mode)
  const setMode      = useSimStore(s=>s.setMode)
  const simPlaying   = useSimStore(s=>s.simPlaying)
  const setSimPlaying= useSimStore(s=>s.setSimPlaying)
  const simTime      = useSimStore(s=>s.simTime)
  const setSimTime   = useSimStore(s=>s.setSimTime)
  const simMaxTime   = useSimStore(s=>s.simMaxTime)
  const setSimMaxTime= useSimStore(s=>s.setSimMaxTime)
  const simSpeed     = useSimStore(s=>s.simSpeed)
  const setSimSpeed  = useSimStore(s=>s.setSimSpeed)
  const showGrid     = useSimStore(s=>s.showGrid)
  const setShowGrid  = useSimStore(s=>s.setShowGrid)
  const viewMode     = useSimStore(s=>s.viewMode)
  const setViewMode  = useSimStore(s=>s.setViewMode)
  const darkMode     = useSimStore(s=>s.darkMode)
  const setDarkMode  = useSimStore(s=>s.setDarkMode)
  const robots       = useSimStore(s=>s.robots)
  const obstacles    = useSimStore(s=>s.obstacles)
  const setCollisions= useSimStore(s=>s.setCollisions)
  const setObsCollisions= useSimStore(s=>s.setObsCollisions)
  const loadState    = useSimStore(s=>s.loadState)
  const gridColor    = useSimStore(s=>s.gridColor)
  const gridMinorStep= useSimStore(s=>s.gridMinorStep)
  const gridMajorStep= useSimStore(s=>s.gridMajorStep)

  const undo = useSimStore(s=>s.undo)
  const redo = useSimStore(s=>s.redo)

  const loadRef = useRef()
  const rafRef  = useRef(null)
  const lastRef = useRef(null)
  const simTimeRef    = useRef(simTime)
  const simSpeedRef   = useRef(simSpeed)
  const simMaxTimeRef = useRef(simMaxTime)

  useEffect(() => { simTimeRef.current    = simTime    }, [simTime])
  useEffect(() => { simSpeedRef.current   = simSpeed   }, [simSpeed])
  useEffect(() => { simMaxTimeRef.current = simMaxTime }, [simMaxTime])

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

  // Boucle simulation
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

  const setBorderCollisions = useSimStore(s=>s.setBorderCollisions)
  const tableW = useSimStore(s=>s.tableW)
  const tableH = useSimStore(s=>s.tableH)

  // Détection collisions
  useEffect(() => {
    setCollisions(robots.length>=2 ? detectCollisions(robots, simMaxTime) : [])
    setObsCollisions(robots.length>0&&obstacles.length>0 ? detectObstacleCollisions(robots, obstacles, simMaxTime) : [])
    setBorderCollisions(robots.length>0 ? detectBorderCollisions(robots, tableW, tableH, simMaxTime) : [])
  }, [robots, obstacles, simMaxTime, tableW, tableH])

  const pct = simMaxTime > 0 ? (simTime/simMaxTime)*100 : 0

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
      padding:'8px 14px', background:'var(--surface)',
      borderBottom:'1px solid var(--border)', flexShrink:0,
    }}>
      <span style={{ fontSize:13, fontWeight:800, color:'var(--blue)', letterSpacing:'-.3px', marginRight:4, whiteSpace:'nowrap' }}>
        TURBO PAMIS SIMULATOR 2000
      </span>
      <Sep />

      <Btn active={mode==='draw'}  onClick={()=>setMode('draw')}  title="Cliquer la table pour ajouter des waypoints">✏️ Tracer</Btn>
      <Btn active={mode==='move'}  onClick={()=>setMode('move')}  title="Glisser robots et obstacles">✋ Déplacer</Btn>

      <Sep />

      <Btn variant="green" active={simPlaying} onClick={() => { if(simTime>=simMaxTime) setSimTime(0); setSimPlaying(!simPlaying) }}>
        {simPlaying ? '⏸ Pause' : '▶ Simuler'}
      </Btn>
      <Btn variant="ghost" onClick={() => { setSimPlaying(false); setSimTime(0) }}>⏮ Reset</Btn>

      {/* Timeline */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:120 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--blue)', minWidth:40, fontVariantNumeric:'tabular-nums' }}>
          {simTime.toFixed(1)}s
        </span>
        <input type="range" min={0} max={simMaxTime} step={0.1} value={simTime}
          onMouseDown={()=>setSimPlaying(false)}
          onChange={e=>{ setSimPlaying(false); setSimTime(+e.target.value) }}
          style={{ flex:1, minWidth:60, accentColor:'var(--blue)', cursor:'pointer' }} />
        <span style={{ fontSize:12, color:'var(--text3)' }}>/{simMaxTime}s</span>
      </div>

      <select value={simSpeed} onChange={e=>setSimSpeed(+e.target.value)}
        style={{ padding:'5px 7px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:13 }}>
        {[0.25,0.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}
      </select>

      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ fontSize:12, color:'var(--text3)' }}>Durée</span>
        <input type="number" min={5} max={120} step={5} value={simMaxTime} onChange={e=>setSimMaxTime(+e.target.value)}
          style={{ width:56, padding:'5px 6px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:13 }} />
        <span style={{ fontSize:12, color:'var(--text3)' }}>s</span>
      </div>

      <Sep />

      <Btn active={showGrid} onClick={()=>setShowGrid(!showGrid)} small>⊞ Grille</Btn>
      <Btn active={viewMode==='3d'} onClick={()=>setViewMode(viewMode==='2d'?'3d':'2d')} small>
        {viewMode==='3d'?'🗺 2D':'🧊 3D'}
      </Btn>
      <Btn active={darkMode} onClick={()=>setDarkMode(!darkMode)} small title="Mode sombre">
        {darkMode ? '☀️' : '🌙'}
      </Btn>

      <Sep />

      <Btn variant="ghost" small onClick={()=>saveToFile(robots, obstacles, { simMaxTime, simSpeed, gridColor, gridMinorStep, gridMajorStep })}>
        💾 Sauvegarder
      </Btn>
      <input type="file" accept=".json" ref={loadRef} style={{ display:'none' }}
        onChange={e => { const f=e.target.files[0]; if(!f)return; loadFromFile(f,(r,o,m)=>loadState(r,o,m),msg=>alert('Erreur : '+msg)); e.target.value='' }} />
      <Btn variant="ghost" small onClick={()=>loadRef.current?.click()}>📂 Ouvrir</Btn>

      <Sep />

      <Btn variant="ghost" small onClick={undo} title="Annuler (Ctrl+Z)">↩ Annuler</Btn>
      <Btn variant="ghost" small onClick={redo} title="Rétablir (Ctrl+Y)">↪ Rétablir</Btn>
    </div>
  )
}
