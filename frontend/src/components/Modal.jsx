import { S, styleObj } from '../lib/ui';

// Modale generique pilotee par une liste de champs.
// fields: [{ key, label, ph, type:'text'|'select'|'password', options }]
export default function Modal({ title, cta, fields, values, onChange, onSubmit, onClose, busy }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--overlay)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn .18s ease both' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow)', animation: 'slideUp .22s ease both', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          {fields.map((f) => {
            // Case a cocher (ex. « creer le compte Admin Pays »)
            if (f.type === 'checkbox') {
              const on = !!values[f.key];
              return (
                <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: 'var(--surface2)', border: '1px solid ' + (on ? 'var(--green)' : 'var(--border)'), borderRadius: 10, padding: '11px 12px' }}>
                  <input type="checkbox" checked={on} onChange={(e) => onChange(f.key, e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer' }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.label}</span>
                    {f.hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{f.hint}</span>}
                  </span>
                </label>
              );
            }

            // Simple separateur de section
            if (f.type === 'section') {
              return (
                <div key={f.key} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', marginTop: 4 }}>
                  {f.label}
                </div>
              );
            }

            return (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} style={styleObj(S.input + 'cursor:pointer;')}>
                    {(f.options || []).map((o) => (
                      <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'password' ? 'password' : f.type === 'date' ? 'date' : 'text'}
                    value={values[f.key] ?? ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    placeholder={f.ph}
                    style={styleObj(S.input)}
                  />
                )}
                {f.hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{f.hint}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 20px 20px' }}>
          <button onClick={onClose} style={styleObj(S.btnGhost)}>Annuler</button>
          <button onClick={onSubmit} disabled={busy} style={styleObj(S.btnGreen + (busy ? 'opacity:.6;cursor:default;' : ''))}>
            {busy ? '…' : cta}
          </button>
        </div>
      </div>
    </div>
  );
}
