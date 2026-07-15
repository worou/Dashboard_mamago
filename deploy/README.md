# Déploiement de MamaGo (serveur Ubuntu/Debian)

Déploie l'application sur un VPS **vierge**, servie sur l'IP publique :

- **Front React** (build statique) → `http://<IP>/`
- **API PHP** → `http://<IP>/api`

Front et API sur la **même origine** : aucun problème de CORS.

## Prérequis

- Un serveur Ubuntu 22.04+/Debian 12+ avec accès **root** (ou `sudo`).
- Le port **80** ouvert (et **22** pour le SSH).

## Déploiement en 3 commandes

Connecté en SSH sur le serveur :

```bash
# 1. git (souvent absent sur un serveur vierge)
sudo apt-get update && sudo apt-get install -y git

# 2. Récupérer le projet
git clone https://github.com/worou/Dashboard_mamago.git ~/mamago

# 3. Lancer le déploiement (passe ton IP publique en argument)
sudo bash ~/mamago/deploy/deploy.sh 180.149.198.241
```

Le script installe Apache, PHP 8, MariaDB et Node 20, clone le code dans
`/var/www/mamago`, crée la base + charge le schéma et les données de démo,
configure l'API (`base_path = /api`, identifiants MySQL générés, secret JWT
aléatoire), build le front vers l'IP, puis publie le VirtualHost Apache.

À la fin, il affiche l'URL, l'état de l'API et les comptes de démo.

## Après le déploiement

Ouvrir **`http://180.149.198.241/`** et se connecter :

| Compte | Rôle |
|--------|------|
| `admin@mamago.com` / `password` | SuperAdmin |
| `ci.admin@mamago.com` / `password` | Admin Pays (Côte d'Ivoire) |
| `commercial@mamago.com` / `password` | Commercial (portefeuille : Dakar) |

### Sécurité — à faire

- **Changer les mots de passe de démo** (ou les supprimer et créer les vôtres).
- **Changer le mot de passe SSH** partagé pendant la mise en place, et passer
  à une **clé SSH**.
- Le mot de passe MySQL généré se trouve dans `/var/www/mamago/api/config.php`
  (ce fichier est régénéré à chaque exécution du script).
- Si un **nom de domaine** pointe vers le serveur, activer HTTPS :
  ```bash
  sudo apt-get install -y certbot python3-certbot-apache
  sudo certbot --apache -d mon-domaine.tld
  ```
  Puis rebuild le front avec `VITE_API_URL=https://mon-domaine.tld/api`.

## Mettre à jour l'application

Pour redéployer après un nouveau `git push` :

```bash
sudo bash ~/mamago/deploy/deploy.sh 180.149.198.241
```

> ⚠️ Ré-exécuter le script **réinitialise la base** (schéma + données de démo).
> Si l'application contient déjà des données réelles, faites une sauvegarde
> avant (`mysqldump mamago > sauvegarde.sql`) — ou adaptez le script pour ne
> pas relancer `schema.sql` / `seed.php`.

## Dépannage

- **Page blanche / 404 sur les liens profonds** : vérifier que `mod_rewrite`
  est actif (`sudo a2enmod rewrite && sudo systemctl reload apache2`) et que le
  build a bien produit `/var/www/mamago/frontend/dist`.
- **Erreur 500 sur `/api`** : consulter `sudo tail -f /var/log/apache2/mamago_error.log`.
- **API injoignable** : `curl http://localhost/api/health` doit répondre
  `{"success":true,...}`.
