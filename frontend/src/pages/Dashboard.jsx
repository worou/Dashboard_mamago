import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch, monthLabel } from '../lib/useFetch';
import { money, moneyDev, ICONS, CHART_COLORS, tintFor, codeFor, deltaPill, deltaText, lastNDays, S, styleObj, html, icHtml } from '../lib/ui';
import { AreaChart, Donut, Sparkline } from '../components/Charts';
import { IconSpan, Loader, ErrorBox } from '../components/common';

const RANGES = [{ label: '6 mois', m: 6 }, { label: '12 mois', m: 12 }, { label: '24 mois', m: 24 }];

export default function Dashboard() {
  const nav = useNavigate();
  const [range, setRange] = useState(12);

  // Fenetre glissante de 30 jours (evite le biais du mois en cours partiel)
  const { loading, error, data, reload } = useFetch(
    () => Promise.all([api.dashboard(lastNDays(30)), api.evolution({ months: 24 })]).then(([d, e]) => ({ d, e })),
    []
  );

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { d, e } = data;
  const t = d.totaux;
  const pays = d.pays;

  const kpis = [
    { label: 'CA global', value: money(Math.round(t.ca_global)) + ' F', icon: ICONS.money, delta: t.evolution_pct },
    { label: 'Clients', value: money(t.nb_clients), icon: ICONS.users, delta: null },
    { label: 'Livreurs', value: money(t.nb_livreurs), icon: ICONS.moto, delta: null },
    { label: 'Courses (période)', value: money(t.nb_courses), icon: ICONS.box, delta: null },
  ];

  // Serie du CA global, tranchee selon le range choisi
  const gAll = e.global;
  const g = gAll.slice(-range);
  const chartData = g.map((x) => x.ca);
  const chartLabels = g.map((x) => monthLabel(x.mois));

  // Repartition du CA par pays
  const totalCA = pays.reduce((s, p) => s + p.ca, 0) || 1;
  const donutSegs = pays.map((p, i) => ({ v: p.ca, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const shareRows = pays.slice(0, 6).map((p, i) => ({ name: p.nom_pays, color: CHART_COLORS[i % CHART_COLORS.length], pct: Math.round((p.ca / totalCA) * 100) + '%' }));

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      {/* KPIs */}
      <div className="mg-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map((k, i) => {
          const dp = deltaPill(k.delta);
          return (
            <div key={i} style={styleObj(S.cardPad('18px'))}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>{k.label}</div>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-hi)' }}>
                  <IconSpan path={k.icon} size={18} />
                </span>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 27, letterSpacing: '-.5px', marginTop: 12 }}>{k.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={styleObj(dp.style)}>{dp.txt}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>vs 30 j préc.</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Donut + courbe */}
      <div className="mg-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginTop: 16 }}>
        <div style={styleObj(S.card)}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Répartition du CA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Part de chaque pays</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <Donut segs={donutSegs} size={120} centerTop={String(pays.length)} centerBottom="pays" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shareRows.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text2)' }}>{s.name}</span>
                <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk' }}>{s.pct}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styleObj(S.card)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Évolution du CA global</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{range} derniers mois · courses terminées</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 9, padding: 3 }}>
              {RANGES.map((r) => {
                const on = range === r.m;
                return (
                  <button key={r.m} onClick={() => setRange(r.m)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: on ? 'var(--green)' : 'transparent', color: on ? '#04140C' : 'var(--text2)' }}>{r.label}</button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 16 }}><AreaChart data={chartData} labels={chartLabels} /></div>
        </div>
      </div>

      {/* Table performance par pays */}
      <div style={{ ...styleObj(S.card), marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Performance par pays</div>
          <button onClick={() => nav('/pays')} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--green-hi)', background: 'none', border: 'none', cursor: 'pointer' }}>Voir tout →</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {['Pays', 'CA', 'Clients', 'Livreurs', 'Évolution', 'Tendance'].map((h) => <th key={h} style={styleObj(S.th)}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pays.map((p) => {
                const tn = tintFor(codeFor(p));
                const dp = deltaPill(p.evolution_pct);
                const spark = (e.par_pays[String(p.id)] || []).slice(-12);
                return (
                  <tr key={p.id} onClick={() => nav('/stats/' + p.id)} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 9, background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{codeFor(p)}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.nom_pays}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.nb_villes} villes</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 14px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14 }}>{moneyDev(p.ca, p.devise)}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13.5, color: 'var(--text2)' }}>{money(p.nb_clients)}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13.5, color: 'var(--text2)' }}>{money(p.nb_livreurs)}</td>
                    <td style={{ padding: '13px 14px' }}><span style={styleObj(dp.style)}>{dp.txt}</span></td>
                    <td style={{ padding: '13px 14px', width: 130 }}><Sparkline data={spark.length ? spark : [0, 0]} up={(p.evolution_pct ?? 0) >= 0} /></td>
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
