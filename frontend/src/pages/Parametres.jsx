import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useTheme } from '../context/ThemeContext';
import { ICONS, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';

const ACT_META = {
  connexion: { tint: ['var(--green-dim)', 'var(--green-hi)'], icon: ICONS.login, verb: "s'est connecté" },
  export_rapport: { tint: ['rgba(184,122,232,.16)', '#B87AE8'], icon: ICONS.download, verb: 'a exporté un rapport' },
  modif_profil: { tint: ['rgba(74,166,232,.16)', '#4AA6E8'], icon: ICONS.edit, verb: 'a modifié un profil' },
  consultation_stats: { tint: ['rgba(232,178,74,.16)', 'var(--amber)'], icon: ICONS.stat, verb: 'a consulté les stats' },
};
const metaFor = (a) => ACT_META[a] || { tint: ['var(--surface2)', 'var(--text2)'], icon: ICONS.settings, verb: a || 'action' };

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const check = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="var(--green)"/><path d="m8 12 3 3 5-6" stroke="#04140C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const dot = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--border-hi)" stroke-width="2"/></svg>';

export default function Parametres() {
  const { theme, setTheme, accent, setAccent, accents, rgba } = useTheme();

  const { loading, error, data, reload } = useFetch(
    () => Promise.all([api.connexions({ per_page: 20 }), api.utilisateurs()]).then(([c, users]) => {
      const byId = {};
      users.forEach((u) => { byId[u.id] = `${u.prenom} ${u.nom}`; });
      return { activities: c.data || [], names: byId };
    }),
    []
  );

  const isDark = theme === 'dark';
  const cardBase = 'text-align:left;cursor:pointer;padding:12px;border-radius:14px;background:var(--surface2);';
  const curAccent = accent ? accent.c : '#16B364';

  return (
    <div className="mg-2col" style={{ animation: 'floatIn .35s ease both', display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16 }}>
      {/* Colonne gauche : theme */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={styleObj(S.card)}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Thème</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, marginBottom: 16 }}>Couleurs noir &amp; vert · mode sombre/clair</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => setTheme('dark')} style={styleObj(cardBase + 'border:2px solid ' + (isDark ? 'var(--green)' : 'var(--border)') + ';')}>
              <div style={{ height: 56, borderRadius: 9, background: '#0A0E0D', border: '1px solid #1F2C28', display: 'flex', alignItems: 'center', gap: 6, padding: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, background: '#16B364' }} />
                <div style={{ flex: 1 }}><div style={{ height: 5, background: '#1F2C28', borderRadius: 3 }} /><div style={{ height: 5, background: '#1F2C28', borderRadius: 3, width: '60%', marginTop: 4 }} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Sombre</span>
                <span dangerouslySetInnerHTML={html(isDark ? check : dot)} />
              </div>
            </button>

            <button onClick={() => setTheme('light')} style={styleObj(cardBase + 'border:2px solid ' + (!isDark ? 'var(--green)' : 'var(--border)') + ';')}>
              <div style={{ height: 56, borderRadius: 9, background: '#F3F6F4', border: '1px solid #E2EAE6', display: 'flex', alignItems: 'center', gap: 6, padding: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, background: '#12A150' }} />
                <div style={{ flex: 1 }}><div style={{ height: 5, background: '#D2DDD8', borderRadius: 3 }} /><div style={{ height: 5, background: '#D2DDD8', borderRadius: 3, width: '60%', marginTop: 4 }} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Clair</span>
                <span dangerouslySetInnerHTML={html(!isDark ? check : dot)} />
              </div>
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Couleur d'accent</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {accents.map((a) => {
              const on = curAccent === a.c;
              return (
                <button key={a.c} onClick={() => setAccent(a)} title="Accent" style={{ width: 32, height: 32, borderRadius: '50%', background: a.c, cursor: 'pointer', border: '2px solid ' + (on ? '#fff' : 'transparent'), boxShadow: '0 0 0 3px ' + (on ? rgba(a.c, 0.3) : 'transparent'), padding: 0 }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Colonne droite : activites */}
      <div style={styleObj(S.card)}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Activités récentes</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Historique des connexions, actions et IP</div>
        </div>

        {loading ? <Loader label="Chargement de l'historique…" />
          : error ? <ErrorBox message={error} onRetry={reload} />
          : data.activities.length === 0 ? <Empty>Aucune activité enregistrée.</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.activities.map((a) => {
                const m = metaFor(a.action);
                const name = data.names[a.utilisateur_id] || 'Utilisateur #' + a.utilisateur_id;
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 13, padding: '13px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: m.tint[0], color: m.tint[1], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} dangerouslySetInnerHTML={html(icHtml(m.icon, 17))} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}><span style={{ fontWeight: 700 }}>{name}</span> <span style={{ color: 'var(--text2)' }}>{m.verb}</span></div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>IP {a.adresse_ip}{a.duree_secondes ? ' · ' + Math.round(a.duree_secondes / 60) + ' min' : ''}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(a.date_connexion)}</div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
