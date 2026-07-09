// Graphiques SVG sans dependance, portes depuis la maquette MamaGo.

export function Sparkline({ data = [], up = true, w = 120, h = 34 }) {
  if (!data.length) return <svg width={w} height={h} />;
  const max = Math.max(...data), min = Math.min(...data), rng = (max - min) || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * w, h - 4 - ((v - min) / rng) * (h - 8)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const col = up ? 'var(--green-hi)' : 'var(--red)';
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={col} />
    </svg>
  );
}

export function AreaChart({ data = [], labels = [] }) {
  const w = 560, h = 210, pad = 28;
  if (!data.length) return <svg width="100%" viewBox={`0 0 ${w} ${h}`} />;
  const max = Math.max(...data, 1) * 1.1, min = 0, rng = max - min || 1;
  const X = (i) => pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / rng) * (h - pad * 2);
  const pts = data.map((v, i) => [X(i), Y(v)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${X(data.length - 1)} ${h - pad} L ${pad} ${h - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mg-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="var(--chart-grid)" strokeWidth={1} />
      ))}
      <path d={area} fill="url(#mg-area)" />
      <path d={line} fill="none" stroke="var(--green-hi)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--green-hi)" stroke="var(--surface)" strokeWidth={2} />
      {labels.map((m, i) => (
        <text key={i} x={X(i)} y={h - 8} fill="var(--muted)" fontSize={10} textAnchor="middle" fontFamily="Manrope">{m}</text>
      ))}
    </svg>
  );
}

export function GroupedBars({ a = [], b = [], labels = [] }) {
  const w = 560, h = 210, pad = 28;
  const n = Math.max(a.length, b.length);
  if (!n) return <svg width="100%" viewBox={`0 0 ${w} ${h}`} />;
  const max = Math.max(...a, ...b, 1) * 1.15;
  const slot = (w - pad * 2) / n, bw = slot * 0.28;
  const Y = (v) => h - pad - (v / max) * (h - pad * 2);
  const els = [];
  [0, 0.33, 0.66, 1].forEach((g, i) =>
    els.push(<line key={'g' + i} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="var(--chart-grid)" strokeWidth={1} />)
  );
  for (let i = 0; i < n; i++) {
    const cx = pad + slot * i + slot / 2;
    els.push(<rect key={'b' + i} x={cx - bw - 2} y={Y(b[i] || 0)} width={bw} height={(h - pad) - Y(b[i] || 0)} rx={3} fill="var(--amber)" opacity={0.9} />);
    els.push(<rect key={'a' + i} x={cx + 2} y={Y(a[i] || 0)} width={bw} height={(h - pad) - Y(a[i] || 0)} rx={3} fill="var(--green)" />);
    els.push(<text key={'t' + i} x={cx} y={h - 8} fill="var(--muted)" fontSize={10} textAnchor="middle" fontFamily="Manrope">{labels[i] || ''}</text>);
  }
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>{els}</svg>;
}

export function Donut({ segs = [], size = 120, centerTop, centerBottom = 'total' }) {
  const r = size / 2, sw = size * 0.16, C = 2 * Math.PI * (r - sw / 2);
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  let off = 0;
  const rings = segs.map((s, i) => {
    const len = (s.v / total) * C;
    const el = (
      <circle key={i} cx={r} cy={r} r={r - sw / 2} fill="none" stroke={s.color} strokeWidth={sw}
        strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${r} ${r})`} />
    );
    off += len;
    return el;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r} cy={r} r={r - sw / 2} fill="none" stroke="var(--surface2)" strokeWidth={sw} />
      {rings}
      <text x={r} y={r - 2} fill="var(--text)" fontSize={size * 0.16} fontWeight={700} textAnchor="middle" fontFamily="Space Grotesk">
        {centerTop != null ? centerTop : '100%'}
      </text>
      <text x={r} y={r + size * 0.14} fill="var(--muted)" fontSize={size * 0.09} textAnchor="middle" fontFamily="Manrope">
        {centerBottom}
      </text>
    </svg>
  );
}

// Barre de progression horizontale (CA par ville, types de paiement)
export function BarRow({ label, value, width, color = 'linear-gradient(90deg,var(--green),var(--green-hi))', thin }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, color: 'var(--text2)' }}>{value}</span>
      </div>
      <div style={{ height: thin ? 7 : 9, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width, background: color, borderRadius: 6, transformOrigin: 'left', animation: 'growW .7s ease both' }} />
      </div>
    </div>
  );
}
