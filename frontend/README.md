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
| `/pays` | Pays | cartes par pays, recherche, tri, ajout (`POST /pays`) |
| `/stats/:id` | Stat par pays | `GET /pays/{id}/stats` : CA ville/service, évolution clients, paiements, livreurs + export CSV/PDF |
| `/utilisateurs` | Utilisateurs | `GET/POST/PUT/DELETE /utilisateurs`, cartes de rôles, filtres |
| `/parametres` | Paramètres | thème/accent + activités (`GET /connexions`) |

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
