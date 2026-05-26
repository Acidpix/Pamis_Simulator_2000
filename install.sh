#!/usr/bin/env bash
# install.sh — déploiement de Pamis_Simulator_2000 dans /opt
# Usage: sudo bash install.sh [--port 3000] [--user www-data] [--branch main]

set -euo pipefail

# ── Paramètres ───────────────────────────────────────────────────────────────
APP_NAME="pamis-simulator-2000"
GIT_SERVICE="pamis-git-server"
REPO_URL="https://github.com/Acidpix/Pamis_Simulator_2000.git"
INSTALL_DIR="/opt/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
PORT="${PORT:-3000}"
RUN_AS="${RUN_AS:-www-data}"
BRANCH="main"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port)    PORT="$2";    shift 2 ;;
    --user)    RUN_AS="$2";  shift 2 ;;
    --branch)  BRANCH="$2";  shift 2 ;;
    *)         echo "Option inconnue: $1"; exit 1 ;;
  esac
done

# ── Vérifications ─────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (sudo)." >&2
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "Dépendance manquante : git" >&2
  exit 1
fi

if ! command -v curl &>/dev/null; then
  echo "Dépendance manquante : curl" >&2
  exit 1
fi

# ── Installation de Node.js + npm si absents ──────────────────────────────────
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo "==> Node.js / npm non trouvés, installation via NodeSource (Node 20 LTS)"
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo "Gestionnaire de paquets non supporté. Installez Node.js 20+ manuellement." >&2
    exit 1
  fi
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ $NODE_MAJOR -lt 20 ]]; then
  echo "Node.js >= 20 requis (version actuelle : $(node -v))" >&2
  exit 1
fi

# ── Installation de serve (serveur statique de prod) ─────────────────────────
if ! command -v serve &>/dev/null; then
  echo "==> Installation de serve globalement"
  npm install -g serve
fi

echo "==> Installation de ${APP_NAME} dans ${INSTALL_DIR} (port ${PORT}, user ${RUN_AS})"

# ── Clone ou mise à jour du dépôt ────────────────────────────────────────────
git config --global --add safe.directory "${INSTALL_DIR}"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  echo "==> Dépôt existant détecté, mise à jour (git pull)"
  git -C "${INSTALL_DIR}" fetch origin
  git -C "${INSTALL_DIR}" checkout "${BRANCH}"
  git -C "${INSTALL_DIR}" pull --ff-only origin "${BRANCH}"
else
  echo "==> git clone ${REPO_URL} (branche ${BRANCH})"
  git clone --branch "${BRANCH}" --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
fi

# ── Build de production ───────────────────────────────────────────────────────
echo "==> npm ci + vite build"
cd "${INSTALL_DIR}"
npm ci 2>&1 | tail -5          # inclut les devDeps (vite, plugin-react…)
NODE_OPTIONS="--max-old-space-size=512" npm run build
npm prune --omit=dev           # supprime les devDeps après le build

# ── Permissions ───────────────────────────────────────────────────────────────
if ! id "${RUN_AS}" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${RUN_AS}"
fi
chown -R "${RUN_AS}:${RUN_AS}" "${INSTALL_DIR}"

# ── Service systemd ───────────────────────────────────────────────────────────
SERVE_BIN=$(command -v serve)

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Pamis Simulator 2000
After=network.target

[Service]
Type=simple
User=${RUN_AS}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${SERVE_BIN} -s dist -l ${PORT}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Hardening minimal
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${APP_NAME}"

# ── Service systemd git-server ─────────────────────────────────────────────────
NODE_BIN=$(command -v node)
GIT_SERVICE_FILE="/etc/systemd/system/${GIT_SERVICE}.service"

cat > "${GIT_SERVICE_FILE}" <<EOF
[Unit]
Description=Pamis Simulator 2000 — Git server
After=network.target

[Service]
Type=simple
User=${RUN_AS}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${NODE_BIN} ${INSTALL_DIR}/git-server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${GIT_SERVICE}

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${GIT_SERVICE}"

echo ""
echo "✓ App  démarrée : systemctl status ${APP_NAME}"
echo "✓ App  port     : http://0.0.0.0:${PORT}"
echo "✓ Git server    : systemctl status ${GIT_SERVICE}  (port 3001)"
echo ""
echo "Commandes utiles :"
echo "  journalctl -u ${APP_NAME} -f          # logs app"
echo "  journalctl -u ${GIT_SERVICE} -f       # logs git server"
echo "  systemctl restart ${APP_NAME}         # redémarrage app"
echo "  systemctl restart ${GIT_SERVICE}      # redémarrage git server"
echo ""
echo "Pour mettre à jour : sudo bash ${INSTALL_DIR}/install.sh"
