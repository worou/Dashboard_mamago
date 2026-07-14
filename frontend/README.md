# MamaGo — Front-end React

Interface d'administration **React + Vite** pour le module « Manager par pays »,
branchée sur l'API PHP (`http://localhost/mamago/api`). Thème **noir & vert**,
mode **sombre / clair**, d'après la maquette MamaGo.

## Prérequis

- L'API MamaGo doit tourner (XAMPP : Apache + MySQL, base `mamago` remplie via
  `php ../api/database/seed.php`).
- Node.js 18+.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
```

Se connecter avec un compte de démo (mot de passe `password`) :
`admin@mamago.com` · `ci.admin@mamago.com` · `commercial@mamago.com`.

L'app appelle l'API en cross-origin (React sur `:5173`, API sur `:80`) — le
CORS est déjà géré côté PHP. Pour pointer vers une autre URL d'API :

```bash
# .env
VITE_API_URL=http://mon-serveur/mamago/api
```

## Écrans

| Route | Écran | Données |
|-------|-------|---------|
| `/` | Dashboard | `GET /dashboard`, `GET /stats/evolution` (KPIs, courbe CA, donut, tableau pays) |
| `/pays` | Pays | cartes par pays, recherche, tri, création (pays **+ son admin**) |
| `/admin/:id` | **Espace pays** | CRUD villes / livreurs / clients / courses, cloisonné au pays |
| `/stats/:id` | Stat par pays | `GET /pays/{id}/stats` : CA ville/service, évolution clients, paiements, livreurs + export CSV/PDF (période 7 j / 1 mois / 2 mois) |
| `/utilisateurs` | Utilisateurs | `GET/POST/PUT/DELETE /utilisateurs`, cartes de rôles (SuperAdmin uniquement) |
| `/parametres` | Paramètres | thème/accent + activités (`GET /connexions`) |

### Interface pays générée + son URL

Le menu **« Interface pays »** demande le pays dans un champ, puis **génère
l'URL** à laquelle son interface est affichée — construite à partir du **code
du pays** :

```
http://localhost:5173/interface/ci      # Côte d'Ivoire
http://localhost:5173/interface/sn      # Sénégal
```

L'URL est affichée avec un bouton **Copier**, s'ouvre dans l'app ou dans un
nouvel onglet, reste **valable** et rejoue l'interface avec les données à jour.
La route accepte le code ISO (`ci`) ou l'id (`1`).

Pour un domaine dédié (ex. `https://admin.mamagoapps.com/interface/ci`) :

```bash
# .env
VITE_INTERFACE_BASE_URL=https://admin.mamagoapps.com
```

Chaque pays de la base obtient **automatiquement** son interface — rien n'est
codé en dur. Le SuperAdmin peut créer un pays *et* provisionner son compte
**Admin Pays** dans le même formulaire.

L'interface s'adapte au rôle (menu, boutons), mais **c'est l'API qui fait
foi** : un Admin Pays reçoit un **403** sur tout pays hors de son périmètre,
et un Commercial sur toute écriture.

Le tableau de bord et les stats utilisent une **fenêtre glissante de 30 jours**
par défaut (évite le biais d'un mois calendaire en cours partiel).

## Structure

```
src/
├── main.jsx              # providers (thème, auth, toast) + router
├── App.jsx              # routes + garde d'authentification
├── theme.css            # variables CSS (thème), base, animations, responsive
├── lib/
│   ├── api.js           # client fetch + jeton Bearer
│   ├── ui.js            # icônes, formatage, couleurs, styles réutilisables
│   └── useFetch.js      # hook de chargement + libellés de mois
├── context/            # ThemeContext, AuthContext, ToastContext
├── components/         # Layout, Charts (SVG), Modal, common
└── pages/              # Login, Dashboard, Pays, StatPays, Utilisateurs, Parametres
```

## Déploiement statique (optionnel)

`npm run build` génère `dist/`. La cible visée est `npm run dev`. Si vous servez
`dist/` derrière Apache, les liens profonds (`/stats/1`) renverront un 404 au
rafraîchissement sans **fallback SPA** : ajoutez une règle de réécriture Apache
vers `index.html`, ou passez `BrowserRouter` en `HashRouter`.
