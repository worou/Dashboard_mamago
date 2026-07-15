// Client API MamaGo — enveloppe fetch avec jeton Bearer.
// Toutes les routes (hors /health et /auth/login) exigent le jeton :
// le perimetre pays de l'utilisateur en est deduit cote serveur.

const BASE = import.meta.env.VITE_API_URL || 'http://localhost/mamago/api';

const TOKEN_KEY = 'mamago_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

function authHeaders(extra = {}) {
  const h = { ...extra };
  const token = getToken();
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function request(path, { method = 'GET', body, auth = true, full = false } = {}) {
  const headers = authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : {});
  if (!auth) delete headers['Authorization'];

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 = jeton absent/expire -> deconnexion. 403 = hors perimetre -> on laisse remonter.
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (res.status === 204) return null;

  let json = null;
  try { json = await res.json(); } catch { /* reponse non-JSON */ }

  if (!res.ok) {
    throw new Error((json && json.error) || 'Erreur ' + res.status);
  }
  return full ? json : (json ? json.data : null);
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? '?' + s : '';
};

// Telechargement authentifie (l'export exige le jeton : une simple
// navigation window.open n'enverrait pas l'entete Authorization).
async function download(path, fallbackName) {
  const res = await fetch(BASE + path, { headers: authHeaders() });
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    let msg = 'Export impossible';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  // Nom de fichier propose par le serveur (Content-Disposition)
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  const name = m ? m[1] : fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const crud = (resource) => ({
  list: (params) => request('/' + resource + qs(params)),
  create: (body) => request('/' + resource, { method: 'POST', body }),
  update: (id, body) => request('/' + resource + '/' + id, { method: 'PUT', body }),
  remove: (id) => request('/' + resource + '/' + id, { method: 'DELETE' }),
});

export const api = {
  base: BASE,
  qs,

  // Auth
  login: (email, mot_de_passe) => request('/auth/login', { method: 'POST', body: { email, mot_de_passe }, auth: false }),
  me: () => request('/auth/me'),

  // Dashboard & stats (cloisonnes par le jeton)
  dashboard: (params) => request('/dashboard' + qs(params)),
  evolution: (params) => request('/stats/evolution' + qs(params)),
  paysStats: (id, params) => request('/pays/' + id + '/stats' + qs(params)),
  paiementStats: (params) => request('/stats/paiements' + qs(params)),

  // Pays — createPays cree aussi le compte "Admin Pays" si creer_admin=true
  pays: (params) => request('/pays' + qs(params)),
  paysOne: (id) => request('/pays/' + id),
  // Coordonnees du responsable d'administration du pays + autres acces
  paysAdmins: (id) => request('/pays/' + id + '/admins'),
  createPays: (body) => request('/pays', { method: 'POST', body }),
  updatePays: (id, body) => request('/pays/' + id, { method: 'PUT', body }),
  deletePays: (id) => request('/pays/' + id, { method: 'DELETE' }),

  // Ressources de l'espace pays
  villes: crud('villes'),
  livreurs: crud('livreurs'),
  clients: {
    ...crud('clients'),
    list: (params) => request('/clients' + qs(params), { full: true }), // pagine
  },
  courses: {
    ...crud('courses'),
    list: (params) => request('/courses' + qs(params), { full: true }), // pagine
  },
  services: () => request('/services'),

  // Demandes de compte commercial (Admin Pays -> validation SuperAdmin)
  demandes: {
    list: (params) => request('/demandes' + qs(params)),
    create: (body) => request('/demandes', { method: 'POST', body }),
    valider: (id) => request('/demandes/' + id + '/valider', { method: 'PUT', body: {} }),
    refuser: (id, motif) => request('/demandes/' + id + '/refuser', { method: 'PUT', body: { motif } }),
    remove: (id) => request('/demandes/' + id, { method: 'DELETE' }),
  },

  // Administration
  utilisateurs: (params) => request('/utilisateurs' + qs(params)),
  utilisateurOne: (id) => request('/utilisateurs/' + id),   // inclut pays_ids / ville_ids
  createUtilisateur: (body) => request('/utilisateurs', { method: 'POST', body }),
  updateUtilisateur: (id, body) => request('/utilisateurs/' + id, { method: 'PUT', body }),
  deleteUtilisateur: (id) => request('/utilisateurs/' + id, { method: 'DELETE' }),
  roles: () => request('/roles'),

  // Tracabilite
  connexions: (params) => request('/connexions' + qs(params), { full: true }),

  // Export authentifie (CSV / PDF)
  exportRapport: (params) => download('/rapports/export' + qs(params), 'rapport.' + (params.type || 'csv')),
};
