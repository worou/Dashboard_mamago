// Client API MamaGo — enveloppe fetch avec jeton Bearer.

const BASE = import.meta.env.VITE_API_URL || 'http://localhost/mamago/api';

const TOKEN_KEY = 'mamago_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (res.status === 204) return null;

  let json = null;
  try { json = await res.json(); } catch { /* reponse non-JSON */ }

  if (!res.ok) {
    const msg = (json && json.error) || 'Erreur ' + res.status;
    throw new Error(msg);
  }
  return json ? json.data : null;
}

// Renvoie l'objet complet (data + meta) — utile pour la pagination.
async function requestFull(path) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  const json = await res.json();
  if (!res.ok) throw new Error((json && json.error) || 'Erreur ' + res.status);
  return json;
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? '?' + s : '';
};

export const api = {
  base: BASE,
  qs,
  // Auth
  login: (email, mot_de_passe) => request('/auth/login', { method: 'POST', body: { email, mot_de_passe }, auth: false }),
  me: () => request('/auth/me'),

  // Dashboard & stats
  dashboard: (params) => request('/dashboard' + qs(params)),
  evolution: (params) => request('/stats/evolution' + qs(params)),
  paysStats: (id, params) => request('/pays/' + id + '/stats' + qs(params)),
  paiementStats: (params) => request('/stats/paiements' + qs(params)),

  // Referentiel / entites
  pays: (params) => request('/pays' + qs(params)),
  createPays: (body) => request('/pays', { method: 'POST', body }),
  villes: (params) => request('/villes' + qs(params)),
  livreurs: (params) => request('/livreurs' + qs(params)),
  courses: (params) => requestFull('/courses' + qs(params)),
  clients: (params) => requestFull('/clients' + qs(params)),

  // Administration
  utilisateurs: (params) => request('/utilisateurs' + qs(params)),
  createUtilisateur: (body) => request('/utilisateurs', { method: 'POST', body }),
  updateUtilisateur: (id, body) => request('/utilisateurs/' + id, { method: 'PUT', body }),
  deleteUtilisateur: (id) => request('/utilisateurs/' + id, { method: 'DELETE' }),
  roles: () => request('/roles'),

  // Tracabilite
  connexions: (params) => requestFull('/connexions' + qs(params)),

  // URL d'export (telechargement direct dans le navigateur)
  exportUrl: (params) => BASE + '/rapports/export' + qs(params),
};
