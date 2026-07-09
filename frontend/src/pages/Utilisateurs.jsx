import { useState } from 'react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { ICONS, initials, deltaPill, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const ROLE_TINT = {
  SuperAdmin: ['rgba(22,179,100,.18)', '#24D97C'],
  'Admin Pays': ['rgba(74,166,232,.18)', '#4AA6E8'],
  Commercial: ['rgba(184,122,232,.18)', '#B87AE8'],
};
const ROLE_ICON = { SuperAdmin: ICONS.shield, 'Admin Pays': ICONS.globe2, Commercial: ICONS.trend };
const ROLE_DESC = {
  SuperAdmin: 'Accès complet à tous les pays et paramètres.',
  'Admin Pays': 'Gestion et supervision de son pays.',
  Commercial: 'Suivi des ventes et performances terrain.',
};
const tint = (r) => ROLE_TINT[r] || ['var(--green-dim)', 'var(--green-hi)'];

function fmtDate(s) {
  if (!s) return 'Jamais';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Utilisateurs() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const { loading, error, data, reload } = useFetch(
    () => Promise.all([api.utilisateurs(), api.roles()]).then(([users, roles]) => ({ users, roles })),
    []
  );

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { users, roles } = data;
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.libelle_role }));

  const counts = { SuperAdmin: 0, 'Admin Pays': 0, Commercial: 0 };
  users.forEach((u) => { if (counts[u.role] !== undefined) counts[u.role]++; });

  let rows = users;
  if (roleFilter !== 'all') rows = rows.filter((u) => u.role === roleFilter);
  rows = rows.filter((u) => (`${u.prenom} ${u.nom} ${u.email}`).toLowerCase().includes(q.toLowerCase()));

  const openAdd = () => { setForm({ role_id: roles[0]?.id }); setModal('add'); };
  const openEdit = (u) => { setMenu(null); setForm({ id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, role_id: u.role_id }); setModal('edit'); };

  const remove = async (u) => {
    setMenu(null);
    if (!window.confirm(`Supprimer ${u.prenom} ${u.nom} ?`)) return;
    try { await api.deleteUtilisateur(u.id); toast(`${u.prenom} ${u.nom} supprimé`); reload(); }
    catch (ex) { toast(ex.message); }
  };

  const submit = async () => {
    if (!form.nom || !form.prenom || !form.email) { toast('Nom, prénom et e-mail requis'); return; }
    if (modal === 'add' && !form.mot_de_passe) { toast('Mot de passe requis'); return; }
    setBusy(true);
    try {
      if (modal === 'add') {
        await api.createUtilisateur({ nom: form.nom, prenom: form.prenom, email: form.email, mot_de_passe: form.mot_de_passe, role_id: Number(form.role_id) });
        toast(`${form.prenom} créé`);
      } else {
        const body = { nom: form.nom, prenom: form.prenom, email: form.email, role_id: Number(form.role_id) };
        if (form.mot_de_passe) body.mot_de_passe = form.mot_de_passe;
        await api.updateUtilisateur(form.id, body);
        toast('Utilisateur modifié');
      }
      setModal(null); setForm({}); reload();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };

  const roleFilterActive = roleFilter !== 'all';

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', flex: 1, minWidth: 220 }}>
          <span dangerouslySetInnerHTML={html(icHtml(ICONS.search, 16))} style={{ color: 'var(--muted)', display: 'inline-flex' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un utilisateur…" style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 13, padding: '10px 0', width: '100%' }} />
        </div>
        <button onClick={() => setRoleFilter('all')} style={styleObj('font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;cursor:pointer;border:1px solid ' + (roleFilterActive ? 'var(--green)' : 'var(--border)') + ';background:' + (roleFilterActive ? 'var(--green-dim)' : 'var(--surface)') + ';color:' + (roleFilterActive ? 'var(--green-hi)' : 'var(--text2)') + ';')}>
          {roleFilterActive ? 'Filtre : ' + roleFilter + ' ✕' : 'Tous les rôles'}
        </button>
        <button onClick={openAdd} style={styleObj(S.btnGreen)}>+ Nouvel utilisateur</button>
      </div>

      {/* Cartes de roles */}
      <div className="mg-cards3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {['SuperAdmin', 'Admin Pays', 'Commercial'].map((r) => {
          const on = roleFilter === r;
          return (
            <div key={r} onClick={() => setRoleFilter((cur) => (cur === r ? 'all' : r))} style={{ ...styleObj(S.cardPad('18px')), cursor: 'pointer', borderColor: on ? 'var(--green)' : 'var(--border)', boxShadow: on ? '0 0 0 2px var(--green-dim)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-dim)', color: 'var(--green-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconSpan path={ROLE_ICON[r]} size={18} />
                </span>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22 }}>{counts[r]}</span>
              </div>
              <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15, marginTop: 12 }}>{r}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{ROLE_DESC[r]}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={styleObj(S.card)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Tous les utilisateurs</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rows.length} affichés</span>
        </div>
        {rows.length === 0 ? <Empty>Aucun utilisateur.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr style={{ textAlign: 'left' }}>{['Utilisateur', 'Rôle', 'Dernière connexion', 'Statut', ''].map((h, i) => <th key={i} style={styleObj(S.th)}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((u) => {
                  const tn = tint(u.role);
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span style={{ width: 36, height: 36, borderRadius: '50%', background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5 }}>{initials(`${u.prenom} ${u.nom}`)}</span>
                          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.prenom} {u.nom}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{u.email}</div></div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 14px' }}><span style={styleObj('font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:' + tn[0] + ';color:' + tn[1] + ';')}>{u.role}</span></td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--text2)' }}>{fmtDate(u.derniere_connexion)}</td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: u.actif ? 'var(--green-hi)' : 'var(--muted)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 6 }} />{u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', position: 'relative' }}>
                        <button onClick={() => setMenu(menu === u.id ? null : u.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>⋯</button>
                        {menu === u.id && (
                          <>
                            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                            <div style={{ position: 'absolute', top: 44, right: 14, width: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 40, overflow: 'hidden', textAlign: 'left', animation: 'popIn .15s ease both' }}>
                              <button onClick={() => openEdit(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Modifier</button>
                              <button onClick={() => remove(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Supprimer</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}
          cta={modal === 'add' ? 'Créer le compte' : 'Enregistrer'}
          busy={busy}
          values={form}
          onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onClose={() => { setModal(null); setForm({}); }}
          onSubmit={submit}
          fields={[
            { key: 'prenom', label: 'Prénom', ph: 'Ex. Aminata' },
            { key: 'nom', label: 'Nom', ph: 'Ex. Sow' },
            { key: 'email', label: 'Adresse e-mail', ph: 'prenom.nom@mamago.com' },
            { key: 'mot_de_passe', label: modal === 'add' ? 'Mot de passe' : 'Nouveau mot de passe (optionnel)', type: 'password', ph: '••••••••' },
            { key: 'role_id', label: 'Rôle', type: 'select', options: roleOptions },
          ]}
        />
      )}
    </div>
  );
}
