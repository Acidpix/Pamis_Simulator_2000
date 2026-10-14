import React, { useEffect, useRef, useState } from 'react'
import { useSimStore } from '../store/simStore.js'
import { useT } from '../i18n.js'
import { Icon, WP_TYPES, WP_TYPE_ICON, WP_TYPE_COLOR, WP_TYPE_LABEL as TYPE_LABEL, WP_TYPE_DESC as TYPE_DESC } from './Icons.jsx'

const H = 38

// Barre d'édition sous la toolbar : [＋ Ajouter waypoint ▾ type]  [✥ Déplacer waypoint]
export default function EditBar() {
  const t = useT()
  const mode      = useSimStore(s => s.mode)
  const setMode   = useSimStore(s => s.setMode)
  const wpType    = useSimStore(s => s.wpType)
  const setWpType = useSimStore(s => s.setWpType)
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // 1 / 2 / 3 : choisit le type de waypoint et passe en mode ajout
  useEffect(() => {
    const onKey = e => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return
      const idx = ['1', '2', '3'].indexOf(e.key)
      if (idx >= 0) { setWpType(WP_TYPES[idx]); setMode('draw') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setWpType, setMode])

  const drawing = mode === 'draw'
  const color = WP_TYPE_COLOR[wpType]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      height: 52, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      position: 'relative', zIndex: 20,
    }}>
      {/* Ajouter un waypoint (bouton scindé : action | choix du type) */}
      <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
        <button
          onClick={() => setMode('draw')}
          title={t.drawTitle}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: H, padding: '0 16px',
            borderRadius: 'var(--r) 0 0 var(--r)', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${drawing ? color : 'var(--border)'}`,
            background: drawing ? color : 'transparent', color: drawing ? '#fff' : 'var(--text2)',
            boxShadow: drawing ? `0 2px 10px ${color}66` : 'none', transition: 'all .12s',
          }}
        >
          <Icon name="plus" size={17} />
          {t.addWaypoint}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 12,
            background: drawing ? 'rgba(255,255,255,.22)' : `${color}22`, color: drawing ? '#fff' : color, fontSize: 12,
          }}>
            <Icon name={WP_TYPE_ICON[wpType]} size={13} />{t[TYPE_LABEL[wpType]]}
          </span>
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          title={t.wpType}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: H, width: 34,
            borderRadius: '0 var(--r) var(--r) 0', cursor: 'pointer',
            border: `1px solid ${drawing ? color : 'var(--border)'}`, borderLeft: `1px solid ${drawing ? 'rgba(255,255,255,.35)' : 'var(--border)'}`,
            background: drawing ? color : 'transparent', color: drawing ? '#fff' : 'var(--text2)', transition: 'all .12s',
          }}
        >
          <Icon name="chevronDown" size={16} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 1000, minWidth: 290,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden',
          }}>
            {WP_TYPES.map((type, i) => {
              const c = WP_TYPE_COLOR[type], active = type === wpType
              return (
                <button key={type}
                  onClick={() => { setWpType(type); setMode('draw'); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', cursor: 'pointer', color: 'var(--text)',
                    borderBottom: i < WP_TYPES.length - 1 ? '1px solid var(--border)' : 'none',
                    background: active ? `${c}18` : 'transparent', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${c}22` }}
                  onMouseLeave={e => { e.currentTarget.style.background = active ? `${c}18` : 'transparent' }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `${c}22`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={WP_TYPE_ICON[type]} size={18} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: active ? c : 'var(--text)' }}>{t[TYPE_LABEL[type]]}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{t[TYPE_DESC[type]]}</span>
                  </span>
                  <kbd style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--text3)', background: 'var(--surface2)' }}>{i + 1}</kbd>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Déplacer */}
      <button
        onClick={() => setMode('move')}
        title={t.moveTitle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: H, padding: '0 16px',
          borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          border: `1px solid ${!drawing ? 'var(--purple)' : 'var(--border)'}`,
          background: !drawing ? 'var(--purple)' : 'transparent', color: !drawing ? '#fff' : 'var(--text2)',
          boxShadow: !drawing ? '0 2px 10px rgba(112,72,232,.4)' : 'none', transition: 'all .12s',
        }}
      >
        <Icon name="move" size={17} />
        {t.moveWaypoint}
      </button>
    </div>
  )
}
