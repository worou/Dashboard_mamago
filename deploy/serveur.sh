#!/usr/bin/env bash
# =====================================================================
# MamaGo — deploiement sur VPS Ubuntu (root) dans /var/www/html.
#
# Pour un serveur ou Apache tourne deja (page « It works! ») et une base
# « wmanager » deja creee (importee via phpMyAdmin).
#
#   http://<IP>/          front React
#   http://<IP>/api       API PHP
#   http://<IP>/swagger   documentation Swagger
#
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/worou/Dashboard_mamago/main/deploy/serveur.sh -o /tmp/serveur.sh
#   sudo bash /tmp/serveur.sh
# =====================================================================
set -euo pipefail

REPO="https://github.com/worou/Dashboard_mamago.git"
SRC="/opt/mamago-src"
DOCROOT="/var/www/html"
IP="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

if [ "$(id -u)" -ne 0 ]; then
  echo "!! A lancer en root : sudo bash /tmp/serveur.sh" >&2
  exit 1
fi

echo "==> Deploiement MamaGo dans $DOCROOT (serveur $IP)"

# --- Infos base de donnees (jamais stockees dans git) ----------------
read -rp  "Hote MySQL de la base wmanager [localhost] : " DBHOST
DBHOST="${DBHOST:-localhost}"
read -rsp "Mot de passe MySQL de l'utilisateur 'wmanager' : " DBPASS
echo

# --- 1. Paquets (Apache est deja la ; on complete PHP) ---------------
echo "==> Paquets..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git apache2 php php-cli php-mysql php-mbstring php-xml php-curl libapache2-mod-php

# --- 2. Code source ---------------------------------------------------
echo "==> Recuperation du code..."
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" fetch --all -q && git -C "$SRC" reset --hard origin/main -q
else
  rm -rf "$SRC"
  git clone -q "$REPO" "$SRC"
fi

if [ ! -f "$SRC/frontend/dist/index.html" ]; then
  echo "!! Build du front introuvable dans le depot. Abandon." >&2
  exit 1
fi

# --- 3. Assemblage du web root ---------------------------------------
echo "==> Assemblage de $DOCROOT..."
rm -f  "$DOCROOT/index.html"
rm -rf "$DOCROOT/assets" "$DOCROOT/api" "$DOCROOT/swagger"
cp -r "$SRC/frontend/dist/." "$DOCROOT/"
cp -r "$SRC/api"     "$DOCROOT/api"
rm -rf "$DOCROOT/api/database"          # jamais expose sur le web
cp -r "$SRC/swagger" "$DOCROOT/swagger"

# .htaccess racine (React SPA)
cat > "$DOCROOT/.htaccess" <<'HT'
RewriteEngine On
RewriteBase /
RewriteRule ^api(/|$) - [L]
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ index.html [L]
HT
# base de l'API sur /api
sed -i 's#RewriteBase /mamago/api/#RewriteBase /api/#' "$DOCROOT/api/.htaccess"

# --- 4. Connexion base -> api/.env -----------------------------------
echo "==> Ecriture de api/.env..."
{
  printf 'APP_ENV=production\n'
  printf 'DB_HOST=%s\n'     "$DBHOST"
  printf 'DB_PORT=3306\n'
  printf 'DB_DATABASE=wmanager\n'
  printf 'DB_USERNAME=wmanager\n'
  printf 'DB_PASSWORD=%s\n' "$DBPASS"
  printf 'DB_CHARSET=utf8mb4\n'
  printf 'BASE_PATH=/api\n'
  printf 'CORS_ALLOWED_ORIGINS=*\n'
  printf 'JWT_SECRET=%s\n'  "$(openssl rand -hex 32)"
  printf 'JWT_TTL=28800\n'
} > "$DOCROOT/api/.env"

# --- 5. Autoriser .htaccess + mod_rewrite ----------------------------
echo "==> Apache (AllowOverride + rewrite)..."
a2enmod rewrite >/dev/null
cat > /etc/apache2/conf-available/mamago.conf <<'CONF'
<Directory /var/www/html>
    AllowOverride All
    Require all granted
</Directory>
CONF
a2enconf mamago >/dev/null
chown -R www-data:www-data "$DOCROOT"
chmod 640 "$DOCROOT/api/.env"

# --- 6. Test config + reload -----------------------------------------
apache2ctl configtest
systemctl reload apache2

# --- 7. Verification --------------------------------------------------
echo
echo "===================== VERIFICATION ====================="
printf '  /            -> HTTP %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)"
printf '  /swagger/    -> HTTP %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/swagger/)"
printf '  /api/health  -> '; curl -s http://localhost/api/health; echo
echo "========================================================"
echo
echo "  App     : http://$IP/"
echo "  Swagger : http://$IP/swagger/   (choisir le serveur /api)"
echo "  Health  : http://$IP/api/health"
echo
echo "  Si /api/health n'affiche PAS {\"success\":true,...} :"
echo "    - erreur 500 => base injoignable : verifier DB_HOST / mot de passe"
echo "      dans $DOCROOT/api/.env, et que wmanager accepte ce serveur."
echo "  Pense a importer deploy/wmanager_seed.sql dans wmanager (phpMyAdmin)"
echo "  si ce n'est pas deja fait (sinon le login echouera)."
