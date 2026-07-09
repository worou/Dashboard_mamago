import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('mamago_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [ready, setReady] = useState(!getToken()); // si pas de jeton, pret tout de suite

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('mamago_user');
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  // Revalide le profil au chargement si un jeton existe
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api.me()
      .then((u) => { if (!cancelled) { setUser(u); localStorage.setItem('mamago_user', JSON.stringify(u)); } })
      .catch(() => { /* le handler 401 gere la deconnexion */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    localStorage.setItem('mamago_user', JSON.stringify(data.utilisateur));
    setUser(data.utilisateur);
    return data.utilisateur;
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
