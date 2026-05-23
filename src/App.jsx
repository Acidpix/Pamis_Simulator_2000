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
      // Créer un robot à la position cliquée si aucun sélectionné
      addRobot({ x: tx, y: ty })
      return
    }
    addWaypoint(selectedRobotId, tx, ty)
  }, [mode, selectedRobotId, addWaypoint, addRobot])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-void)',
      overflow: 'hidden',
    }}>
      <Toolbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <LeftPanel />

        {/* Zone centrale */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: 'var(--bg-base)',
          overflow: 'hidden',
        }}>
          {/* Grille de fond ambiante */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(0,200,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,200,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
          }} />

          {robots.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              gap: 12,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'rgba(0,200,255,0.15)',
                letterSpacing: '.2em',
              }}>
                PAMIS SIMULATOR 2000
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'rgba(0,200,255,0.3)',
                textAlign: 'center',
                lineHeight: 1.8,
              }}>
                Ajoutez un robot depuis le panneau gauche<br />
                puis cliquez sur la table pour tracer une trajectoire
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
