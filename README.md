# TURBO PAMIS SIMULATOR 2000

Simulateur de trajectoires de robots pour la **Coupe de France de Robotique**.  
Permet de planifier, visualiser et exporter les trajectoires de plusieurs robots sur une table 3×2 m.

---

## Fonctionnalités / Features

### Robots
- Ajout de plusieurs robots — couleur, nom, dimensions / Add multiple robots — color, name, dimensions
- Tracé de trajectoire par clic (mode **Tracer** / **Draw**)
- Déplacement de robots et waypoints par glisser-déposer (mode **Déplacer** / **Move**)
- Snap angulaire à 15° en maintenant **Ctrl** lors du déplacement d'un waypoint

### Cinématique / Kinematics
- Profil de vitesse **trapézoïdal** (accél. / décél.) — mode *Stop aux waypoints*
- Mode **Continu** (vitesse constante entre waypoints)
- Vitesse et accélération **linéaires** indépendantes (mm/s ou m/s)
- Vitesse et accélération **angulaires** indépendantes (°/s ou rad/s)
- **Pause** configurable à chaque waypoint (panneau droit)
- Délai de départ par robot

### Détection de collisions / Collision detection
- Robot ↔ Robot
- Robot ↔ Obstacle statique
- Robot ↔ Bord de table (15 mm × 70 mm)
- Formes de collision : **cercle** ou **rectangle** (indépendant par entité)

### Obstacles statiques / Static obstacles
- Rectangle ou cercle, couleur, dimensions, transparence, forme de collision

### Simulation
- Timeline slider + vitesse de lecture ×0.25 à ×4
- Durée de simulation configurable (5–120 s)
- Vue **2D** (orthographique) et **3D** (perspective + OrbitControls)

### Table & Affichage / Table & Display
- Image de fond par défaut : `public/table_FINALE_1.jpg`
- Couleur de surface de la table configurable
- Couleur d'arrière-plan (hors table) configurable
- Grille configurable (couleur, pas petite / grande grille)
- Mode **sombre / clair**
- Langue **FR / EN**

### Import STL
- Import de géométrie 3D `.stl` avec contrôle de rotation X / Y / Z

### Sauvegarde / Save & Export
- **Sauvegarder** : JSON complet (robots, obstacles, configuration)
- **Ouvrir** : import d'une sauvegarde JSON
- **Exporter trajectoires** : JSON des segments (pour intégration embarquée)
- Annuler / Rétablir — Ctrl+Z / Ctrl+Y (60 niveaux)

---

## Installation (production)

```bash
bash install.sh
```

Le script :
1. Clone le dépôt depuis `https://github.com/Acidpix/Pamis_Simulator_2000.git`
2. Installe Node.js 20 LTS si absent
3. Build (`npm run build`)
4. Crée et active un service **systemd** `pamis-simulator-2000` (port 3000)

---

## Développement / Development

```bash
npm install
npm run dev
```

---

## Stack technique

| Outil | Rôle |
|---|---|
| React 18 + Vite 5 | SPA + bundler |
| Zustand + Immer | État global |
| @react-three/fiber | Rendu 3D WebGL |
| @react-three/drei | Caméra, contrôles, textures |
| Three.js STLLoader | Import géométrie STL |

---

## Format de sauvegarde JSON

```json
{
  "version": 2,
  "meta": { "simMaxTime": 30, "simSpeed": 1, "viewportColor": "#2d6e3e", "canvasBgColor": "#2e4a76" },
  "robots": [{
    "id": "r_...", "name": "Robot 1", "color": "#e03131",
    "x": 0.5, "y": 0.3, "heading": 0,
    "speed": 0.3, "accel": 1.0, "rotSpeed": 90, "rotAccel": 360,
    "waypointMode": "stop", "collisionShape": "circle",
    "width": 0.2, "height": 0.2, "radius": 0.14, "opacity": 1.0,
    "startDelay": 0, "waypoints": [{ "x": 1.0, "y": 1.0, "pause": 0 }]
  }],
  "obstacles": []
}
```

---

[https://github.com/Acidpix/Pamis_Simulator_2000](https://github.com/Acidpix/Pamis_Simulator_2000)
