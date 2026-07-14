import { useState } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

/**
 * Creation d'un pays, avec provisionnement optionnel de son compte
 * « Admin Pays ». Partage entre la page Pays et l'ecran « Interface pays »
 * (ou l'on peut creer le pays s'il n'existe pas encore).
 *
 * onCreated(res) recoit { pays, admin } renvoye par l'API.
 * Reserve au SuperAdmin cote API (403 sinon).
 */
export default function CreatePaysModal({ onClose, onCreated, nomInitial = '' }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ nom_pays: nomInitial, devise: 'XOF', creer_admin: true });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.nom_pays || !form.code_iso) { toast('Nom et code requis'); return; }
    if (form.creer_admin && (!form.admin_nom || !form.admin_prenom || !form.admin_mdp)) {
      toast('Compte admin : prénom, nom et mot de passe requis');
      return;
    }
    setBusy(true);
    try {
      const res = await api.createPays({
        nom_pays: form.nom_pays,
        code_iso: form.code_iso.toUpperCase().slice(0, 2),
        devise: form.devise || 'XOF',
        creer_admin: !!form.creer_admin,
        admin: form.creer_admin ? {
          nom: form.admin_nom,
          prenom: form.admin_prenom,
          email: form.admin_email || '',   // vide => genere admin.<code>@mamago.com
          telephone: form.admin_tel || null,
          mot_de_passe: form.admin_mdp,
        } : undefined,
      });
      toast(res.admin
        ? `${form.nom_pays} créé · admin : ${res.admin.email}`
        : `${form.nom_pays} créé`);
      onCreated(res);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    { key: 'nom_pays', label: 'Nom du pays', ph: 'Ex. Niger' },
    { key: 'code_iso', label: 'Code ISO (2 lettres)', ph: 'Ex. NE', hint: "Sert aussi de slug d'URL : /interface/ne" },
    { key: 'devise', label: 'Devise', type: 'select', options: ['XOF', 'XAF', 'GNF', 'EUR'] },
    {
      key: 'creer_admin', type: 'checkbox',
      label: "Créer l'interface admin de ce pays",
      hint: 'Provisionne un compte « Admin Pays » qui ne pourra gérer que ce pays.',
    },
    ...(form.creer_admin ? [
      { key: 'admin_section', type: 'section', label: 'Compte Admin Pays' },
      { key: 'admin_prenom', label: 'Prénom', ph: 'Ex. Hadiza' },
      { key: 'admin_nom', label: 'Nom', ph: 'Ex. Souley' },
      {
        key: 'admin_email', label: 'E-mail (optionnel)',
        ph: 'admin.' + (form.code_iso || 'xx').toLowerCase() + '@mamago.com',
        hint: 'Laissez vide pour générer automatiquement.',
      },
      { key: 'admin_tel', label: 'Téléphone', ph: '+227 90 00 00 00', hint: 'Affiché dans les coordonnées du responsable.' },
      { key: 'admin_mdp', label: 'Mot de passe', type: 'password', ph: '••••••••' },
    ] : []),
  ];

  return (
    <Modal
      title="Créer un pays"
      cta={form.creer_admin ? 'Créer le pays et son admin' : 'Créer le pays'}
      busy={busy}
      values={form}
      onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
      onClose={onClose}
      onSubmit={submit}
      fields={fields}
    />
  );
}
