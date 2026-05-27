import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATIENT_LIST } from '../data/patients';

const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function RiskBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = value >= 0.75 ? 'var(--accent-red)'
              : value >= 0.55 ? 'var(--accent-amber)'
              : value >= 0.35 ? 'var(--accent-purple)'
              : 'var(--accent-green)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function VitalChip({ label, value, alert }) {
  return (
    <div style={{
      padding: '3px 8px', borderRadius: 6,
      background: alert ? 'rgba(255,77,109,.1)' : 'var(--bg-surface)',
      border: `1px solid ${alert ? 'rgba(255,77,109,.3)' : 'var(--border)'}`,
      fontSize: '0.72rem', color: alert ? 'var(--accent-red)' : 'var(--text-secondary)',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function RiskQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const sorted = [...PATIENT_LIST].sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level]);

  const filtered = sorted.filter(p => {
    const matchFilter = filter === 'all' || p.risk_level === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      || p.patient_id.includes(search)
      || p.procedure_type.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    total:    PATIENT_LIST.length,
    critical: PATIENT_LIST.filter(p => p.risk_level === 'critical').length,
    high:     PATIENT_LIST.filter(p => p.risk_level === 'high').length,
    medium:   PATIENT_LIST.filter(p => p.risk_level === 'medium').length,
    low:      PATIENT_LIST.filter(p => p.risk_level === 'low').length,
    escalated:PATIENT_LIST.filter(p => p.escalation_triggered).length,
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Risk Queue</h1>
          <p className="page-sub">{counts.total} patients monitored · {counts.critical + counts.high} require attention</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Search patient, procedure..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: '0.83rem', outline: 'none', width: 240,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Patients', value: counts.total,    color: 'var(--accent-primary)' },
          { label: 'Critical',       value: counts.critical, color: 'var(--accent-red)'     },
          { label: 'High Risk',      value: counts.high,     color: 'var(--accent-amber)'   },
          { label: 'Escalated',      value: counts.escalated,color: 'var(--accent-purple)'  },
        ].map(s => (
          <div key={s.label} className="stat-tile" style={{ cursor: 'default' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: `All (${counts.total})` },
          { key: 'critical', label: `Critical (${counts.critical})` },
          { key: 'high',     label: `High (${counts.high})` },
          { key: 'medium',   label: `Medium (${counts.medium})` },
          { key: 'low',      label: `Low (${counts.low})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
            border: `1px solid ${filter === f.key ? 'rgba(0,229,195,.4)' : 'var(--border)'}`,
            background: filter === f.key ? 'rgba(0,229,195,.1)' : 'transparent',
            color: filter === f.key ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Patient cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const riskColor = p.risk_level === 'critical' ? 'var(--accent-red)'
                          : p.risk_level === 'high'     ? 'var(--accent-amber)'
                          : p.risk_level === 'medium'   ? 'var(--accent-purple)'
                          : 'var(--accent-green)';
          return (
            <div key={p.patient_id}
              onClick={() => navigate(`/patient/${p.patient_id}`)}
              className="card"
              style={{
                cursor: 'pointer', padding: '16px 20px',
                borderColor: p.risk_level === 'critical' ? 'rgba(255,77,109,.3)'
                           : p.risk_level === 'high'     ? 'rgba(255,179,0,.25)'
                           : 'var(--border)',
                transition: 'all .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `${riskColor}18`, border: `2px solid ${riskColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.88rem', color: riskColor,
                }}>
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                {/* Patient info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{p.patient_id}</span>
                    <span className={`risk-badge risk-${p.risk_level === 'high' ? 'high' : p.risk_level === 'critical' ? 'critical' : p.risk_level === 'medium' ? 'medium' : 'low'}`}>
                      {p.risk_level === 'critical' && '● '}{p.risk_level.toUpperCase()}
                    </span>
                    {p.escalation_triggered && (
                      <span className="risk-badge risk-critical" style={{ fontSize: '0.65rem' }}>⚡ ESCALATED</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.procedure_type}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>·</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Day {p.day_post_op}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>·</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.ward}</span>
                  </div>
                  {p.alert && (
                    <div style={{
                      marginTop: 6, fontSize: '0.75rem',
                      color: p.risk_level === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span>⚠</span> {p.alert}
                    </div>
                  )}
                </div>

                {/* Vitals chips */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
                  <VitalChip label="Wound" value={`${p.wound_score}/100`} alert={p.wound_score < 65} />
                  <VitalChip label="Pain"  value={`${p.pcps}/10`}        alert={p.pcps > 6} />
                  <VitalChip label="Temp"  value={`${p.temperature}°C`}  alert={p.temperature > 37.8} />
                  <VitalChip label="HR"    value={`${p.heart_rate}`}     alert={p.heart_rate > 100} />
                </div>

                {/* Risk bar */}
                <div style={{ width: 140, flexShrink: 0 }}>
                  <RiskBar value={p.overall_risk} />
                </div>

                {/* Arrow */}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}>→</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}