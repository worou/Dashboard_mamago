#!/usr/bin/env bash
# =====================================================================
# MamaGo — deploiement sur un serveur Ubuntu/Debian vierge.
#
#   Front React (build statique)  ->  http://<IP>/
#   API PHP                        ->  http://<IP>/api
#   (meme origine : pas de probleme de CORS)
#
# Usage (en root) :
#   sudo bash deploy.sh <IP_PUBLIQUE> [CHEMIN_DEPLOIEMENT]
#   ex : sudo bash deploy.sh 180.149.198.241
#   ex : sudo bash deploy.sh 180.149.198.241 /home/nicodem/var/www/mamago/wmanager
#
# Idempotent pour la stack ; RE-EXECUTER REINITIALISE LA BASE (schema+seed).
# =====================================================================
set -euo pipefail

REPO_URL="https://github.com/worou/Dashboard_mamago.git"
# 2e argument = dossier de deploiement (defaut : /var/www/mamago)
APP_DIR="${2:-/var/www/mamago}"

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
echo "==> Dossier : $APP_DIR"
export DEBIAN_FRONTEND=noninteractive

# --- 1. Paquets systeme ----------------------------------------------
echo "==> Installation des paquets (Apache, PHP, MariaDB, git)..."
apt-get update -y
apt-get install -y apache2 mariadb-server git curl ca-certificates \
    php php-cli php-mysql php-mbstring php-xml php-curl libapache2-mod-php
# Node n'est PAS installe ici : le front est livre pre-construit (dist/).
# Il ne sera installe que si un rebuild est necessaire (voir etape 5).

a2enmod rewrite >/dev/null
systemctl enable --now apache2 mariadb >/dev/null 2>&1 || true

# --- 2. Code source ---------------------------------------------------
echo "==> Recuperation du code..."
mkdir -p "$(dirname "$APP_DIR")"
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

# --- 4. Environnement de l'API (api/.env, hors git) ------------------
echo "==> Ecriture de api/.env..."
cat > "$APP_DIR/api/.env" <<ENV
APP_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mamago
DB_USERNAME=mamago
DB_PASSWORD=${DB_PASS}
DB_CHARSET=utf8mb4
BASE_PATH=/api
CORS_ALLOWED_ORIGINS=*
JWT_SECRET=${JWT_SECRET}
JWT_TTL=28800
ENV
chmod 600 "$APP_DIR/api/.env"

# .htaccess de l'API : reecrire la base sur /api/
sed -i 's#RewriteBase /mamago/api/#RewriteBase /api/#' "$APP_DIR/api/.htaccess"

# Jeu de donnees de demonstration
echo "==> Chargement des donnees de demonstration..."
php "$APP_DIR/api/database/seed.php"

# --- 5. Front : build de prod pre-livre, sinon reconstruction --------
# Le depot contient deja frontend/dist construit pour l'IP cible. On ne
# reconstruit (et n'installe Node) que si ce build ne correspond pas.
if [ -f "$APP_DIR/frontend/dist/index.html" ] && grep -rq "$SERVER_IP" "$APP_DIR/frontend/dist" 2>/dev/null; then
  echo "==> Front pre-construit pour $SERVER_IP detecte — pas de build a faire."
else
  echo "==> Reconstruction du front (installation de Node 20)..."
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)" -lt 18 ] 2>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  cat > "$APP_DIR/frontend/.env" <<ENV
VITE_API_URL=http://${SERVER_IP}/api
VITE_INTERFACE_BASE_URL=http://${SERVER_IP}
ENV
  ( cd "$APP_DIR/frontend" && npm install --no-audit --no-fund && npm run build )
fi

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

    # Documentation Swagger sous /swagger
    Alias /swagger ${APP_DIR}/swagger
    <Directory ${APP_DIR}/swagger>
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

# Apache doit pouvoir TRAVERSER chaque dossier parent jusqu'au dist.
# Indispensable si le deploiement est sous /home/... (sinon 403 Forbidden).
# o+x = traversee seule (n'expose pas le listing du contenu).
_p="$APP_DIR"
while [ "$_p" != "/" ] && [ -n "$_p" ]; do
  chmod o+x "$_p" 2>/dev/null || true
  _p="$(dirname "$_p")"
done

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
