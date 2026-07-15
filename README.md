# MamaGo &mdash; API + Swagger (Manager Word par pays)

API REST en **PHP 8 / PDO** (sans dépendance, sous XAMPP/Apache) pour alimenter
un front-end **React**. Couvre le tableau de bord, les statistiques par pays,
la gestion des utilisateurs/rôles/droits et la traçabilité, d'après le MPD MamaGo.

## Prérequis

- XAMPP (Apache + MySQL/MariaDB), PHP 8.0+
- Base de données `mamago` créée avec le schéma du MPD
- Projet placé dans `c:\xampp\htdocs\mamago`

## Installation

```bash
# 1. Apache + MySQL démarrés depuis le panneau XAMPP
# 2. Créer la base et charger le schéma (tables)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS mamago CHARACTER SET utf8mb4"
mysql -u root mamago < api/database/schema.sql
# 3. Charger un jeu de données de démonstration (~4 mois d'historique)
php api/database/seed.php
```

Le seed crée pays, villes, services, ~73 clients, ~32 livreurs, 700 courses,
leurs paiements, et **3 comptes de test** (mot de passe : `password`) :

| Email | Rôle | Périmètre |
|-------|------|-----------|
| `admin@mamago.com` | SuperAdmin | Tous les pays |
| `ci.admin@mamago.com` | Admin Pays | Côte d'Ivoire |
| `commercial@mamago.com` | Commercial | Sénégal |

## URLs

- **API** : `http://localhost/mamago/api`
- **Documentation Swagger** : `http://localhost/mamago/swagger/`

## Authentification et cloisonnement par pays

`POST /auth/login` renvoie un jeton **Bearer** (HMAC-SHA256, valable 8 h).

```bash
curl -X POST http://localhost/mamago/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mamago.com","mot_de_passe":"password"}'
```

**Toutes les routes** (sauf `/health` et `/auth/login`) exigent l'en-tête
`Authorization: Bearer <token>`. Le **périmètre** de l'utilisateur en est
déduit côté serveur — le cloisonnement est appliqué par l'**API**, pas
seulement par l'interface.

## Gestion des rôles

| Rôle | Portée |
|------|--------|
| **SuperAdmin** | **Accès global** à la plateforme. Seul habilité à créer un pays, valider les demandes de compte, gérer rôles et droits. |
| **Admin Pays** | Accès **limité au pays qui lui est attribué** (`utilisateur_pays`). Consulte les données, suit les performances, accède aux rapports de son périmètre. Crée les comptes commerciaux de son pays **via une demande soumise au SuperAdmin** ; une fois validés, il les modifie et les désactive directement. Hors périmètre → **403**. |
| **Commercial** | Accès **limité à son portefeuille** = une **ville** (`utilisateur_ville`). Sélectionner une ville inclut **tous ses services** (restaurant, shopping…). **Lecture seule** — toute écriture → **403**. |

### Workflow de validation d'un compte commercial

L'Admin Pays ne crée pas le compte : il soumet une **demande**. Le compte
n'existe **qu'après validation** par le SuperAdmin.

```
ADMIN PAYS                              SUPERADMIN
──────────────────────────────────────────────────────────
POST /demandes  ──────────────────────► statut « en_attente »
(nom, email, mot de passe, ville)              │
                                    PUT /demandes/{id}/valider
                                    PUT /demandes/{id}/refuser
                                               │
                                     ▼ compte Commercial créé
                                       + portefeuille (ville) attribué
```

Tant que la demande n'est pas validée, la connexion avec cet e-mail renvoie
**401** — aucun compte n'existe en base.

## Interface admin par pays (générée dynamiquement)

Chaque pays présent en base dispose automatiquement de son **espace
d'administration** (`/admin/:paysId` côté front) : villes, livreurs, clients
et courses, en CRUD complet — le tout cloisonné au pays.

À la création d'un pays, l'API peut **provisionner son compte Admin Pays** :

```bash
curl -X POST http://localhost/mamago/api/pays \
  -H "Authorization: Bearer <token-superadmin>" \
  -H "Content-Type: application/json" \
  -d '{
        "nom_pays":"Niger", "code_iso":"NE", "devise":"XOF",
        "creer_admin": true,
        "admin": {"nom":"Souley","prenom":"Hadiza","mot_de_passe":"secret123"}
      }'
```

L'opération est **transactionnelle** : elle crée le pays, le compte
`Admin Pays` (email généré en `admin.ne@mamago.com` si non fourni) et son
rattachement au périmètre. Le nouvel admin peut se connecter immédiatement et
ne voit **que son pays**.

## Conventions

- **Réponses** : `{ "success": true, "data": ... }` ; listes paginées ajoutent
  `meta: { total, page, per_page, total_pages }`.
- **Erreurs** : `{ "success": false, "error": "...", "details": ... }` avec le
  bon code HTTP (401, 404, 405, 409, 422, 500).
- **Périodes** : `?from=YYYY-MM-DD&to=YYYY-MM-DD`, ou `?periode=YYYY-MM`.
  Défaut = mois calendaire courant. L'évolution compare à la période
  précédente de même durée.
- **Pagination** : `?page=1&per_page=25` (max 200).

## Endpoints principaux

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/auth/login` | Connexion |
| GET | `/auth/me` | Profil courant |
| GET | `/dashboard` | CA global + pays (CA, évolution) — cloisonné |
| GET | `/stats/evolution` | Série mensuelle du CA (courbe + sparklines) |
| GET | `/pays`, `/pays/{id}` | Liste / détail pays — cloisonné |
| POST | `/pays` | Créer un pays **+ provisionner son admin** (SuperAdmin) |
| CRUD | `/villes` | Villes de l'espace pays — cloisonné |
| GET | `/pays/{id}/stats` | CA ville+service, évolution clients, paiements, livreurs |
| GET | `/stats/paiements` | Répartition par type de paiement |
| GET | `/villes`, `/services` | Référentiel |
| GET | `/clients`, `/livreurs`, `/courses`, `/paiements` | Données opérationnelles (filtrables) |
| GET/POST/PUT/DELETE | `/utilisateurs` | Gestion des comptes |
| GET/PUT | `/roles`, `/roles/{id}/droits` | Rôles et droits d'accès |
| GET | `/connexions` | Historique connexions / actions / IP |
| GET | `/rapports/export?pays_id=&type=csv\|pdf` | Export CSV / PDF |

Documentation complète et essais en direct dans **Swagger**.

## Source de vérité du CA

Tout le chiffre d'affaires est calculé à partir de `courses.montant` pour les
courses au statut **`terminee`**. Les colonnes `pays.ca_global` et la table
`stats_ca_ville_service` sont des agrégats recalculés depuis cette même source
par le seed (les chiffres se réconcilient entre tous les endpoints).

> ⚠️ `ca_global` global additionne des montants en devises différentes
> (XOF, EUR) sans conversion, conformément au modèle. Le CA par pays reste
> cohérent (une seule devise par pays).

## Utilisation depuis React

```js
// api.js
const BASE = "http://localhost/mamago/api";

async function login(email, mot_de_passe) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, mot_de_passe }),
  });
  const { data } = await r.json();
  localStorage.setItem("token", data.token);
  return data.utilisateur;
}

async function api(path) {
  const token = localStorage.getItem("token");
  const r = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return (await r.json()).data;
}

// Exemples
const dashboard = await api("/dashboard?periode=2026-06");
const statsCI   = await api("/pays/1/stats?from=2026-01-01&to=2026-12-31");
const clients   = await api("/clients?pays_id=1&statut=actif&page=1");
```

## Structure

```
mamago/
├── api/
│   ├── index.php            # front controller + routes + CORS
│   ├── config.php           # BDD, base_path, CORS, secret JWT
│   ├── .htaccess            # réécriture Apache -> index.php
│   ├── core/                # Database, Request, Response, Router, Auth, Model, Period, SimplePdf
│   ├── controllers/         # un contrôleur par domaine
│   └── database/seed.php    # jeu de données de démonstration
├── swagger/
│   ├── index.html           # Swagger UI
│   └── openapi.yaml         # spécification OpenAPI 3.0
└── README.md
```

## Configuration

`api/config.php` : identifiants MySQL (défaut XAMPP `root` sans mot de passe),
`base_path` (`/mamago/api`), `cors_allowed_origins` (`*` en dev — restreindre
en production) et `jwt_secret` (**à changer en production**).
