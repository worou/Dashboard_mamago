import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { money, moneyDev, ICONS, tintFor, codeFor, interfaceUrl, initials, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'villes', label: 'Villes', icon: ICONS.pays },
  { id: 'livreurs', label: 'Livreurs', icon: ICONS.moto },
  { id: 'clients', label: 'Clients', icon: ICONS.users },
  { id: 'courses', label: 'Courses', icon: ICONS.box },
];

const SINGULAR = { villes: 'ville', livreurs: 'livreur', clients: 'client', courses: 'course' };

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? s : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const pill = (txt, ok) =>
  'font-size:12px;font-weight:700;padding:3px 9px;border-radius:20px;background:' +
  (ok ? 'var(--green-dim)' : 'rgba(232,178,74,.16)') + ';color:' + (ok ? 'var(--green-hi)' : 'var(--amber)') + ';';

export default function EspacePays() {
  const { paysId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState('villes');
  const [version, setVersion] = useState(0);   // force le rechargement apres mutation
  const [modal, setModal] = useState(null);    // 'add' | 'edit'
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const readOnly = user?.role === 'Commercial';

  // Charge toutes les informations du pays presentes en base.
  // Le parametre d'URL accepte le code ISO (« ci ») ou l'id numerique.
  const { loading, error, data, reload } = useFetch(async () => {
    const list = await api.pays();
    const ref = String(paysId).toLowerCase();
    const pays = list.find(
      (p) => String(p.id) === ref || String(p.code_iso || '').toLowerCase() === ref
    );
    if (!pays) throw new Error(`Aucun pays ne correspond à « ${paysId} » dans votre périmètre.`);

    const id = pays.id;
    const [villes, services, livreurs, clientsRes, coursesRes, admins] = await Promise.all([
      api.villes.list({ pays_id: id }),
      api.services(),
      api.livreurs.list({ pays_id: id }),
      api.clients.list({ pays_id: id, per_page: 200 }),
      // per_page=1 hors de l'onglet Courses : on ne veut que le total (meta)
      api.courses.list({ pays_id: id, per_page: tab === 'courses' ? 50 : 1 }),
      api.paysAdmins(id),
    ]);
    const clients = clientsRes.data || [];
    const courses = coursesRes.data || [];
    const nbCourses = coursesRes.meta?.total ?? courses.length;
    return { pays, villes, services, livreurs, clients, courses, nbCourses, admins };
  }, [paysId, tab, version]);

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { pays, villes, services, livreurs, clients, courses, nbCourses, admins } = data;
  const responsable = admins?.responsable || null;
  const autresContacts = (admins?.contacts || []).filter((c) => c.id !== responsable?.id);
  const tn = tintFor(codeFor(pays));
  const devise = pays.devise || '';
  const refresh = () => setVersion((v) => v + 1);

  const villeOptions = villes.map((v) => ({ value: v.id, label: v.nom_ville }));

  // ---- Champs du formulaire selon l'onglet ----
  const fieldsFor = (t) => {
    switch (t) {
      case 'villes':
        return [{ key: 'nom_ville', label: 'Nom de la ville', ph: 'Ex. Niamey' }];
      case 'livreurs':
        return [
          { key: 'prenom', label: 'Prénom', ph: 'Ex. Awa' },
          { key: 'nom', label: 'Nom', ph: 'Ex. Koné' },
          { key: 'telephone', label: 'Téléphone', ph: 'Ex. 0700000000' },
          { key: 'ville_id', label: 'Ville', type: 'select', options: villeOptions },
          { key: 'note_moyenne', label: 'Note (0 à 5)', ph: 'Ex. 4.5' },
          { key: 'statut', label: 'Statut', type: 'select', options: ['actif', 'inactif', 'suspendu'] },
        ];
      case 'clients':
        return [
          { key: 'prenom', label: 'Prénom', ph: 'Ex. Fatou' },
          { key: 'nom', label: 'Nom', ph: 'Ex. Diallo' },
          { key: 'email', label: 'E-mail', ph: 'client@mail.com' },
          { key: 'telephone', label: 'Téléphone', ph: 'Ex. 0700000000' },
          { key: 'ville_id', label: 'Ville', type: 'select', options: villeOptions },
          { key: 'date_inscription', label: "Date d'inscription", type: 'date' },
          { key: 'statut', label: 'Statut', type: 'select', options: ['nouveau', 'actif', 'inactif'] },
        ];
      case 'courses':
        return [
          { key: 'ville_id', label: 'Ville', type: 'select', options: villeOptions },
          { key: 'service_id', label: 'Service', type: 'select', options: services.map((s) => ({ value: s.id, label: s.nom_service })) },
          { key: 'client_id', label: 'Client', type: 'select', options: clients.map((c) => ({ value: c.id, label: c.prenom + ' ' + c.nom })) },
          { key: 'livreur_id', label: 'Livreur (optionnel)', type: 'select', options: [{ value: '', label: '— Aucun —' }, ...livreurs.map((l) => ({ value: l.id, label: l.prenom + ' ' + l.nom }))] },
          { key: 'date_course', label: 'Date', type: 'date' },
          { key: 'montant', label: 'Montant (' + devise + ')', ph: 'Ex. 3500' },
          { key: 'duree_minutes', label: 'Durée (minutes)', ph: 'Ex. 25' },
          { key: 'statut', label: 'Statut', type: 'select', options: ['en_attente', 'en_cours', 'terminee', 'annulee'] },
        ];
      default:
        return [];
    }
  };

  const openAdd = () => {
    const defaults = {
      villes: {},
      livreurs: { ville_id: villes[0]?.id, statut: 'actif', note_moyenne: '4.5' },
      clients: { ville_id: villes[0]?.id, statut: 'nouveau', date_inscription: new Date().toISOString().slice(0, 10) },
      courses: {
        ville_id: villes[0]?.id, service_id: services[0]?.id, client_id: clients[0]?.id,
        livreur_id: '', statut: 'terminee', date_course: new Date().toISOString().slice(0, 10),
      },
    }[tab];
    setForm(defaults || {});
    setModal('add');
  };

  const openEdit = (row) => {
    const f = { ...row };
    // Un <input type="date"> n'accepte que 'YYYY-MM-DD' (l'API renvoie un DATETIME).
    if (f.date_course) f.date_course = String(f.date_course).slice(0, 10);
    if (f.date_inscription) f.date_inscription = String(f.date_inscription).slice(0, 10);
    setForm(f);
    setModal('edit');
  };

  const remove = async (row) => {
    const nom = row.nom_ville || `${row.prenom || ''} ${row.nom || ''}`.trim() || '#' + row.id;
    if (!window.confirm(`Supprimer ${SINGULAR[tab]} « ${nom} » ?`)) return;
    try {
      await api[tab].remove(row.id);
      toast(`${nom} supprimé`);
      refresh();
    } catch (e) { toast(e.message); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      // Prepare le corps selon la ressource
      const b = { ...form };
      if (tab === 'villes') b.pays_id = pays.id;   // jamais le param d'URL (peut etre un code)
      ['ville_id', 'service_id', 'client_id', 'livreur_id', 'duree_minutes'].forEach((k) => {
        if (b[k] === '' || b[k] === undefined) delete b[k];
        else if (b[k] !== null) b[k] = Number(b[k]);
      });
      if (b.montant !== undefined) b.montant = Number(b.montant);
      if (b.note_moyenne !== undefined) b.note_moyenne = Number(b.note_moyenne);
      // L'API attend un DATETIME pour une course
      if (b.date_course && b.date_course.length === 10) b.date_course += ' 12:00:00';

      if (modal === 'add') {
        await api[tab].create(b);
        toast(SINGULAR[tab] + ' créé');
      } else {
        await api[tab].update(form.id, b);
        toast(SINGULAR[tab] + ' modifié');
      }
      setModal(null); setForm({}); refresh();
    } catch (e) {
      toast(e.message);
    } finally { setBusy(false); }
  };

  // ---- Colonnes et lignes selon l'onglet ----
  const TABLES = {
    villes: {
      cols: ['Ville', 'Clients', 'Livreurs'],
      rows: villes,
      cells: (v) => [
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{v.nom_ville}</span>,
        money(v.nb_clients), money(v.nb_livreurs),
      ],
    },
    livreurs: {
      cols: ['Livreur', 'Ville', 'Téléphone', 'Note', 'Courses', 'Statut'],
      rows: livreurs,
      cells: (l) => [
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{l.prenom} {l.nom}</span>,
        l.nom_ville, l.telephone || '—',
        Number(l.note_moyenne).toFixed(1),
        money(l.nb_courses_total),
        <span style={styleObj(pill(l.statut, l.statut === 'actif'))}>{l.statut}</span>,
      ],
    },
    clients: {
      cols: ['Client', 'Ville', 'Contact', 'Inscrit le', 'Statut'],
      rows: clients,
      cells: (c) => [
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{c.prenom} {c.nom}</span>,
        c.nom_ville,
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.email || c.telephone || '—'}</span>,
        c.date_inscription,
        <span style={styleObj(pill(c.statut, c.statut !== 'inactif'))}>{c.statut}</span>,
      ],
    },
    courses: {
      cols: ['Date', 'Ville', 'Service', 'Client', 'Livreur', 'Montant', 'Statut'],
      rows: courses,
      cells: (c) => [
        fmtDate(c.date_course), c.nom_ville, c.nom_service,
        c.client_nom, c.livreur_nom || '—',
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600 }}>{moneyDev(c.montant, devise)}</span>,
        <span style={styleObj(pill(c.statut, c.statut === 'terminee'))}>{c.statut}</span>,
      ],
    },
  };

  const T = TABLES[tab];

  return (
    <div style={{ animation: 'floatIn .35s ease both' }}>
      {/* En-tete de l'espace pays */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: tn[0], color: tn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 17 }}>{codeFor(pays)}</span>
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 20 }}>{pays.nom_pays} — Espace admin</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 12, fontFamily: 'Space Grotesk, monospace', color: 'var(--green-hi)', background: 'var(--green-dim)', padding: '3px 8px', borderRadius: 6 }}>
                {interfaceUrl(pays)}
              </code>
              <button
                onClick={() => { navigator.clipboard?.writeText(interfaceUrl(pays)); toast('URL copiée'); }}
                title="Copier l'URL de cette interface"
                style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Copier
              </button>
              {readOnly && <span style={{ fontSize: 11.5, color: 'var(--amber)', fontWeight: 600 }}>lecture seule</span>}
            </div>
          </div>
        </div>
        <button onClick={() => nav('/stats/' + pays.id)} style={styleObj(S.btnGhost)}>Voir les statistiques →</button>
      </div>

      {/* Informations du pays (telles qu'enregistrees en base) */}
      <div className="mg-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Identité', value: codeFor(pays), sub: pays.devise ? 'Devise ' + pays.devise : '—', icon: ICONS.globe2 },
          { label: 'CA cumulé', value: moneyDev(pays.ca_global, devise), sub: 'toutes courses terminées', icon: ICONS.money },
          { label: 'Réseau', value: money(villes.length) + ' villes', sub: money(livreurs.length) + ' livreurs', icon: ICONS.moto },
          { label: 'Activité', value: money(nbCourses) + ' courses', sub: money(clients.length) + ' clients', icon: ICONS.box },
        ].map((k, i) => (
          <div key={i} style={styleObj(S.cardPad('16px'))}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{k.label}</div>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--green-dim)', color: 'var(--green-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSpan path={k.icon} size={16} />
              </span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, marginTop: 8 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Coordonnees du responsable d'administration du pays */}
      <div style={{ ...styleObj(S.card), marginBottom: 16 }}>
        <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>Responsable de l'administration</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 14 }}>
          Contact en charge de {pays.nom_pays}
        </div>

        {responsable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--green-dim)', color: 'var(--green-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
              {initials(`${responsable.prenom} ${responsable.nom}`)}
            </span>

            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{responsable.prenom} {responsable.nom}</span>
                <span style={styleObj('font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:var(--green-dim);color:var(--green-hi);')}>
                  {responsable.role}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600, color: responsable.actif ? 'var(--green-hi)' : 'var(--muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 5 }} />
                  {responsable.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {/* E-mail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                <IconSpan path={ICONS.mail} size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <a href={'mailto:' + responsable.email} style={{ fontSize: 13, color: 'var(--green-hi)', fontWeight: 600 }}>
                  {responsable.email}
                </a>
                <button
                  onClick={() => { navigator.clipboard?.writeText(responsable.email); toast('E-mail copié'); }}
                  style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  Copier
                </button>
              </div>

              {/* Telephone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                <IconSpan path={ICONS.phone} size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                {responsable.telephone ? (
                  <>
                    <a href={'tel:' + String(responsable.telephone).replace(/\s/g, '')} style={{ fontSize: 13, color: 'var(--green-hi)', fontWeight: 600 }}>
                      {responsable.telephone}
                    </a>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(responsable.telephone); toast('Téléphone copié'); }}
                      style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Copier
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun téléphone renseigné</span>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                Dernière connexion : {fmtDate(responsable.derniere_connexion)}
                {responsable.created_at && ` · compte créé le ${String(responsable.created_at).slice(0, 10)}`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={'mailto:' + responsable.email} style={{ ...styleObj(S.btnGreen), textDecoration: 'none', color: '#04140C', textAlign: 'center' }}>
                Envoyer un e-mail
              </a>
              {responsable.telephone && (
                <a href={'tel:' + String(responsable.telephone).replace(/\s/g, '')} style={{ ...styleObj(S.btnGhost), textDecoration: 'none', textAlign: 'center' }}>
                  Appeler
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border-hi)', borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--text2)' }}>
            <b>Aucun responsable désigné</b> pour {pays.nom_pays}.
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {user?.role === 'SuperAdmin'
                ? 'Créez un compte « Admin Pays » et rattachez-le à ce pays depuis le menu Utilisateurs.'
                : "Contactez un SuperAdmin pour qu'un responsable soit désigné."}
            </div>
          </div>
        )}

        {/* Autres comptes ayant acces a ce pays */}
        {autresContacts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', marginBottom: 8 }}>
              Autres accès à ce pays
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {autresContacts.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {initials(`${c.prenom} ${c.nom}`)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{c.prenom} {c.nom}</span>
                  <a href={'mailto:' + c.email} style={{ color: 'var(--text2)', fontSize: 12.5 }}>{c.email}</a>
                  {c.telephone && (
                    <a href={'tel:' + String(c.telephone).replace(/\s/g, '')} style={{ color: 'var(--text2)', fontSize: 12.5 }}>
                      {c.telephone}
                    </a>
                  )}
                  <span style={styleObj('font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--surface2);color:var(--text2);')}>
                    {c.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: on ? 700 : 600, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--green)' : 'var(--border)'), background: on ? 'var(--green-dim)' : 'var(--surface)', color: on ? 'var(--green-hi)' : 'var(--text2)' }}>
              <IconSpan path={t.icon} size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Table de l'onglet actif */}
      <div style={styleObj(S.card)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16 }}>
            {TABS.find((t) => t.id === tab).label} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({T.rows.length})</span>
          </div>
          {!readOnly && (
            <button onClick={openAdd} disabled={tab !== 'villes' && villes.length === 0} style={styleObj(S.btnGreen + ((tab !== 'villes' && villes.length === 0) ? 'opacity:.5;cursor:not-allowed;' : ''))}>
              + Ajouter {tab === 'villes' ? 'une ville' : 'un ' + SINGULAR[tab]}
            </button>
          )}
        </div>

        {tab !== 'villes' && villes.length === 0 ? (
          <Empty>Créez d'abord une <b>ville</b> : livreurs, clients et courses y sont rattachés.</Empty>
        ) : T.rows.length === 0 ? (
          <Empty>Aucun élément. Cliquez sur « Ajouter » pour commencer.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {T.cols.map((c) => <th key={c} style={styleObj(S.th)}>{c}</th>)}
                  {!readOnly && <th style={styleObj(S.th)} />}
                </tr>
              </thead>
              <tbody>
                {T.rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                    {T.cells(row).map((cell, i) => (
                      <td key={i} style={{ padding: '12px 14px', fontSize: 13.5, color: i === 0 ? 'var(--text)' : 'var(--text2)' }}>{cell}</td>
                    ))}
                    {!readOnly && (
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(row)} title="Modifier"
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', marginRight: 6 }}>
                          <IconSpan path={ICONS.edit} size={14} />
                        </button>
                        <button onClick={() => remove(row)} title="Supprimer"
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>
                          <IconSpan path={ICONS.trash} size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={(modal === 'add' ? 'Ajouter ' : 'Modifier ') + (tab === 'villes' ? 'une ville' : 'un ' + SINGULAR[tab])}
          cta={modal === 'add' ? 'Ajouter' : 'Enregistrer'}
          busy={busy}
          values={form}
          onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onClose={() => { setModal(null); setForm({}); }}
          onSubmit={submit}
          fields={fieldsFor(tab)}
        />
      )}
    </div>
  );
}
