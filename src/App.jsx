import React, { useCallback } from 'react'
import SimCanvas from './components/SimCanvas.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import RightPanel from './components/RightPanel.jsx'
import Toolbar from './components/Toolbar.jsx'
import { useSimStore, pushHistory } from './store/simStore.js'
import { useT } from './i18n.js'

export default function App() {
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const addWaypoint = useSimStore(s => s.addWaypoint)
  const addRobot = useSimStore(s => s.addRobot)
  const robots = useSimStore(s => s.robots)
  const mode = useSimStore(s => s.mode)
  const canvasBgColor = useSimStore(s => s.canvasBgColor)
  const t = useT()

  const handleTableClick = useCallback((tx, ty) => {
    if (mode !== 'draw') return
    pushHistory({ robots })
    if (!selectedRobotId) { addRobot({ x: tx, y: ty }); return }
    addWaypoint(selectedRobotId, tx, ty)
  }, [mode, selectedRobotId, addWaypoint, addRobot, robots])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftPanel />

        <div style={{ flex: 1, position: 'relative', background: canvasBgColor || '#dde3ec', overflow: 'hidden' }}>
          {robots.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10,
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(109,40,217,.15)', borderRadius: 16,
                padding: '20px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(109,40,217,.12)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>◆</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>{t.noRobot}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
                  {t.noRobotHint1}<br />{t.noRobotHint2}
                </div>
              </div>
            </div>
          )}
          <SimCanvas onTableClick={handleTableClick} />
        </div>

        <RightPanel />
      </div>
    </div>
  )
}
