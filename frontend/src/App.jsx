import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pays from './pages/Pays';
import StatPays from './pages/StatPays';
import Utilisateurs from './pages/Utilisateurs';
import Parametres from './pages/Parametres';

function RequireAuth({ children }) {
  const { isAuth, ready } = useAuth();
  const loc = useLocation();
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="mg-spinner" />
      </div>
    );
  }
  if (!isAuth) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pays" element={<Pays />} />
        <Route path="/stats" element={<StatPays />} />
        <Route path="/stats/:paysId" element={<StatPays />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />
        <Route path="/parametres" element={<Parametres />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
