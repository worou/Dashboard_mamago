import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { ICONS, tintFor, codeFor, moneyDev, interfaceUrl, paysSlug, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import CreatePaysModal from '../components/CreatePaysModal';
import EspacePays from './EspacePays';

/**
 * Interface pays generee a la demande.
 *
 *  /interface          -> demande le pays concerne (champ de selection)
 *  /interface/:paysId  -> genere l'interface avec les informations du pays
 *                         telles qu'elles existent en base.
 *
 * L'interface generee est la meme que l'espace d'administration
 * (villes, livreurs, clients, courses + informations du pays).
 */
export default function InterfacePays() {
  const { paysId } = useParams();

  // Un pays est choisi : on genere son interface.
  if (paysId) return <EspacePays />;

  return <SelectionPays />;
}

function SelectionPays() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [choix, setChoix] = useState('');
  const [genere, setGenere] = useState(null);   // { pays, url } une fois generee
  const [creation, setCreation] = useState(false);

  const { loading, error, data, reload } = useFetch(() => api.pays(), []);

  const isSuperAdmin = user?.role === 'SuperAdmin';

  if (loading) return <Loader label="Chargement des pays…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const list = data || [];
  const selected = list.find((p) => String(p.id) === String(choix));

  // Genere l'URL par laquelle l'interface du pays sera affichee.
  const generer = () => {
    if (!selected) return;
    setGenere({ pays: selected, url: interfaceUrl(selected) });
  };

  // Le pays n'existe pas encore : on le cree, puis on genere son URL.
  const onCreated = (res) => {
    setCreation(false);
    const nouveau = res.pays;
    setChoix(String(nouveau.id));
    setGenere({ pays: nouveau, url: interfaceUrl(nouveau) });
    reload();   // rafraichit la liste du champ
  };

  const copier = () => {
    navigator.clipboard?.writeText(genere.url);
    toast('URL copiée');
  };

  return (
    <div style={{ animation: 'floatIn .35s ease both', maxWidth: 620 }}>
      <div style={styleObj(S.card + 'padding:26px;')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--green-dim)', color: 'var(--green-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSpan path={ICONS.layout} size={20} />
          </span>
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 17 }}>Générer une interface pays</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              Choisissez le pays concerné : l'interface est construite à partir des données en base.
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {isSuperAdmin
                ? "Aucun pays n'existe encore. Créez-en un pour générer son interface."
                : 'Aucun pays disponible dans votre périmètre.'}
            </div>
            {isSuperAdmin && (
              <button onClick={() => setCreation(true)} style={styleObj(S.btnGreen + 'padding:11px 18px;')}>
                + Créer un pays
              </button>
            )}
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '20px 0 6px' }}>
              Pays concerné
            </label>
            <select
              value={choix}
              onChange={(e) => setChoix(e.target.value)}
              style={styleObj(S.input + 'cursor:pointer;')}
            >
              <option value="">— Sélectionner un pays —</option>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom_pays} ({p.code_iso || '—'})
                </option>
              ))}
            </select>

            {/* Apercu des donnees existantes pour le pays choisi */}
            {selected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <span style={{ width: 42, height: 42, borderRadius: 11, background: tintFor(codeFor(selected))[0], color: tintFor(codeFor(selected))[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {codeFor(selected)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.nom_pays}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {selected.nb_villes > 0
                      ? `${selected.nb_villes} ville${selected.nb_villes > 1 ? 's' : ''} enregistrée${selected.nb_villes > 1 ? 's' : ''} · CA ${moneyDev(selected.ca_global, selected.devise)}`
                      : 'Aucune donnée encore : l\'interface sera générée vide, prête à être remplie.'}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={generer}
              disabled={!choix}
              style={{ ...styleObj(S.btnGreen), width: '100%', padding: 12, fontSize: 14, marginTop: 18, opacity: choix ? 1 : 0.5, cursor: choix ? 'pointer' : 'not-allowed' }}
            >
              Générer l'interface
            </button>

            {/* Le pays cherche n'est pas dans la liste : on le cree ici. */}
            {isSuperAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: 12.5, color: 'var(--muted)' }}>
                <span>Le pays n'existe pas ?</span>
                <button
                  onClick={() => setCreation(true)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--green-hi)', fontWeight: 700, fontSize: 12.5 }}
                >
                  + Créer un pays
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Resultat : l'URL par laquelle l'interface sera affichee */}
      {genere && (
        <div style={{ ...styleObj(S.card + 'padding:22px;'), marginTop: 16, animation: 'slideUp .25s ease both', borderColor: 'var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              dangerouslySetInnerHTML={html('<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="#04140C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')} />
            <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15 }}>
              Interface générée — {genere.pays.nom_pays}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
            L'interface est accessible à cette URL :
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            <IconSpan path={ICONS.globe2} size={16} style={{ color: 'var(--green-hi)', flexShrink: 0 }} />
            <input
              readOnly
              value={genere.url}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontFamily: 'Space Grotesk, monospace', fontSize: 13 }}
            />
            <button onClick={copier} style={styleObj('font-size:12px;font-weight:700;padding:6px 11px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer;')}>
              Copier
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => nav('/interface/' + paysSlug(genere.pays))} style={{ ...styleObj(S.btnGreen), flex: 1, padding: 11 }}>
              Ouvrir l'interface
            </button>
            <button onClick={() => window.open(genere.url, '_blank')} style={{ ...styleObj(S.btnGhost), flex: 1, padding: 11 }}>
              Ouvrir dans un onglet
            </button>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>
            L'URL est construite à partir du <b>code du pays</b> (<code>{paysSlug(genere.pays)}</code>).
            Elle reste valable et rejoue l'interface avec les données à jour.
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
        L'interface générée reprend l'espace d'administration : informations du pays,
        villes, livreurs, clients et courses. Elle reste cloisonnée à ce pays.
      </div>

      {creation && (
        <CreatePaysModal onClose={() => setCreation(false)} onCreated={onCreated} />
      )}
    </div>
  );
}
