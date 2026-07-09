import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { html } from '../lib/ui';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);

  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {msg && (
        <div
          className="mg-toast"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
            background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 12,
            boxShadow: 'var(--shadow)', padding: '12px 18px', display: 'flex', alignItems: 'center',
            gap: 10, animation: 'slideUp .22s ease both',
          }}
        >
          <span
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            dangerouslySetInnerHTML={html('<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10" stroke="#04140C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
          />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{msg}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
