import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ICONS, html, icHtml, initials } from '../lib/ui';
import { IconSpan } from './common';

// adminOnly : reserve au SuperAdmin et a l'Admin Pays (un Commercial aurait un 403).
const NAV = [
  { id: 'home', path: '/', label: 'Dashboard', short: 'Home', icon: ICONS.home },
  { id: 'pays', path: '/pays', label: 'Pays', short: 'Pays', icon: ICONS.pays },
  { id: 'interface', path: '/interface', label: 'Interface pays', short: 'Interface', icon: ICONS.layout },
  { id: 'stat', path: '/stats', label: 'Stat par pays', short: 'Stats', icon: ICONS.stat },
  { id: 'users', path: '/utilisateurs', label: 'Utilisateurs', short: 'Users', icon: ICONS.users, adminOnly: true },
  { id: 'settings', path: '/parametres', label: 'Paramètres', short: 'Réglages', icon: ICONS.settings },
];

const TITLES = {
  '/': ['Tableau de bord', "Vue d'ensemble des performances"],
  '/pays': ['Pays', 'Pays actifs sur la plateforme MamaGo'],
  '/interface': ['Interface pays', "Générer l'interface d'administration d'un pays"],
  '/stats': ['Statistiques par pays', 'Analyse détaillée des indicateurs'],
  '/admin': ['Espace pays', 'Administration des données du pays'],
  '/utilisateurs': ['Utilisateurs', "Gestion des comptes, rôles et droits d'accès"],
  '/parametres': ['Paramètres', 'Thème, activités et configuration'],
};

const NOTIFS = [
  { title: 'Pic de CA détecté', time: 'Il y a 5 min', icon: ICONS.trend },
  { title: 'Nouveaux livreurs à valider', time: 'Il y a 40 min', icon: ICONS.users },
  { title: 'Rapport mensuel prêt', time: 'Il y a 2 h', icon: ICONS.edit },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isAdmin = isSuperAdmin || user?.role === 'Admin Pays';
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);

  const activeId = (() => {
    if (loc.pathname === '/') return 'home';
    if (loc.pathname.startsWith('/interface')) return 'interface';
    if (loc.pathname.startsWith('/pays') || loc.pathname.startsWith('/admin')) return 'pays';
    if (loc.pathname.startsWith('/stats')) return 'stat';
    if (loc.pathname.startsWith('/utilisateurs')) return 'users';
    if (loc.pathname.startsWith('/parametres')) return 'settings';
    return 'home';
  })();

  const titleKey = activeId === 'home' ? '/' : '/' + (loc.pathname.split('/')[1] || '');
  const [title, sub] = TITLES[titleKey] || TITLES['/'];

  const userName = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Utilisateur';

  const themeIcon = theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', transition: 'background .25s,color .25s' }}>
      {/* SIDEBAR */}
      <aside className="mg-sidebar" style={{ width: 250, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '22px 22px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,var(--green),var(--green-hi))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px var(--green-dim)' }}
            dangerouslySetInnerHTML={html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="#04140C" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 2v20M3 7l9 5 9-5" stroke="#04140C" stroke-width="1.8" stroke-linejoin="round"/></svg>')} />
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 18, letterSpacing: '-.5px', lineHeight: 1 }}>MamaGo</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginTop: 3 }}>Manager par pays</div>
          </div>
        </div>

        <div style={{ padding: '4px 14px 8px', fontSize: 10.5, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Principal</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px' }}>
          {navItems.map((item) => {
            const active = item.id === activeId;
            return (
              <button key={item.id} onClick={() => nav(item.path)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 700 : 600, width: '100%', background: active ? 'var(--green-dim)' : 'transparent', color: active ? 'var(--green-hi)' : 'var(--text2)' }}>
                <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={html(icHtml(item.icon))} />
                <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px 16px 20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#3B4A44,#20302B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 14, color: 'var(--green-hi)', flexShrink: 0 }}>{initials(userName)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.role || '—'}</div>
            </div>
            <button onClick={logout} title="Déconnexion" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSpan path={ICONS.logout} size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 21, letterSpacing: '-.4px', lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{ flex: 1 }} />

          <button onClick={toggle} title="Changer de thème" style={{ width: 40, height: 40, flexShrink: 0, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={html(themeIcon)} />

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setNotifOpen((o) => !o)} style={{ width: 40, height: 40, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, color: 'var(--text2)', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSpan path={ICONS.bell} size={18} />
              <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, background: 'var(--green-hi)', borderRadius: '50%', border: '2px solid var(--surface)' }} />
            </button>
            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div style={{ position: 'absolute', top: 48, right: 0, width: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow)', zIndex: 60, overflow: 'hidden', animation: 'popIn .18s ease both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 14 }}>Notifications</span>
                  </div>
                  {NOTIFS.map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--green-dim)', color: 'var(--green-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconSpan path={n.icon} size={16} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mg-main" style={{ flex: 1, padding: 24, maxWidth: 1500, width: '100%' }}>
          <Outlet />
          <div className="mg-spacer" style={{ height: 64 }} />
        </main>
      </div>

      {/* BOTTOM NAV (mobile) */}
      <nav className="mg-bottomnav" style={{ display: 'none' }}>
        {navItems.map((item) => {
          const active = item.id === activeId;
          return (
            <button key={item.id} onClick={() => nav(item.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: active ? 'var(--green-hi)' : 'var(--muted)' }}>
              <IconSpan path={item.icon} size={18} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{item.short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
