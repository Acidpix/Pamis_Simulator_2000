#!/usr/bin/env bash
# install.sh — déploiement de Pamis_Simulator_2000 dans /opt
# Usage: sudo bash install.sh [--port 3000] [--user www-data] [--branch main]

set -euo pipefail

# ── Paramètres ───────────────────────────────────────────────────────────────
APP_NAME="pamis-simulator-2000"
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

# ── Installation de Vite globalement si absent ────────────────────────────────
if ! command -v vite &>/dev/null; then
  echo "==> Installation de vite globalement"
  npm install -g vite
fi

echo "==> Installation de ${APP_NAME} dans ${INSTALL_DIR} (port ${PORT}, user ${RUN_AS})"

# ── Clone ou mise à jour du dépôt ────────────────────────────────────────────
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
npm ci --omit=dev 2>&1 | tail -5
npm run build

# ── Permissions ───────────────────────────────────────────────────────────────
if ! id "${RUN_AS}" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${RUN_AS}"
fi
chown -R "${RUN_AS}:${RUN_AS}" "${INSTALL_DIR}"

# ── Service systemd ───────────────────────────────────────────────────────────
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Pamis Simulator 2000
After=network.target

[Service]
Type=simple
User=${RUN_AS}
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(command -v npm) run preview -- --port ${PORT} --host
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

echo ""
echo "✓ Service démarré : systemctl status ${APP_NAME}"
echo "✓ Accessible sur  : http://0.0.0.0:${PORT}"
echo ""
echo "Commandes utiles :"
echo "  journalctl -u ${APP_NAME} -f      # logs en direct"
echo "  systemctl restart ${APP_NAME}     # redémarrage"
echo "  systemctl stop    ${APP_NAME}     # arrêt"
echo ""
echo "Pour mettre à jour : sudo bash ${INSTALL_DIR}/install.sh"
