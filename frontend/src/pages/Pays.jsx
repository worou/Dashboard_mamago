import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { money, moneyDev, ICONS, tintFor, codeFor, paysSlug, deltaPill, S, styleObj, html, icHtml } from '../lib/ui';
import { Sparkline } from '../components/Charts';
import { Loader, ErrorBox, Empty } from '../components/common';
import CreatePaysModal from '../components/CreatePaysModal';
import { useAuth } from '../context/AuthContext';

export default function Pays() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [sortCA, setSortCA] = useState(false);
  const [modal, setModal] = useState(false);



  const isSuperAdmin = user?.role === 'SuperAdmin';

  const { loading, error, data, reload } = useFetch(
    () => Promise.all([api.dashboard(), api.evolution({ months: 12 })]).then(([d, e]) => ({ d, e })),
    []
  );

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { d, e } = data;
  let list = d.pays.filter((p) => p.nom_pays.toLowerCase().includes(q.toLowerCase()));
  if (sortCA) list = [...list].sort((a, b) => b.ca - a.ca);

  // La creation d'un pays (+ provisionnement de son admin) est mutualisee
  // avec l'ecran « Interface pays » : voir components/CreatePaysModal.

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', flex: 1, minWidth: 220 }}>
          <span dangerouslySetInnerHTML={html(icHtml(ICONS.search, 16))} style={{ color: 'var(--muted)', display: 'inline-flex' }} />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Rechercher un pays…" style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 13, padding: '10px 0', width: '100%' }} />
        </div>
        <button onClick={() => setSortCA((s) => !s)} style={styleObj('font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;border:1px solid ' + (sortCA ? 'var(--green)' : 'var(--border)') + ';background:' + (sortCA ? 'var(--green-dim)' : 'var(--surface)') + ';color:' + (sortCA ? 'var(--green-hi)' : 'var(--text2)') + ';')}>
          {sortCA ? 'Trié par CA ✓' : 'Trier par CA'}
        </button>
        {isSuperAdmin && (
          <button onClick={() => setModal(true)} style={styleObj(S.btnGreen)}>+ Ajouter un pays</button>
        )}
      </div>

      {list.length === 0 ? (
        <Empty>Aucun pays ne correspond à « {q} ».</Empty>
      ) : (
        <div className="mg-cards3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {list.map((p) => {
            const tn = tintFor(codeFor(p));
            const dp = deltaPill(p.evolution_pct);
            const spark = (e.par_pays[String(p.id)] || []).slice(-12);
            return (
              <div key={p.id} style={styleObj(S.cardPad('18px'))}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 15 }}>{codeFor(p)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15.5 }}>{p.nom_pays}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.nb_villes} villes actives</div>
                  </div>
                  <span style={styleObj(dp.style)}>{dp.txt}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '15px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {[['CA', moneyDev(p.ca, p.devise)], ['Clients', money(p.nb_clients)], ['Livreurs', money(p.nb_livreurs)]].map(([lab, val], i) => (
                    <div key={i} style={{ textAlign: i ? 'right' : 'left' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{lab}</div>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 17, marginTop: 3 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}><Sparkline data={spark.length ? spark : [0, 0]} up={(p.evolution_pct ?? 0) >= 0} w={260} /></div>

                {/* Chaque pays dispose automatiquement de son espace d'administration */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => nav('/interface/' + paysSlug(p))} style={{ ...styleObj(S.btnGreen), flex: 1 }}>Gérer l'espace</button>
                  <button onClick={() => nav('/stats/' + p.id)} style={{ ...styleObj(S.btnGhost), flex: 1 }}>Statistiques</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <CreatePaysModal
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); reload(); }}
        />
      )}
    </div>
  );
}
