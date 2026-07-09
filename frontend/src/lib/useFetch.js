import { useState, useEffect, useCallback } from 'react';

// Hook de chargement de donnees : { loading, error, data, reload }
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((d) => { if (!cancelled) setState({ loading: false, error: null, data: d }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e.message || 'Erreur', data: null }); });
    return () => { cancelled = true; };
  }, deps);

  useEffect(() => run(), [run]);

  return { ...state, reload: run };
}

// 'YYYY-MM' -> libelle mois court fr (ex: 'juin')
export function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}
