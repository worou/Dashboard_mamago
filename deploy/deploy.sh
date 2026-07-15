#!/usr/bin/env bash
# =====================================================================
# MamaGo — deploiement sur un serveur Ubuntu/Debian vierge.
#
#   Front React (build statique)  ->  http://<IP>/
#   API PHP                        ->  http://<IP>/api
#   (meme origine : pas de probleme de CORS)
#
# Usage (en root) :
#   sudo bash deploy.sh <IP_PUBLIQUE>
#   ex : sudo bash deploy.sh 180.149.198.241
#
# Idempotent pour la stack ; RE-EXECUTER REINITIALISE LA BASE (schema+seed).
# =====================================================================
set -euo pipefail

REPO_URL="https://github.com/worou/Dashboard_mamago.git"
APP_DIR="/var/www/mamago"

# --- IP publique (argument, sinon auto-detection) --------------------
SERVER_IP="${1:-}"
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  [ -z "$SERVER_IP" ] && SERVER_IP="$(hostname -I | awk '{print $1}')"
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "!! A lancer en root : sudo bash deploy.sh $SERVER_IP" >&2
  exit 1
fi

echo "==> Deploiement de MamaGo sur http://$SERVER_IP/"
export DEBIAN_FRONTEND=noninteractive

# --- 1. Paquets systeme ----------------------------------------------
echo "==> Installation des paquets (Apache, PHP, MariaDB, git)..."
apt-get update -y
apt-get install -y apache2 mariadb-server git curl ca-certificates \
    php php-cli php-mysql php-mbstring php-xml php-curl libapache2-mod-php

# Node.js 20 (Vite 5 exige Node >= 18 ; le depot Ubuntu est souvent trop ancien)
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  if [ "${NODE_MAJOR:-0}" -ge 18 ] 2>/dev/null; then NEED_NODE=0; fi
fi
if [ "$NEED_NODE" -eq 1 ]; then
  echo "==> Installation de Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

a2enmod rewrite >/dev/null
systemctl enable --now apache2 mariadb >/dev/null 2>&1 || true

# --- 2. Code source ---------------------------------------------------
echo "==> Recuperation du code..."
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all -q && git -C "$APP_DIR" reset --hard origin/main -q
else
  rm -rf "$APP_DIR"
  git clone -q "$REPO_URL" "$APP_DIR"
fi

# --- 3. Base de donnees ----------------------------------------------
echo "==> Configuration de la base de donnees..."
DB_PASS="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"

mysql <<SQL
DROP DATABASE IF EXISTS mamago;
CREATE DATABASE mamago CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mamago'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS 'mamago'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'mamago'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'mamago'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON mamago.* TO 'mamago'@'127.0.0.1';
GRANT ALL PRIVILEGES ON mamago.* TO 'mamago'@'localhost';
FLUSH PRIVILEGES;
SQL

mysql mamago < "$APP_DIR/api/database/schema.sql"

# --- 4. Config API (creds + base_path = /api) ------------------------
echo "==> Ecriture de la configuration de l'API..."
cat > "$APP_DIR/api/config.php" <<PHP
<?php
// Genere par deploy.sh — ne pas committer.
return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'database' => 'mamago',
        'username' => 'mamago',
        'password' => '${DB_PASS}',
        'charset'  => 'utf8mb4',
    ],
    'base_path'            => '/api',
    'cors_allowed_origins' => '*',
    'jwt_secret'           => '${JWT_SECRET}',
    'jwt_ttl'              => 28800,
];
PHP

# .htaccess de l'API : reecrire la base sur /api/
sed -i 's#RewriteBase /mamago/api/#RewriteBase /api/#' "$APP_DIR/api/.htaccess"

# Jeu de donnees de demonstration
echo "==> Chargement des donnees de demonstration..."
php "$APP_DIR/api/database/seed.php"

# --- 5. Build du front (pointe vers l'API du serveur) ----------------
echo "==> Build du front React..."
cat > "$APP_DIR/frontend/.env" <<ENV
VITE_API_URL=http://${SERVER_IP}/api
VITE_INTERFACE_BASE_URL=http://${SERVER_IP}
ENV

cd "$APP_DIR/frontend"
npm install --no-audit --no-fund
npm run build

# --- 6. VirtualHost Apache -------------------------------------------
echo "==> Configuration d'Apache..."
cat > /etc/apache2/sites-available/mamago.conf <<APACHE
<VirtualHost *:80>
    ServerName ${SERVER_IP}
    DocumentRoot ${APP_DIR}/frontend/dist

    # API PHP sous /api
    Alias /api ${APP_DIR}/api
    <Directory ${APP_DIR}/api>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Front React (SPA) — repli vers index.html pour les liens profonds
    <Directory ${APP_DIR}/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/mamago_error.log
    CustomLog \${APACHE_LOG_DIR}/mamago_access.log combined
</VirtualHost>
APACHE

a2dissite 000-default.conf >/dev/null 2>&1 || true
a2ensite mamago.conf >/dev/null
chown -R www-data:www-data "$APP_DIR"
systemctl reload apache2

# Pare-feu : ouvrir le port 80 si ufw est actif (sans couper le SSH)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null 2>&1 || true
fi

# --- 7. Verification --------------------------------------------------
echo "==> Verification..."
sleep 1
HEALTH="$(curl -fsS "http://localhost/api/health" 2>/dev/null || echo 'ECHEC')"

cat <<DONE

=====================================================================
 MamaGo est deploye.

   Application : http://${SERVER_IP}/
   API         : http://${SERVER_IP}/api
   Swagger     : http://${SERVER_IP}/swagger/openapi.yaml
   Sante API   : ${HEALTH}

 Comptes de demo (mot de passe : password) :
   admin@mamago.com        SuperAdmin
   ci.admin@mamago.com     Admin Pays (Cote d'Ivoire)
   commercial@mamago.com   Commercial (portefeuille : Dakar)

 A FAIRE cote securite :
   - Changer les mots de passe de demo.
   - Le mot de passe MySQL genere est dans ${APP_DIR}/api/config.php
   - Envisager HTTPS (certbot) si un domaine pointe vers ce serveur.
=====================================================================
DONE
