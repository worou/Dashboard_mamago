// Helpers de style et de formatage, repris de la maquette MamaGo.

// Formatage monetaire fr-FR
export const money = (n) => Number(n || 0).toLocaleString('fr-FR');
export const moneyDev = (n, devise = '') =>
  money(Math.round(Number(n || 0))) + (devise ? ' ' + devise : '');

// Fabrique d'icone SVG (trait) -> innerHTML pour dangerouslySetInnerHTML
export const icHtml = (p, size = 18) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

export const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  pays: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>',
  stat: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 20a5.4 5.4 0 0 0-3-4.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 8 1.1V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.4 1z"/>',
  money: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  moto: '<path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/><path d="M9 17h6M4 5h9l1 6h5"/>',
  box: '<path d="M4 4h16v12H4z"/><path d="M4 20h16"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  shield: '<path d="M12 2 4 6v6c0 5 8 8 8 8s8-3 8-8V6l-8-4Z"/><path d="m9 12 2 2 4-4"/>',
  globe2: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/>',
  trend: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 4-5"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
};

// Palette de couleurs categorielle (donuts, services, parts)
export const CHART_COLORS = ['#16B364', '#4AA6E8', '#D66A94', '#E8C24A', '#8A8AE8', '#B87AE8', '#4AD69A', '#6FBFA0'];

// Teinte deterministe pour un badge pays a partir de son code ISO
const TINTS = [
  ['rgba(232,138,42,.16)', '#E8A24A'], ['rgba(42,140,232,.16)', '#4AA6E8'],
  ['rgba(200,80,120,.16)', '#D66A94'], ['rgba(120,120,232,.16)', '#8A8AE8'],
  ['rgba(80,190,140,.16)', '#4AD69A'], ['rgba(190,120,232,.16)', '#B87AE8'],
  ['rgba(232,190,42,.16)', '#E8C24A'], ['rgba(120,180,160,.16)', '#6FBFA0'],
];
export function tintFor(key = '') {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).map((x) => x[0] || '').join('').slice(0, 2).toUpperCase();

export const codeFor = (p) => (p.code_iso || (p.nom_pays || '??').slice(0, 2)).toUpperCase();

// Pastille de variation (delta)
export function deltaPill(v) {
  if (v === null || v === undefined) return { txt: '—', style: 'font-size:12px;color:var(--muted);font-weight:600;' };
  const up = v >= 0;
  return {
    txt: (up ? '+' : '') + v + '%',
    style: 'display:inline-flex;align-items:center;gap:3px;font-weight:700;font-size:12px;padding:2px 7px;border-radius:6px;background:' + (up ? 'var(--green-dim)' : 'var(--red-dim)') + ';color:' + (up ? 'var(--green-hi)' : 'var(--red)') + ';',
  };
}
export function deltaText(v) {
  if (v === null || v === undefined) return { txt: '—', style: 'font-size:12px;color:var(--muted);font-weight:600;margin-top:6px;' };
  const up = v >= 0;
  return {
    txt: (up ? '▲ +' : '▼ ') + v + '%',
    style: 'font-weight:700;font-size:12px;margin-top:6px;color:' + (up ? 'var(--green-hi)' : 'var(--red)') + ';',
  };
}

// Styles reutilisables (chaines CSS -> converties en objets par styleObj)
export const S = {
  card: 'background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;',
  cardPad: (p) => 'background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:' + p + ';',
  btnGreen: 'font-size:13px;font-weight:700;padding:9px 15px;border-radius:10px;border:none;background:var(--green);color:#04140C;cursor:pointer;',
  btnGhost: 'font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer;',
  th: 'padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);',
  input: 'width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 12px;color:var(--text);font-size:13.5px;outline:none;',
};

// Convertit une chaine "a:b;c:d" en objet de style React
export function styleObj(css) {
  const o = {};
  if (!css) return o;
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = val;
  }
  return o;
}

// Raccourci : element span avec innerHTML d'icone
export const html = (s) => ({ __html: s });

// =====================================================================
// URL de l'interface d'un pays
// Le slug est le code ISO (ex. « ci »), avec repli sur l'id.
// La base est surchargeable : VITE_INTERFACE_BASE_URL=https://admin.mamagoapps.com
// =====================================================================

export const paysSlug = (p) =>
  String(p.code_iso || p.id || '').toLowerCase() || String(p.id);

export function interfaceUrl(p) {
  const base = (import.meta.env.VITE_INTERFACE_BASE_URL || window.location.origin).replace(/\/+$/, '');
  return `${base}/interface/${paysSlug(p)}`;
}

// Fenetre glissante des N derniers jours -> { from, to } au format YYYY-MM-DD.
// Evite l'effet "mois en cours partiel" qui fausse l'evolution.
export function lastNDays(n = 30) {
  const fmt = (d) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: fmt(from), to: fmt(to) };
}
