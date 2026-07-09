import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { S, styleObj, html } from '../lib/ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@mamago.com');
  const [password, setPassword] = useState('password');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, animation: 'floatIn .35s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 26 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--green),var(--green-hi))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px var(--green-dim)' }}
            dangerouslySetInnerHTML={html('<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="#04140C" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 2v20M3 7l9 5 9-5" stroke="#04140C" stroke-width="1.8" stroke-linejoin="round"/></svg>')} />
          <div>
            <div style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 24, letterSpacing: '-.5px', lineHeight: 1 }}>MamaGo</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginTop: 3 }}>Manager par pays</div>
          </div>
        </div>

        <form onSubmit={submit} style={styleObj(S.card + 'padding:26px;')}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Connexion</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 20 }}>Accédez à votre espace d'administration.</div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Adresse e-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@mamago.com" style={{ ...styleObj(S.input), marginBottom: 14 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...styleObj(S.input), marginBottom: 6 }} />

          {err && <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-dim)', padding: '8px 12px', borderRadius: 9, margin: '10px 0 0' }}>{err}</div>}

          <button type="submit" disabled={busy} style={{ ...styleObj(S.btnGreen), width: '100%', padding: '12px', fontSize: 14, marginTop: 18, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>

          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 16, lineHeight: 1.6 }}>
            Comptes de démo (mot de passe <b>password</b>) :<br />
            admin@mamago.com · ci.admin@mamago.com · commercial@mamago.com
          </div>
        </form>
      </div>
    </div>
  );
}
