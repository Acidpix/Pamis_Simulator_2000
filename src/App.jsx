import React, { useCallback, useEffect } from 'react'
import SimCanvas from './components/SimCanvas.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import RightPanel from './components/RightPanel.jsx'
import Toolbar from './components/Toolbar.jsx'
import Timeline from './components/Timeline.jsx'
import { useSimStore, pushHistory, loadAutosave } from './store/simStore.js'
import { useT } from './i18n.js'

export default function App() {
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const addWaypoint     = useSimStore(s => s.addWaypoint)
  const addRobot        = useSimStore(s => s.addRobot)
  const robots          = useSimStore(s => s.robots)
  const mode            = useSimStore(s => s.mode)
  const canvasBgColor   = useSimStore(s => s.canvasBgColor)
  const t = useT()

  useEffect(() => { loadAutosave() }, [])

  const handleTableClick = useCallback((tx, ty) => {
    if (mode !== 'draw') return
    pushHistory({ robots })
    if (!selectedRobotId) { addRobot({ x: tx, y: ty }); return }
    addWaypoint(selectedRobotId, tx, ty)
  }, [mode, selectedRobotId, addWaypoint, addRobot, robots])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      <Toolbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel />

        <div style={{
          flex: 1, position: 'relative',
          background: canvasBgColor || '#dde3ec',
          overflow: 'hidden',
        }}>
          {robots.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10,
            }}>
              <div style={{
                fontSize: 32, opacity: .25, filter: 'grayscale(1)',
                fontFamily: "'Orbitron', sans-serif",
              }}>◎</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', opacity: .7 }}>{t.noRobot}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.8, opacity: .8 }}>
                {t.noRobotHint1}<br />{t.noRobotHint2}
              </div>
            </div>
          )}
          <SimCanvas onTableClick={handleTableClick} />
        </div>

        <RightPanel />
      </div>

      <Timeline />
    </div>
  )
}
