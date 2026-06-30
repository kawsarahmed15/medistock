#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_DIR/backend"
LSWS_HTTPD_CONF="/usr/local/lsws/conf/httpd_config.conf"
LSWS_VHOST_CONF="/usr/local/lsws/conf/vhosts/medistock.teklin.in/vhost.conf"

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -p 'parseInt(process.versions.node.split(".")[0], 10)'
}

ensure_node() {
  local current_major
  current_major="$(node_major_version)"

  if [[ "$current_major" -ge 20 ]] && command -v npm >/dev/null 2>&1; then
    return
  fi

  if [[ "$current_major" -gt 0 ]]; then
    echo "Node.js version $current_major detected, upgrading to Node.js 20+..."
  else
    echo "Node.js/npm not found. Installing Node.js 20+..."
  fi

  if command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf remove -y nodejs npm nodejs-libs nodejs-docs nodejs-full-i18n >/dev/null 2>&1 || true
    dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum remove -y nodejs npm nodejs-libs nodejs-docs nodejs-full-i18n >/dev/null 2>&1 || true
    yum install -y nodejs
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl ca-certificates gnupg
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    echo "Unsupported OS package manager. Install Node.js 20+ and npm manually."
    exit 1
  fi

  node -v
  npm -v

  if [[ "$(node_major_version)" -lt 20 ]]; then
    echo "Node.js 20+ is still not available after installation. Please install Node.js 20 or 22 manually."
    exit 1
  fi
}

configure_lsws() {
  if [[ ! -f "$LSWS_HTTPD_CONF" ]] || [[ ! -d "/usr/local/lsws/bin" ]]; then
    echo "OpenLiteSpeed config not found. Skipping reverse-proxy setup."
    return
  fi

  echo "Configuring OpenLiteSpeed reverse proxy"

  cp "$LSWS_HTTPD_CONF" "$LSWS_HTTPD_CONF.bak.$(date +%Y%m%d%H%M%S)"

  if ! grep -q '^extprocessor node_medistock {' "$LSWS_HTTPD_CONF"; then
    cat >>"$LSWS_HTTPD_CONF" <<'EOF'
extprocessor node_medistock {
  type                    proxy
  address                 127.0.0.1:8080
  maxConns                100
  initConns               10
  respBuffer              0
  autoStart               0
}
EOF
  fi

  if ! grep -q '^extprocessor node_medistock_api {' "$LSWS_HTTPD_CONF"; then
    cat >>"$LSWS_HTTPD_CONF" <<'EOF'
extprocessor node_medistock_api {
  type                    proxy
  address                 127.0.0.1:4000
  maxConns                100
  initConns               10
  respBuffer              0
  autoStart               0
}
EOF
  fi

  sed -i '/^extprocessor node_medistock {/,/^}/ s/type[[:space:]]\+.*/type                    proxy/' "$LSWS_HTTPD_CONF"
  sed -i '/^extprocessor node_medistock {/,/^}/ s/address[[:space:]]\+.*/address                 127.0.0.1:8080/' "$LSWS_HTTPD_CONF"
  sed -i '/^extprocessor node_medistock_api {/,/^}/ s/type[[:space:]]\+.*/type                    proxy/' "$LSWS_HTTPD_CONF"
  sed -i '/^extprocessor node_medistock_api {/,/^}/ s/address[[:space:]]\+.*/address                 127.0.0.1:4000/' "$LSWS_HTTPD_CONF"

  mkdir -p "$(dirname "$LSWS_VHOST_CONF")"
  cat >"$LSWS_VHOST_CONF" <<'EOF'
docRoot                   /home/teklin.in/medistock.teklin.in
vhDomain                  medistock.teklin.in
vhAliases                 www.medistock.teklin.in
enableGzip                1

context /api {
  type                    proxy
  handler                 node_medistock_api
  addDefaultCharset       off
}

context / {
  type                    proxy
  handler                 node_medistock
  addDefaultCharset       off
}

vhssl  {
  keyFile                 /etc/letsencrypt/live/medistock.teklin.in/privkey.pem
  certFile                /etc/letsencrypt/live/medistock.teklin.in/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}
EOF

  /usr/local/lsws/bin/lswsctrl restart
}

cd "$PROJECT_DIR"

echo "[0/7] Checking Node.js and npm"
ensure_node

echo "[1/7] Installing frontend dependencies"
npm install

echo "[2/7] Installing backend dependencies"
cd "$BACKEND_DIR"
npm install

echo "[3/7] Running MySQL migration"
npm run migrate

cd "$PROJECT_DIR"
echo "[4/7] Building frontend"
npm run build

echo "[5/7] Installing PM2 if missing"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "[6/7] Starting services via PM2"
pm2 startOrRestart ecosystem.config.cjs --update-env

configure_lsws

echo "[7/7] Saving PM2 process list"
pm2 save

echo "Deployment complete."
pm2 ls