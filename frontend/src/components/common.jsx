import { html, icHtml } from '../lib/ui';

// <IconSpan path=ICONS.x size=18 /> — rend une icone SVG inline
export function IconSpan({ path, size = 18, style }) {
  return <span style={{ display: 'inline-flex', ...style }} dangerouslySetInnerHTML={html(icHtml(path, size))} />;
}

export function Loader({ label = 'Chargement…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '80px 20px', color: 'var(--muted)' }}>
      <div className="mg-spinner" />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
      <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Une erreur est survenue</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ fontSize: 13, fontWeight: 700, padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140C', cursor: 'pointer' }}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>{children}</div>;
}
