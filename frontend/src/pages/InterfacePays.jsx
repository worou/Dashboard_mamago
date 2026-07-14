import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { ICONS, tintFor, codeFor, moneyDev, S, styleObj, html, icHtml } from '../lib/ui';
import { IconSpan, Loader, ErrorBox, Empty } from '../components/common';
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
  const [choix, setChoix] = useState('');

  const { loading, error, data, reload } = useFetch(() => api.pays(), []);

  if (loading) return <Loader label="Chargement des pays…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const list = data || [];
  const selected = list.find((p) => String(p.id) === String(choix));

  const generer = () => {
    if (!choix) return;
    nav('/interface/' + choix);
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
          <Empty>Aucun pays disponible dans votre périmètre.</Empty>
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
          </>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
        L'interface générée reprend l'espace d'administration : informations du pays,
        villes, livreurs, clients et courses. Elle reste cloisonnée à ce pays.
      </div>
    </div>
  );
}
