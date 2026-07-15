import { useState } from 'react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { ICONS, initials, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const ROLE_TINT = {
  SuperAdmin: ['rgba(22,179,100,.18)', '#24D97C'],
  'Admin Pays': ['rgba(74,166,232,.18)', '#4AA6E8'],
  Commercial: ['rgba(184,122,232,.18)', '#B87AE8'],
};
const ROLE_ICON = { SuperAdmin: ICONS.shield, 'Admin Pays': ICONS.globe2, Commercial: ICONS.trend };
const ROLE_DESC = {
  SuperAdmin: 'Accès global à la plateforme.',
  'Admin Pays': 'Accès limité à son pays. Crée les comptes commerciaux (soumis à validation), consulte les données et suit les performances de son périmètre.',
  Commercial: 'Accès limité à son portefeuille : une ville, avec tous ses services.',
};
const tint = (r) => ROLE_TINT[r] || ['var(--green-dim)', 'var(--green-hi)'];

const STATUT_PILL = {
  en_attente: ['rgba(232,178,74,.16)', 'var(--amber)', 'En attente'],
  validee: ['var(--green-dim)', 'var(--green-hi)', 'Validée'],
  refusee: ['var(--red-dim)', 'var(--red)', 'Refusée'],
};

function fmtDate(s) {
  if (!s) return 'Jamais';
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? s : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Utilisateurs() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);  // 'add' | 'edit' | 'demande'
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = user?.role === 'SuperAdmin';

  const { loading, error, data, reload } = useFetch(
    () => Promise.all([
      api.utilisateurs(),
      api.roles(),
      api.demandes.list(),
      api.villes.list(),   // deja cloisonnees : l'Admin Pays ne voit que ses villes
      api.pays(),          // pour attribuer son pays a un Admin Pays
    ]).then(([users, roles, demandes, villes, pays]) => ({ users, roles, demandes, villes, pays })),
    []
  );

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { users, roles, demandes, villes, pays } = data;
  const enAttente = demandes.filter((d) => d.statut === 'en_attente');
  const traitees = demandes.filter((d) => d.statut !== 'en_attente');

  const rows = users.filter((u) => (`${u.prenom} ${u.nom} ${u.email}`).toLowerCase().includes(q.toLowerCase()));

  const villeOptions = villes.map((v) => ({ value: v.id, label: v.nom_ville + ' (' + v.nom_pays + ')' }));
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.libelle_role }));
  const paysOptions = pays.map((p) => ({ value: p.id, label: p.nom_pays }));

  // Role actuellement selectionne dans le formulaire (pour afficher le bon champ de perimetre)
  const roleChoisi = roles.find((r) => String(r.id) === String(form.role_id))?.libelle_role;

  // ---- Actions ----
  const openDemande = () => {
    setForm({ ville_id: villes[0]?.id });
    setModal('demande');
  };
  const openAdd = () => { setForm({ role_id: roles[0]?.id }); setModal('add'); };
  const openEdit = async (u) => {
    setMenu(null);
    let paysId = '';
    try {
      // Le detail renvoie le perimetre pays (non present dans la liste)
      const detail = await api.utilisateurOne(u.id);
      paysId = detail.pays_ids?.[0] || '';
    } catch { /* perimetre inconnu : le champ restera vide */ }

    setForm({
      id: u.id, nom: u.nom, prenom: u.prenom, email: u.email,
      telephone: u.telephone || '', role_id: u.role_id,
      pays_id: paysId,
      ville_id: u.villes?.[0]?.id || '',
    });
    setModal('edit');
  };

  const remove = async (u) => {
    setMenu(null);
    if (!window.confirm(`Supprimer ${u.prenom} ${u.nom} ?`)) return;
    try { await api.deleteUtilisateur(u.id); toast(`${u.prenom} ${u.nom} supprimé`); reload(); }
    catch (e) { toast(e.message); }
  };

  // Activation / desactivation d'un compte : un compte inactif ne peut plus
  // se connecter (l'API rejette le login et invalide le jeton existant).
  const toggleActif = async (u) => {
    setMenu(null);
    const activer = !u.actif;
    if (!activer && !window.confirm(`Désactiver ${u.prenom} ${u.nom} ? Il ne pourra plus se connecter.`)) return;
    try {
      await api.updateUtilisateur(u.id, { actif: activer });
      toast(`${u.prenom} ${u.nom} ${activer ? 'activé' : 'désactivé'}`);
      reload();
    } catch (e) { toast(e.message); }
  };

  const valider = async (d) => {
    try { await api.demandes.valider(d.id); toast(`Compte de ${d.prenom} ${d.nom} créé`); reload(); }
    catch (e) { toast(e.message); }
  };
  const refuser = async (d) => {
    const motif = window.prompt(`Motif du refus (${d.prenom} ${d.nom}) :`, '');
    if (motif === null) return;
    try { await api.demandes.refuser(d.id, motif); toast('Demande refusée'); reload(); }
    catch (e) { toast(e.message); }
  };
  const annuler = async (d) => {
    if (!window.confirm('Annuler cette demande ?')) return;
    try { await api.demandes.remove(d.id); toast('Demande annulée'); reload(); }
    catch (e) { toast(e.message); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (modal === 'demande') {
        if (!form.nom || !form.prenom || !form.email || !form.mot_de_passe || !form.ville_id) {
          toast('Tous les champs sont requis'); setBusy(false); return;
        }
        await api.demandes.create({
          nom: form.nom, prenom: form.prenom, email: form.email,
          telephone: form.telephone || null, mot_de_passe: form.mot_de_passe,
          ville_id: Number(form.ville_id),
        });
        toast('Demande envoyée au SuperAdmin pour validation');
      } else if (modal === 'add') {
        if (roleChoisi === 'Admin Pays' && !form.pays_id) {
          toast('Attribuez un pays à ce responsable'); setBusy(false); return;
        }
        await api.createUtilisateur({
          nom: form.nom, prenom: form.prenom, email: form.email,
          telephone: form.telephone || null, mot_de_passe: form.mot_de_passe,
          role_id: Number(form.role_id),
          pays_ids: form.pays_id ? [Number(form.pays_id)] : [],
          ville_ids: form.ville_id ? [Number(form.ville_id)] : [],
        });
        toast(`${form.prenom} créé`);
      } else {
        const body = {
          nom: form.nom, prenom: form.prenom, email: form.email,
          telephone: form.telephone || null, role_id: Number(form.role_id),
        };
        if (form.mot_de_passe) body.mot_de_passe = form.mot_de_passe;
        if (form.pays_id) body.pays_ids = [Number(form.pays_id)];
        if (form.ville_id) body.ville_ids = [Number(form.ville_id)];
        await api.updateUtilisateur(form.id, body);
        toast('Utilisateur modifié');
      }
      setModal(null); setForm({}); reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  // Champs du formulaire selon le mode
  const fields = modal === 'demande'
    ? [
        { key: 'prenom', label: 'Prénom', ph: 'Ex. Sekou' },
        { key: 'nom', label: 'Nom', ph: 'Ex. Bamba' },
        { key: 'email', label: 'Adresse e-mail', ph: 'prenom.nom@mamago.com' },
        { key: 'telephone', label: 'Téléphone', ph: '+225 07 00 00 00 00' },
        { key: 'mot_de_passe', label: 'Mot de passe', type: 'password', ph: '••••••••' },
        {
          key: 'ville_id', label: 'Portefeuille (ville)', type: 'select', options: villeOptions,
          hint: 'La ville sélectionnée inclut tous ses services (restaurant, shopping…).',
        },
      ]
    : [
        { key: 'prenom', label: 'Prénom' },
        { key: 'nom', label: 'Nom' },
        { key: 'email', label: 'Adresse e-mail' },
        { key: 'telephone', label: 'Téléphone', ph: '+225 07 00 00 00 00' },
        { key: 'mot_de_passe', label: modal === 'add' ? 'Mot de passe' : 'Nouveau mot de passe (optionnel)', type: 'password', ph: '••••••••' },
        ...(isSuperAdmin ? [{ key: 'role_id', label: 'Rôle', type: 'select', options: roleOptions }] : []),

        // Le perimetre depend du role : un Admin Pays gere un PAYS,
        // un Commercial gere une VILLE (son portefeuille).
        ...(roleChoisi === 'Admin Pays' ? [{
          key: 'pays_id', label: 'Pays attribué', type: 'select',
          options: [{ value: '', label: '— Sélectionner —' }, ...paysOptions],
          hint: "Sans pays attribué, ce responsable ne verrait aucune donnée.",
        }] : []),
        ...(roleChoisi === 'Commercial' || !isSuperAdmin ? [{
          key: 'ville_id', label: 'Portefeuille (ville)', type: 'select',
          options: [{ value: '', label: '— Aucun —' }, ...villeOptions],
          hint: 'La ville inclut tous ses services (restaurant, shopping…).',
        }] : []),
      ];

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      {/* Barre d'actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', flex: 1, minWidth: 220 }}>
          <span dangerouslySetInnerHTML={html(icHtml(ICONS.search, 16))} style={{ color: 'var(--muted)', display: 'inline-flex' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un utilisateur…" style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 13, padding: '10px 0', width: '100%' }} />
        </div>
        {isSuperAdmin
          ? <button onClick={openAdd} style={styleObj(S.btnGreen)}>+ Nouvel utilisateur</button>
          : <button onClick={openDemande} style={styleObj(S.btnGreen)}>+ Demander un compte commercial</button>}
      </div>

      {/* Demandes en attente */}
      {enAttente.length > 0 && (
        <div style={{ ...styleObj(S.card), marginBottom: 16, borderColor: 'var(--amber)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(232,178,74,.16)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSpan path={ICONS.shield} size={15} />
            </span>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>
              {isSuperAdmin ? 'Demandes à valider' : 'Mes demandes en attente'} ({enAttente.length})
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {isSuperAdmin
              ? 'Comptes commerciaux demandés par les Administrateurs pays.'
              : 'En attente de validation par le SuperAdmin.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {enAttente.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 11, padding: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: tint('Commercial')[0], color: tint('Commercial')[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {initials(`${d.prenom} ${d.nom}`)}
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.prenom} {d.nom}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    {d.email} · portefeuille : <b style={{ color: 'var(--text2)' }}>{d.nom_ville}</b> ({d.nom_pays})
                    {isSuperAdmin && ` · demandé par ${d.demandeur}`}
                  </div>
                </div>
                {isSuperAdmin ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => valider(d)} style={styleObj(S.btnGreen)}>Valider</button>
                    <button onClick={() => refuser(d)} style={styleObj(S.btnGhost + 'color:var(--red);')}>Refuser</button>
                  </div>
                ) : (
                  <button onClick={() => annuler(d)} style={styleObj(S.btnGhost)}>Annuler</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique des demandes traitees (cote Admin Pays) */}
      {!isSuperAdmin && traitees.length > 0 && (
        <div style={{ ...styleObj(S.card), marginBottom: 16 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Demandes traitées</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {traitees.map((d) => {
              const [bg, fg, lbl] = STATUT_PILL[d.statut];
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={styleObj(`font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${fg};`)}>{lbl}</span>
                  <span style={{ fontWeight: 600 }}>{d.prenom} {d.nom}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{d.nom_ville}</span>
                  {d.motif_refus && <span style={{ color: 'var(--red)', fontSize: 12 }}>— {d.motif_refus}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cartes de roles (SuperAdmin : vision globale) */}
      {isSuperAdmin && (
        <div className="mg-cards3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {['SuperAdmin', 'Admin Pays', 'Commercial'].map((r) => (
            <div key={r} style={styleObj(S.cardPad('18px'))}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: tint(r)[0], color: tint(r)[1], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconSpan path={ROLE_ICON[r]} size={18} />
                </span>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22 }}>
                  {users.filter((u) => u.role === r).length}
                </span>
              </div>
              <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15, marginTop: 12 }}>{r}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{ROLE_DESC[r]}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table des comptes */}
      <div style={styleObj(S.card)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>
            {isSuperAdmin ? 'Tous les utilisateurs' : 'Mes commerciaux'}
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rows.length} affichés</span>
        </div>

        {rows.length === 0 ? (
          <Empty>
            {isSuperAdmin
              ? 'Aucun utilisateur.'
              : "Aucun commercial pour l'instant. Utilisez « Demander un compte commercial »."}
          </Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Utilisateur', 'Rôle', 'Portefeuille', 'Dernière connexion', 'Statut', ''].map((h, i) => (
                    <th key={i} style={styleObj(S.th)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const tn = tint(u.role);
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span style={{ width: 36, height: 36, borderRadius: '50%', background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5 }}>
                            {initials(`${u.prenom} ${u.nom}`)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.prenom} {u.nom}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{u.email}{u.telephone ? ' · ' + u.telephone : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={styleObj(`font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:${tn[0]};color:${tn[1]};`)}>{u.role}</span>
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--text2)' }}>
                        {u.villes?.length
                          ? u.villes.map((v) => v.nom_ville).join(', ')
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--text2)' }}>{fmtDate(u.derniere_connexion)}</td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: u.actif ? 'var(--green-hi)' : 'var(--muted)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 6 }} />
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', position: 'relative' }}>
                        <button onClick={() => setMenu(menu === u.id ? null : u.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>⋯</button>
                        {menu === u.id && (
                          <>
                            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                            <div style={{ position: 'absolute', top: 44, right: 14, width: 190, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 40, overflow: 'hidden', textAlign: 'left', animation: 'popIn .15s ease both' }}>
                              <button onClick={() => openEdit(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Modifier</button>
                              <button onClick={() => toggleActif(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: u.actif ? 'var(--amber)' : 'var(--green-hi)' }}>
                                {u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                              </button>
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
          title={modal === 'demande' ? 'Demander un compte commercial'
            : modal === 'add' ? 'Nouvel utilisateur' : "Modifier l'utilisateur"}
          cta={modal === 'demande' ? 'Envoyer la demande'
            : modal === 'add' ? 'Créer le compte' : 'Enregistrer'}
          busy={busy}
          values={form}
          onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onClose={() => { setModal(null); setForm({}); }}
          onSubmit={submit}
          fields={fields}
        />
      )}
    </div>
  );
}
