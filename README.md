# PAMIS SIMULATOR 2000 🤖

Simulateur de trajectoires pour la **Coupe de France de Robotique** — équipe Krabi Robotics.

## Stack technique
- **React 18** + **Vite 5**
- **Three.js** + **@react-three/fiber** + **@react-three/drei** — rendu 3D/2D de la table
- **Zustand** + **Immer** — gestion d'état
- **STLLoader** (Three.js) — import modèles 3D robots

## Installation

```bash
# Dans votre VM Linux
node --version   # Nécessite Node.js >= 18

cd robot-sim
npm install
npm run dev
```

Ouvrez ensuite : **http://localhost:5173**

> Sur une VM, accédez depuis l'hôte via l'IP de la VM : `http://192.168.x.x:5173`

## Fonctionnalités

### Table
- Dimensions réelles **3m × 2m** — grille 10cm / 50cm
- Import d'une **image de fond** (thème Farming World 2026)
- Scroll molette pour **zoomer**

### Robots
- Ajout de **plusieurs robots** avec couleurs distinctes
- **Drag & drop** pour repositionner (mode Déplacer)
- Import de géométrie **STL** (modèle 3D CAO) ou **SVG** (empreinte 2D)
- Paramètres : nom, délai de départ, vitesse, dimensions, rayon de collision

### Trajectoires
- Cliquez sur la table en mode **Tracer** pour ajouter des waypoints
- Visualisation des **flèches de direction** sur chaque segment
- Pour chaque segment : **distance (mm)**, **cap absolu (°)**, **rotation relative (°)**, temps de départ, durée

### Simulation
- **Lecture / pause** avec curseur temporel
- Vitesses de simulation : ×0.25 à ×4
- **Détection de collisions** en temps réel (cercles de collision)
- Marqueurs visuels rouges aux points de collision

### Export
- **Export JSON** des trajectoires avec toutes les données métriques
  (distances mm, angles, timings) prêtes à transposer dans les robots

## Format JSON exporté

```json
[
  {
    "name": "Robot 1",
    "startPosition": { "x": 1.5, "y": 1.0 },
    "startDelay": 0,
    "speed": 0.3,
    "segments": [
      {
        "from": { "x": 1500, "y": 1000 },
        "to":   { "x": 2000, "y": 1000 },
        "distance_mm": 500,
        "heading_deg": 0,
        "rotation_deg": null,
        "start_time_s": 0,
        "duration_s": 1.67
      }
    ]
  }
]
```

## Structure du projet

```
robot-sim/
├── src/
│   ├── components/
│   │   ├── SimCanvas.jsx    # Scène Three.js (table, robots, trajectoires)
│   │   ├── LeftPanel.jsx    # Gestion robots + import STL/SVG
│   │   ├── RightPanel.jsx   # Segments, angles, collisions, export
│   │   └── Toolbar.jsx      # Modes + contrôles simulation
│   ├── store/
│   │   └── simStore.js      # État Zustand + cinématique + détection collision
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
└── package.json
```
