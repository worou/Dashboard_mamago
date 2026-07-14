import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch, monthLabel } from '../lib/useFetch';
import { money, moneyDev, ICONS, CHART_COLORS, tintFor, codeFor, deltaPill, deltaText, lastNDays, S, styleObj, html, icHtml } from '../lib/ui';
import { Donut, GroupedBars, BarRow } from '../components/Charts';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
import { useToast } from '../context/ToastContext';

const PAY_META = {
  mobile_money: { label: 'Mobile Money', color: 'var(--green)', icon: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>' },
  especes: { label: 'Espèces', color: '#4AA6E8', icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>' },
  carte: { label: 'Carte bancaire', color: '#E8C24A', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>' },
  autre: { label: 'Autre', color: '#B87AE8', icon: '<path d="M3 7h18v12H3z"/><path d="M16 12h3"/><path d="M3 7l4-4h10l4 4"/>' },
};

const pct = (cur, prev) => {
  if (prev === 0 || prev == null) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
};

// Periodes disponibles pour les statistiques du pays
const PERIODS = [
  { label: '7 jours', days: 7 },
  { label: '1 mois', days: 30 },
  { label: '2 mois', days: 60 },
];

export default function StatPays() {
  const { paysId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [days, setDays] = useState(30);

  const { loading, error, data, reload } = useFetch(async () => {
    const list = await api.pays();
    const id = Number(paysId) || (list[0] && list[0].id);
    if (!id) return { list: [], stats: null };
    const [stats, evo] = await Promise.all([
      api.paysStats(id, { ...lastNDays(days), months: 6 }),
      api.evolution({ months: 12 }),
    ]);
    return { list, id, stats, evo };
  }, [paysId, days]);

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data.stats) return <Empty>Aucun pays disponible. Ajoutez un pays d'abord.</Empty>;

  const { list, id, stats, evo } = data;
  const pays = stats.pays;
  const devise = pays.devise || '';
  const tn = tintFor(codeFor(pays));
  const evClients = stats.evolution_clients;
  const last = evClients[evClients.length - 1] || {};
  const prev = evClients[evClients.length - 2] || {};

  // Delta CA depuis la serie mensuelle par pays
  const caSeries = evo.par_pays[String(id)] || [];
  const caDelta = pct(caSeries[caSeries.length - 1] || 0, caSeries[caSeries.length - 2] || 0);

  const kpis = [
    { label: 'CA (période)', value: moneyDev(stats.ca_total, devise), delta: caDelta },
    { label: 'Nouveaux clients', value: money(last.nouveaux_clients || 0), delta: pct(last.nouveaux_clients || 0, prev.nouveaux_clients || 0) },
    { label: 'Clients actifs', value: money(last.clients_actifs || 0), delta: pct(last.clients_actifs || 0, prev.clients_actifs || 0) },
    { label: 'Durée moy.', value: (last.duree_moyenne_minutes || 0) + ' min', delta: pct(last.duree_moyenne_minutes || 0, prev.duree_moyenne_minutes || 0) },
  ];

  const maxVille = Math.max(1, ...stats.ca_par_ville.map((v) => v.ca));
  const totalService = stats.ca_par_service.reduce((s, x) => s + x.ca, 0) || 1;
  const serviceSegs = stats.ca_par_service.map((s, i) => ({ v: s.ca, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const period = stats.periode;
  const periodLabel = 'Derniers ' + (PERIODS.find((p) => p.days === days)?.label || days + ' jours');

  // Telechargement authentifie : l'export exige le jeton (une navigation
  // window.open n'enverrait pas l'entete Authorization).
  const exportFile = async (type) => {
    try {
      await api.exportRapport({ pays_id: id, type, from: period.from.slice(0, 10), to: period.to.slice(0, 10) });
      toast('Export ' + type.toUpperCase() + ' — ' + pays.nom_pays);
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      {/* En-tete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 17 }}>{codeFor(pays)}</span>
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 20 }}>{pays.nom_pays}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {periodLabel} · {stats.ca_par_ville.length} villes · {stats.livreurs.length} livreurs
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Selecteur de periode */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
            {PERIODS.map((p) => {
              const on = days === p.days;
              return (
                <button key={p.days} onClick={() => setDays(p.days)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', background: on ? 'var(--green)' : 'transparent', color: on ? '#04140C' : 'var(--text2)' }}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <select value={id} onChange={(ev) => nav('/stats/' + ev.target.value)} style={styleObj('background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;')}>
            {list.map((c) => <option key={c.id} value={c.id}>{c.nom_pays}</option>)}
          </select>
          <button onClick={() => exportFile('csv')} style={styleObj(S.btnGhost)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><IconSpan path={ICONS.download} size={15} />CSV</span>
          </button>
          <button onClick={() => exportFile('pdf')} style={styleObj(S.btnGreen)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><IconSpan path={ICONS.download} size={15} />Rapport PDF</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mg-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map((k, i) => {
          const dt = deltaText(k.delta);
          return (
            <div key={i} style={styleObj(S.cardPad('16px'))}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 23, marginTop: 8 }}>{k.value}</div>
              <div style={styleObj(dt.style)}>{dt.txt}</div>
            </div>
          );
        })}
      </div>

      {/* CA ville + service */}
      <div className="mg-2col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={styleObj(S.card)}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>CA par ville</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 16 }}>Chiffre d'affaires sur la période</div>
          {stats.ca_par_ville.length === 0 ? <Empty>Aucune donnée.</Empty> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stats.ca_par_ville.map((c) => (
                <BarRow key={c.ville_id} label={c.nom_ville} value={moneyDev(c.ca, devise)} width={(c.ca / maxVille) * 100 + '%'} />
              ))}
            </div>
          )}
        </div>
        <div style={styleObj(S.card)}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>CA par service</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Répartition</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <Donut segs={serviceSegs} size={96} centerBottom="services" centerTop={String(stats.ca_par_service.length)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {stats.ca_par_service.map((s, i) => (
              <div key={s.service_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text2)' }}>{s.nom_service}</span>
                <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk' }}>{Math.round((s.ca / totalService) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evolution clients + paiements */}
      <div className="mg-2col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={styleObj(S.card)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Évolution des clients</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Nouveaux vs actifs · par mois</div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)' }} />Nouveaux</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--amber)' }} />Actifs</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <GroupedBars
              a={evClients.map((x) => x.nouveaux_clients)}
              b={evClients.map((x) => x.clients_actifs)}
              labels={evClients.map((x) => monthLabel(x.mois))}
            />
          </div>
        </div>
        <div style={styleObj(S.card)}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Types de paiement</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 16 }}>Transactions de la période</div>
          {stats.type_paiement.length === 0 ? <Empty>Aucun paiement.</Empty> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {stats.type_paiement.map((p) => {
                const meta = PAY_META[p.type] || { label: p.type, color: 'var(--muted)', icon: ICONS.money };
                return (
                  <div key={p.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-hi)', flexShrink: 0 }} dangerouslySetInnerHTML={html(icHtml(meta.icon, 18))} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{meta.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk' }}>{p.pct}%</span>
                      </div>
                      <div style={{ height: 7, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: p.pct + '%', background: meta.color, borderRadius: 5, transformOrigin: 'left', animation: 'growW .7s ease both' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Livreurs */}
      <div style={{ ...styleObj(S.card), marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Livreurs</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Courses, notes et évolution</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr style={{ textAlign: 'left' }}>{['Livreur', 'Courses', 'Note', 'Évolution', 'Statut'].map((h) => <th key={h} style={styleObj(S.th)}>{h}</th>)}</tr></thead>
            <tbody>
              {stats.livreurs.map((l) => {
                const dp = deltaPill(l.evolution_pct);
                const act = l.statut === 'actif';
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--text2)' }}>{(l.prenom[0] || '') + (l.nom[0] || '')}</span>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{l.prenom} {l.nom}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13.5 }}>{money(l.nb_courses)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--amber)"><path d="m12 2 3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 18l-6.4 3.7 1.8-7.3L1.7 9.5l7.5-.6L12 2Z" /></svg>
                        {Number(l.note_moyenne).toFixed(1)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}><span style={styleObj(dp.style)}>{dp.txt}</span></td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={styleObj('font-size:12px;font-weight:700;padding:3px 9px;border-radius:20px;background:' + (act ? 'var(--green-dim)' : 'rgba(232,178,74,.16)') + ';color:' + (act ? 'var(--green-hi)' : 'var(--amber)') + ';')}>{l.statut}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
