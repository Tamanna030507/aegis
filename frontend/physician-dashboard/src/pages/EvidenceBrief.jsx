import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PATIENTS, PATIENT_LIST } from '../data/patients';

const RISK_COLOR = (level) => ({
  critical: 'var(--accent-red)',
  high:     'var(--accent-amber)',
  medium:   '#b794f4',
  low:      'var(--accent-green)',
})[level] || 'var(--accent-primary)';

const URGENCY_COLOR = {
  immediate: 'var(--accent-red)',
  urgent:    'var(--accent-amber)',
  monitor:   'var(--accent-green)',
};

// ── 1. Patient Selector (matching CascadeGraph style) ─────────────────────────
function PatientSelector({ activeId, onSelect }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20,
      padding: '14px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', alignSelf: 'center', marginRight: 4 }}>Patient</span>
      {PATIENT_LIST.map(p => {
        const active = String(p.patient_id) === String(activeId);
        const rc = RISK_COLOR(p.risk_level);
        return (
          <button key={p.patient_id} onClick={() => onSelect(p.patient_id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
              border: `1px solid ${active ? rc : 'var(--border)'}`,
              background: active ? `${rc === 'var(--accent-red)' ? 'rgba(255,77,109,0.12)' : rc === 'var(--accent-amber)' ? 'rgba(255,179,0,0.12)' : rc === '#b794f4' ? 'rgba(183,148,244,0.12)' : 'rgba(104,211,145,0.12)'}` : 'transparent',
              color: active ? rc : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: rc === 'var(--accent-red)' ? '#ff4d6d' : rc === 'var(--accent-amber)' ? '#ffb300' : rc === '#b794f4' ? '#b794f4' : '#68d391',
              display: 'inline-block',
            }} />
            #{p.patient_id} {p.name.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}

// ── 2. Signal Severity Matrix ─────────────────────────────────────────────────
function SignalSeverityMatrix({ patient }) {
  const signals = patient.why_now;
  const critical = signals.filter(s => s.level === 'critical');
  const warning  = signals.filter(s => s.level === 'warning');
  const info     = signals.filter(s => s.level === 'info');

  const LEVEL_CONFIG = {
    critical: { color: '#ff4d6d', bg: 'rgba(255,77,109,0.07)', border: 'rgba(255,77,109,0.2)', icon: '🔴', label: 'Critical', weight: 3 },
    warning:  { color: '#ffb300', bg: 'rgba(255,179,0,0.07)',  border: 'rgba(255,179,0,0.2)',  icon: '🟡', label: 'Warning',  weight: 2 },
    info:     { color: '#63b3ed', bg: 'rgba(99,179,237,0.07)', border: 'rgba(99,179,237,0.2)', icon: '🔵', label: 'Info',     weight: 1 },
  };

  const totalWeight = critical.length * 3 + warning.length * 2 + info.length;
  const maxWeight = signals.length * 3;
  const severityScore = maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🧮</span> Signal Severity Matrix
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[
            { count: critical.length, ...LEVEL_CONFIG.critical },
            { count: warning.length,  ...LEVEL_CONFIG.warning  },
            { count: info.length,     ...LEVEL_CONFIG.info      },
          ].map(s => s.count > 0 && (
            <span key={s.label} style={{ fontSize: '0.72rem', color: s.color, fontWeight: 700 }}>
              {s.icon} {s.count} {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Severity bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>Composite severity score</span>
          <span style={{ fontWeight: 700, color: severityScore > 66 ? '#ff4d6d' : severityScore > 33 ? '#ffb300' : '#68d391' }}>
            {severityScore}/100
          </span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.8s ease',
            width: `${severityScore}%`,
            background: severityScore > 66
              ? 'linear-gradient(90deg, #ffb300, #ff4d6d)'
              : severityScore > 33
              ? 'linear-gradient(90deg, #68d391, #ffb300)'
              : '#68d391',
          }} />
        </div>
      </div>

      {/* Signals by level */}
      {[
        { items: critical, ...LEVEL_CONFIG.critical },
        { items: warning,  ...LEVEL_CONFIG.warning  },
        { items: info,     ...LEVEL_CONFIG.info      },
      ].filter(g => g.items.length > 0).map(group => (
        <div key={group.label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            {group.icon} {group.label} ({group.items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.items.map((s, i) => (
              <div key={i} style={{
                padding: '9px 12px', borderRadius: 8,
                background: group.bg, border: `1px solid ${group.border}`,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>{group.icon}</span>
                <span style={{ fontSize: '0.83rem', color: group.color, lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 3. Recommended Action Timeline ────────────────────────────────────────────
function ActionTimeline({ patient }) {
  const brief = patient.evidence_brief;
  const signals = patient.why_now;

  // Build timeline from signals + recommended action
  const timelineItems = [
    {
      time: 'Immediate',
      label: brief.urgency === 'immediate' ? 'CRITICAL — Act now' : brief.urgency === 'urgent' ? 'Within 6 hours' : 'Monitor',
      color: URGENCY_COLOR[brief.urgency],
      content: brief.recommended_action,
      icon: brief.urgency === 'immediate' ? '🚨' : brief.urgency === 'urgent' ? '⚡' : '📋',
    },
    ...signals.filter(s => s.level === 'critical').map((s, i) => ({
      time: `Signal ${i + 1}`,
      label: 'Critical finding',
      color: '#ff4d6d',
      content: s.text,
      icon: '🔴',
    })),
    {
      time: 'Day ' + (patient.day_post_op + 1),
      label: 'Cascade window',
      color: '#b794f4',
      content: patient.cascade.summary,
      icon: '🧬',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⏱</span> Recommended Action Timeline
        </span>
        <span className={`risk-badge risk-${brief.urgency === 'immediate' ? 'critical' : brief.urgency === 'urgent' ? 'high' : 'low'}`}>
          {brief.urgency?.toUpperCase()}
        </span>
      </div>

      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 9, top: 8, bottom: 8, width: 2,
          background: 'rgba(255,255,255,0.06)', borderRadius: 1,
        }} />

        {timelineItems.map((item, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: i < timelineItems.length - 1 ? 16 : 0 }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -22, top: 12, width: 10, height: 10,
              borderRadius: '50%', background: item.color,
              boxShadow: `0 0 8px ${item.color}60`,
            }} />

            <div style={{
              padding: '11px 14px', borderRadius: 10,
              background: `${i === 0 ? URGENCY_COLOR[patient.evidence_brief.urgency] === 'var(--accent-red)' ? 'rgba(255,77,109,0.06)' : URGENCY_COLOR[patient.evidence_brief.urgency] === 'var(--accent-amber)' ? 'rgba(255,179,0,0.06)' : 'rgba(104,211,145,0.06)' : 'var(--bg-surface)'}`,
              border: i === 0 ? `1px solid ${item.color}30` : '1px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.icon} {item.time}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
              <p style={{ fontSize: '0.83rem', color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontWeight: i === 0 ? 600 : 400 }}>
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Key Signal Cards ────────────────────────────────────────────────────────
function KeySignalCards({ patient }) {
  const brief = patient.evidence_brief;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔎</span> Key Signals
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{brief.key_signals?.length} signals detected</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {brief.key_signals?.map((s, i) => {
          const isCritical = i === 0;
          return (
            <div key={i} style={{
              display: 'flex', gap: 12, padding: '11px 14px',
              background: isCritical ? 'rgba(255,77,109,0.06)' : 'var(--bg-surface)',
              borderRadius: 10,
              border: isCritical ? '1px solid rgba(255,77,109,0.2)' : '1px solid transparent',
              alignItems: 'flex-start',
            }}>
              <span style={{
                minWidth: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCritical ? 'rgba(255,77,109,0.15)' : 'rgba(255,255,255,0.06)',
                color: isCritical ? '#ff4d6d' : '#94a3b8',
                fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: '0.86rem', color: isCritical ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 5. Multi-Patient Brief Comparison ─────────────────────────────────────────
function MultiPatientComparison({ activeId }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...PATIENT_LIST].sort((a, b) => b.overall_risk - a.overall_risk);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📑</span> All Patient Briefs
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{expanded ? '▲ Collapse' : '▼ Expand all 5 briefs'}</span>
      </div>

      {/* Always-visible summary row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sorted.map(p => {
          const isActive = String(p.patient_id) === String(activeId);
          const rc = p.risk_level === 'critical' ? '#ff4d6d' : p.risk_level === 'high' ? '#ffb300' : p.risk_level === 'medium' ? '#b794f4' : '#68d391';
          return (
            <div key={p.patient_id} style={{
              flex: '1 1 160px', padding: '10px 12px', borderRadius: 10,
              background: isActive ? `${rc}12` : 'var(--bg-surface)',
              border: `1px solid ${isActive ? rc + '40' : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: rc, marginBottom: 2 }}>
                #{p.patient_id} — {p.risk_level.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Day {p.day_post_op} · {Math.round(p.overall_risk * 100)}% risk</div>
            </div>
          );
        })}
      </div>

      {/* Expanded: show recommended action for each */}
      {expanded && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(p => {
            const rc = p.risk_level === 'critical' ? '#ff4d6d' : p.risk_level === 'high' ? '#ffb300' : p.risk_level === 'medium' ? '#b794f4' : '#68d391';
            return (
              <div key={p.patient_id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-surface)', borderLeft: `3px solid ${rc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: rc }}>
                    #{p.patient_id} {p.name} — {p.evidence_brief.urgency?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.procedure_type}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {p.evidence_brief.recommended_action}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 6. WhatsApp Preview ────────────────────────────────────────────────────────
function WhatsAppPreview({ patient, alertSent, onSend }) {
  const brief = patient.evidence_brief;
  return (
    <div className="card" style={{ marginBottom: 20, background: 'var(--bg-surface)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📱</span> WhatsApp Alert Preview
        </span>
        <button
          onClick={onSend}
          style={{
            padding: '5px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
            border: alertSent ? '1px solid rgba(104,211,145,0.4)' : '1px solid rgba(255,77,109,0.4)',
            background: alertSent ? 'rgba(104,211,145,0.1)' : 'rgba(255,77,109,0.1)',
            color: alertSent ? '#68d391' : '#ff4d6d',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {alertSent ? '✓ Sent to Dr. ' + patient.surgeon.split(' ').pop() : '⚡ Send Alert'}
        </button>
      </div>

      {/* Chat bubble */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
        {/* Outgoing */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            maxWidth: '80%', padding: '10px 14px', borderRadius: '14px 14px 2px 14px',
            background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.2)',
            fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5,
          }}>
            {brief.whatsapp_message}
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
              {alertSent ? '✓✓ Read · Just now' : 'AEGIS Dashboard'}
            </div>
          </div>
        </div>

        {/* Surgeon info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,179,237,0.15)',
            border: '1px solid rgba(99,179,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, color: '#63b3ed',
          }}>
            {patient.surgeon.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{patient.surgeon}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Attending — {patient.ward.split('—')[0].trim()}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.68rem', color: alertSent ? '#68d391' : 'var(--text-muted)' }}>
            {alertSent ? '● Online · Notified' : '○ Pending'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main EvidenceBrief Page ───────────────────────────────────────────────────
export default function EvidenceBrief() {
  const { id } = useParams();
  const navigate = useNavigate();

  const defaultId = id || PATIENT_LIST.sort((a, b) => b.overall_risk - a.overall_risk)[0].patient_id;
  const [activeId, setActiveId] = useState(defaultId);
  const [alertSent, setAlertSent] = useState(false);
  const [generating, setGenerating] = useState(false);

  const patient = PATIENTS[String(activeId)] || PATIENTS['58'];
  const brief = patient.evidence_brief;

  // Reset alert state when patient changes
  useEffect(() => { setAlertSent(false); }, [activeId]);

  const handleSelect = (newId) => {
    setActiveId(newId);
    navigate(`/brief/${newId}`, { replace: true });
  };

  const handleSendAlert = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 900));
    setAlertSent(true);
    setGenerating(false);
  };

  const urgencyColor = URGENCY_COLOR[brief.urgency] || 'var(--accent-primary)';
  const riskBadgeClass = brief.urgency === 'immediate' ? 'critical' : brief.urgency === 'urgent' ? 'high' : 'low';

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Evidence Brief</h1>
          <p className="page-sub">
            {patient.name} · #{patient.patient_id} · Day {patient.day_post_op} · {patient.procedure_type}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/cascade/${activeId}`)}>🧬 Cascade →</button>
          <button className="btn btn-danger" onClick={handleSendAlert} disabled={generating || alertSent}>
            {generating ? '⟳ Generating...' : alertSent ? '✓ Alert Sent' : '⚡ Escalate + Alert Physician'}
          </button>
        </div>
      </div>

      {/* Alert confirmation */}
      {alertSent && (
        <div className="card slide-right" style={{ marginBottom: 16, borderColor: 'rgba(104,211,145,0.4)', background: 'rgba(104,211,145,0.05)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
              WhatsApp alert sent to {patient.surgeon} — response pending
            </span>
          </div>
        </div>
      )}

      {/* Feature 1: Patient Selector */}
      <PatientSelector activeId={activeId} onSelect={handleSelect} />

      {/* Brief header card */}
      <div className="card" style={{ marginBottom: 16, borderColor: `${urgencyColor}30` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>
            {brief.urgency === 'immediate' ? '🚨' : brief.urgency === 'urgent' ? '⚠️' : '📋'}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: '1.05rem', color: urgencyColor, marginBottom: 6 }}>{brief.title}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`risk-badge risk-${riskBadgeClass}`}>{brief.urgency?.toUpperCase()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                {patient.procedure_type} · {patient.ward}
              </span>
            </div>
          </div>

          {/* Risk score large */}
          <div style={{
            textAlign: 'center', flexShrink: 0,
            padding: '10px 18px', borderRadius: 12,
            background: `${urgencyColor}10`, border: `1px solid ${urgencyColor}30`,
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: urgencyColor, lineHeight: 1 }}>
              {Math.round(patient.overall_risk * 100)}%
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>Risk Score</div>
          </div>
        </div>

        <div className="divider" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7, marginTop: 12 }}>
          {brief.risk_summary}
        </p>
      </div>

      {/* Feature 2: Signal Severity Matrix */}
      <SignalSeverityMatrix patient={patient} />

      {/* Feature 3: Key Signal Cards */}
      <KeySignalCards patient={patient} />

      {/* Feature 4: Action Timeline */}
      <ActionTimeline patient={patient} />

      {/* Feature 5: WhatsApp Preview */}
      <WhatsAppPreview patient={patient} alertSent={alertSent} onSend={handleSendAlert} />

      {/* Feature 6: Multi-patient comparison */}
      <MultiPatientComparison activeId={activeId} />
    </div>
  );
}