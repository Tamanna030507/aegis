import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,12,22,0.95)',
  border: '1px solid rgba(79,209,197,0.2)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: '0.82rem',
};

/**
 * BiomarkerTrend — small sparkline chart for a single biomarker over time.
 * Props: data (array of {day, value}), color, label, unit
 */
export default function BiomarkerTrend({ data = [], color = 'var(--accent-primary)', label = '', unit = '' }) {
  if (!data.length) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
      No data yet
    </div>
  );

  return (
    <div>
      {label && <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</p>}
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,209,197,0.06)" />
          <XAxis dataKey="day" tick={{ fill: '#4a5568', fontSize: 9 }} />
          <YAxis tick={{ fill: '#4a5568', fontSize: 9 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}${unit}`, label]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
