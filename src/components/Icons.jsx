import React from 'react'
import { useT } from '../i18n.js'

// Pictos au style lucide (ISC) : viewBox 24, trait 2px.
// ICON_PATHS est aussi utilisé par SimCanvas (Path2D) pour dessiner les icônes dans les textures.
export const ICON_PATHS = {
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  plus: ['M5 12h14', 'M12 5v14'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  bot: ['M12 8V4H8', 'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'],
  brick: ['M3 5h18v14H3z', 'M3 9.67h18', 'M3 14.33h18', 'M9 5v4.67', 'M15 5v4.67', 'M12 9.67v4.66', 'M9 14.33V19', 'M15 14.33V19'],
  settings: ['M20 7h-9', 'M14 17H5', 'M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  package: ['M21 8l-9-5-9 5v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3', 'm21 15-5-5L5 21'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  pencil: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z'],
  move: ['m5 9-3 3 3 3', 'm9 5 3-3 3 3', 'm15 19-3 3-3-3', 'm19 9 3 3-3 3', 'M2 12h20', 'M12 2v20'],
  pointPin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0', 'M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
  bezier: ['M19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M5 17A12 12 0 0 1 17 5'],
  pass: ['M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', 'M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  timer: ['M10 2h4', 'm12 14 3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16'],
  action: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  video: ['m22 8-6 4 6 4V8z', 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  record: ['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14'],
  stop: ['M6 6h12v12H6z'],
  pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  circle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'],
  rect: ['M4 6h16v12H4z'],
  check: ['M20 6 9 17l-5-5'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'],
  redo: ['m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13'],
  reverse: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  loader: ['M21 12a9 9 0 1 1-6.22-8.56'],
  copy: ['M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  git: ['M6 3v12', 'M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M18 9a9 9 0 0 1-9 9'],
  keyboard: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M8 14h8'],
  skipBack: ['M19 20 9 12l10-8z', 'M5 19V5'],
  skipForward: ['m5 4 10 8-10 8z', 'M19 5v14'],
}

export const WP_TYPES = ['point', 'bezier', 'pass']
export const WP_TYPE_ICON = { point: 'pointPin', bezier: 'bezier', pass: 'pass' }
export const WP_TYPE_COLOR = { point: '#6366f1', bezier: '#0ea5e9', pass: '#16a34a' }
export const WP_TYPE_LABEL = { point: 'wpTypePoint', bezier: 'wpTypeBezier', pass: 'wpTypePass' }
export const WP_TYPE_DESC = { point: 'wpTypePointDesc', bezier: 'wpTypeBezierDesc', pass: 'wpTypePassDesc' }

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 2, style }) {
  const paths = ICON_PATHS[name]
  if (!paths) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }} aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// Bouton poubelle rouge partagé (waypoints, robots, obstacles)
export function TrashBtn({ onClick, title, size = 24 }) {
  const t = useT()
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(e) }}
      title={title ?? t.deleteWp}
      style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        border: '1px solid transparent', background: 'transparent', color: 'var(--red)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .12s', padding: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--red)' }}
    >
      <Icon name="trash" size={Math.round(size * 0.62)} />
    </button>
  )
}
