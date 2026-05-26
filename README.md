# TURBO PAMIS SIMULATOR 2000 v1.5

Simulateur de trajectoires de robots pour la **Coupe de France de Robotique**.  
Permet de planifier, visualiser et exporter les trajectoires de plusieurs robots sur une table 3×2 m.

---

## Fonctionnalités / Features

### Robots
- Ajout de plusieurs robots — couleur, nom, dimensions / Add multiple robots — color, name, dimensions
- Tracé de trajectoire par clic (mode **Tracer** / **Draw**)
- **Insertion de waypoint** entre deux existants : cliquer sur le segment de trajectoire en mode Tracer
- Suppression de waypoint : cliquer sur le cercle du waypoint en mode Tracer
- Déplacement de robots et waypoints par glisser-déposer (mode **Déplacer** / **Move**)
- Snap angulaire à 15° en maintenant **Ctrl** lors du déplacement d'un waypoint
- Raccourci **Q** : bascule entre les modes Tracer et Déplacer
- **Clic molette** (2D & 3D) : panoramique de la vue (déplacement gauche/droite/haut/bas)
- **Numéros de waypoints** affichés sur la timeline au-dessus de chaque repère

### Cinématique / Kinematics
- Profil de vitesse **trapézoïdal** (accél. / décél.) — mode *Stop aux waypoints*
- Mode **Continu** (vitesse constante entre waypoints)
- Mode **Holonome** : déplacement et rotation simultanés, cap d'arrivée configurable par waypoint
- Vitesse et accélération **linéaires** indépendantes (mm/s ou m/s)
- Vitesse et accélération **angulaires** indépendantes (°/s ou rad/s)
- **Pause** configurable à chaque waypoint (panneau droit)
- **Pause Action** 💪 : pause pendant laquelle un émoji biceps clignote sur le robot — configurable par waypoint (panneau droit)
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
- Numéros de waypoints lisibles sur la timeline (badges colorés)
- Calcul du temps total corrigé : rotations d'arrivée et pauses action incluses

### Sauvegarde automatique / Auto-save
- **Sauvegarde automatique** dans le navigateur (localStorage) à chaque action — survit aux rafraîchissements et crashes
- Restauration automatique au démarrage
- Bouton **🗑 Effacer la sauvegarde** (onglet Réglages, maintenir 3 s) pour réinitialiser

### Intégration Git / Git Integration (onglet ⚙️ Réglages)
- **Sauvegarder → Git (commit)** : écrit le fichier JSON dans le repo local, commit et push automatiques vers GitHub / GitLab
- **Ouvrir → Git (pull)** : liste tous les fichiers JSON présents sur le repo distant, sélection visuelle, pull + chargement automatique
- Authentification : **token** (GitHub `ghp_…` / GitLab `glpat-…`) ou **login / mot de passe**
- Configuration : URL du dépôt, nom du fichier, branche, identifiants — persistés dans le localStorage
- Nécessite le serveur local `git-server.js` (voir section Développement)

### Table & Affichage / Table & Display (onglet ⚙️ Réglages)
- Image de fond par défaut : `public/table_FINALE_1.jpg`
- Couleur de surface de la table configurable
- Couleur d'arrière-plan (hors table) configurable
- Grille configurable (couleur, pas petite / grande grille)
- Mode **sombre / clair**
- Langue **FR / EN**

### Import STL
- Import de géométrie 3D `.stl` avec contrôle de rotation X / Y / Z

### Sauvegarde / Save & Export
- **Sauvegarder → Local** : téléchargement d'un JSON complet (robots, obstacles, configuration)
- **Sauvegarder → Git** : commit + push vers le dépôt Git configuré
- **Ouvrir → Local** : import d'une sauvegarde JSON depuis le disque
- **Ouvrir → Git** : liste les fichiers JSON du dépôt distant, pull + chargement
- **Exporter trajectoires JSON** : JSON des waypoints/segments (panneau droit, pour intégration embarquée)
- **Import Gazebo SDF** : import depuis un fichier `.world` / `.sdf` / `.xml` (acteurs → robots, modèles → obstacles, reconstruction automatique des waypoints depuis les trajectoires denses)
- **Export Gazebo SDF** : export de la scène au format Gazebo SDF (panneau droit)
- Annuler / Rétablir — Ctrl+Z / Ctrl+Y (60 niveaux)

---

## Installation (production)

```bash
sudo bash install.sh
```

Le script :
1. Clone le dépôt depuis `https://github.com/Acidpix/Pamis_Simulator_2000.git`
2. Installe Node.js 20 LTS si absent
3. Build (`npm run build`)
4. Crée et active deux services **systemd** :
   - `pamis-simulator-2000` — serveur statique (`serve`) sur le port **3000**
   - `pamis-git-server` — serveur git sur le port **3001**

```bash
# Vérifier les services
systemctl status pamis-simulator-2000
systemctl status pamis-git-server

# Logs en direct
journalctl -u pamis-simulator-2000 -f
journalctl -u pamis-git-server -f
```

> **Proxy inverse recommandé** : exposer les deux ports sous le même domaine via nginx / NPM.  
> Configurer un `location /git/` qui proxie vers `http://<machine>:3001` pour éviter les problèmes de mixed-content HTTPS.

---

## Développement / Development

```bash
npm install
npm run dev          # Vite dev server (port 5173)
node git-server.js   # Dans un second terminal
```

### Intégration Git — comment ça fonctionne

Le navigateur ne peut pas exécuter `git` directement. `git-server.js` est un serveur Node.js léger (aucune dépendance externe) qui reçoit les requêtes de l'app et exécute les commandes git.

Pour chaque opération (commit, pull, liste), le serveur :
1. Clone le dépôt distant dans un **dossier temporaire isolé** (`/tmp/pamis-XXXXXX/`)
2. Effectue l'opération (écriture du fichier → `git add` → `git commit` → `git push`)
3. Supprime le dossier temporaire

Cette approche garantit l'isolation totale entre utilisateurs et ne touche jamais au dossier de l'application.

**Configuration** (onglet ⚙️ Réglages dans l'app) :

| Champ | Exemple |
|---|---|
| URL du dépôt | `https://github.com/user/repo.git` |
| Nom du fichier | `pamis_config.json` |
| Branche | `main` |
| Token GitHub | `ghp_xxxxxxxxxxxx` |
| Token GitLab | `glpat-xxxxxxxxxxxx` |

> Les identifiants sont stockés dans le `localStorage` du navigateur et ne transitent que vers votre propre `git-server.js`.

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
    "startDelay": 0, "holonomic": false,
    "waypoints": [{ "x": 1.0, "y": 1.0, "pause": 0, "actionPause": 0 }]
  }],
  "obstacles": []
}
```

---

[https://github.com/Acidpix/Pamis_Simulator_2000](https://github.com/Acidpix/Pamis_Simulator_2000)
