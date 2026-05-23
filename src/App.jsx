import React, { useCallback } from 'react'
import SimCanvas from './components/SimCanvas.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import RightPanel from './components/RightPanel.jsx'
import Toolbar from './components/Toolbar.jsx'
import { useSimStore } from './store/simStore.js'

export default function App() {
  const selectedRobotId = useSimStore(s => s.selectedRobotId)
  const addWaypoint = useSimStore(s => s.addWaypoint)
  const addRobot = useSimStore(s => s.addRobot)
  const robots = useSimStore(s => s.robots)
  const mode = useSimStore(s => s.mode)

  const handleTableClick = useCallback((tx, ty) => {
    if (mode !== 'draw') return
    if (!selectedRobotId) {
      addRobot({ x: tx, y: ty })
      return
    }
    addWaypoint(selectedRobotId, tx, ty)
  }, [mode, selectedRobotId, addWaypoint, addRobot])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftPanel />

        <div style={{ flex: 1, position: 'relative', background: '#dde3ec', overflow: 'hidden' }}>
          {robots.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8,
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>Aucun robot</div>
              <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 1.7 }}>
                Ajoutez un robot depuis le panneau gauche<br />
                puis cliquez sur la table pour tracer sa trajectoire
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
