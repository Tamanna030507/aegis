export default function DataQualityBadge({ quality }) {
  if (!quality || quality === 'good') return null;

  const config = {
    rule_based: {
      color: '#d69e2e',
      bg: 'rgba(214,158,46,0.1)',
      border: 'rgba(214,158,46,0.25)',
      icon: '⚡',
      text: 'AI unavailable — real patient data, clinical rules applied',
    },
    unavailable: {
      color: '#fc8181',
      bg: 'rgba(252,129,129,0.06)',
      border: 'rgba(252,129,129,0.2)',
      icon: '⚠',
      text: 'Analysis unavailable — manual assessment required',
    },
    degraded: {
      color: '#b794f4',
      bg: 'rgba(183,148,244,0.08)',
      border: 'rgba(183,148,244,0.2)',
      icon: '◑',
      text: 'Partial data — confidence reduced',
    },
    partial: {
      color: '#63b3ed',
      bg: 'rgba(99,179,237,0.08)',
      border: 'rgba(99,179,237,0.2)',
      icon: '◑',
      text: 'Partial signals — some biomarkers unavailable',
    },
  };

  const c = config[quality] || config.degraded;

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      padding: '7px 12px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: '0.75rem',
      color: c.color,
    }}>
      <span>{c.icon}</span>
      <span>{c.text}</span>
    </div>
  );
}
