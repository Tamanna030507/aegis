import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATIENTS, PATIENT_LIST } from '../data/patients';

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_COLOR = (r) =>
  r >= 0.75 ? '#ff4d6d' : r >= 0.55 ? '#ffb300' : r >= 0.35 ? '#b794f4' : '#68d391';

const RISK_BG = (r) =>
  r >= 0.75 ? 'rgba(255,77,109,0.1)' : r >= 0.55 ? 'rgba(255,179,0,0.1)' : r >= 0.35 ? 'rgba(183,148,244,0.1)' : 'rgba(104,211,145,0.1)';

const TRI_COLOR = (tri) =>
  tri >= 1.3 ? '#ff4d6d' : tri >= 1.1 ? '#ffb300' : '#68d391';

const HEALING_LABEL = {
  class_i_primary:   { label: 'Class I — Primary',  color: '#68d391', icon: '✦' },
  class_ii_moderate: { label: 'Class II — Moderate', color: '#ffb300', icon: '◈' },
  class_iii_complex: { label: 'Class III — Complex', color: '#ff4d6d', icon: '⬡' },
};

// ── Feature 1: Live Passport Verification Terminal ─────────────────────────────
// Animated scan sequence that simulates reading each field off the OR node
function ScanTerminal({ patient, onComplete }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const containerRef = useRef(null);

  const SCAN_SEQUENCE = [
    { delay: 0,    text: `> AEGIS-OR-NODE ${patient.passport.signed_by} — handshake initiated`, color: '#63b3ed' },
    { delay: 320,  text: `> Verifying cryptographic signature...`, color: '#94a3b8' },
    { delay: 680,  text: `> Patient ID: #${patient.patient_id} — MATCHED`, color: '#68d391' },
    { delay: 1000, text: `> Procedure: ${patient.procedure_type}`, color: '#e2e8f0' },
    { delay: 1280, text: `> Robot: ${patient.robot_model}`, color: '#e2e8f0' },
    { delay: 1520, text: `> TRI: ${patient.tissue_resistance_index} — ${patient.tissue_resistance_index >= 1.3 ? 'HIGH COMPLEXITY ⚠' : patient.tissue_resistance_index >= 1.1 ? 'MODERATE' : 'NOMINAL ✓'}`, color: TRI_COLOR(patient.tissue_resistance_index) },
    { delay: 1740, text: `> Suture tension: ${patient.suture_tension_score} N/cm²`, color: '#e2e8f0' },
    { delay: 1940, text: `> Blood loss class: ${patient.blood_loss_class}`, color: '#e2e8f0' },
    { delay: 2140, text: `> Healing class: ${patient.healing_class.replace(/_/g,' ')}`, color: '#e2e8f0' },
    { delay: 2380, text: `> Anomaly flags: ${patient.anomaly_flags.length > 0 ? patient.anomaly_flags.join(', ') + ' ⚠' : 'NONE ✓'}`, color: patient.anomaly_flags.length > 0 ? '#ffb300' : '#68d391' },
    { delay: 2680, text: `> Risk multiplier: ${patient.risk_multiplier}× applied`, color: patient.risk_multiplier > 1.2 ? '#ff4d6d' : '#94a3b8' },
    { delay: 2980, text: `> ─────────────────────────────────`, color: '#2d4a5a' },
    { delay: 3100, text: `> PASSPORT VERIFIED ✓  |  ${new Date().toISOString()}`, color: '#68d391' },
  ];

  useEffect(() => {
    setLines([]);
    setDone(false);
    const timers = SCAN_SEQUENCE.map(({ delay, text, color }) =>
      setTimeout(() => {
        setLines(prev => [...prev, { text, color }]);
        if (containerRef.current) containerRef.current.scrollTop = 9999;
      }, delay)
    );
    const doneTimer = setTimeout(() => { setDone(true); onComplete?.(); }, 3300);
    return () => { timers.forEach(clearTimeout); clearTimeout(doneTimer); };
  }, [patient.patient_id]);

  return (
    <div ref={containerRef} style={{
      background: '#020a10', borderRadius: 10, padding: '14px 16px',
      fontFamily: '"Courier New", monospace', fontSize: '0.76rem',
      maxHeight: 260, overflowY: 'auto', border: '1px solid rgba(0,229,195,0.15)',
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.color, lineHeight: 1.7 }}>{l.text}</div>
      ))}
      {!done && (
        <span style={{ color: '#00e5c3', animation: 'none' }}>█</span>
      )}
    </div>
  );
}

// ── Feature 2: OR Telemetry Fingerprint Radar ──────────────────────────────────
// SVG radar/spider chart of 6 intraoperative metrics per patient
function TelemetryRadar({ patient }) {
  const size = 220;
  const cx = size / 2, cy = size / 2, r = 82;
  const metrics = [
    { label: 'TRI',       raw: patient.tissue_resistance_index,  min: 0.8, max: 1.5 },
    { label: 'Tension',   raw: patient.suture_tension_score,     min: 0,   max: 4   },
    { label: 'Risk ×',    raw: patient.risk_multiplier,          min: 0.8, max: 1.8 },
    { label: 'Wound',     raw: patient.wound_score / 100,        min: 0,   max: 1   },
    { label: 'Pain',      raw: patient.pcps / 10,                min: 0,   max: 1   },
    { label: 'Temp Δ',    raw: (patient.temperature - 36.5) / 2, min: 0,   max: 1   },
  ];

  const normalize = (m) => Math.min(1, Math.max(0, (m.raw - m.min) / (m.max - m.min)));
  const angle = (i) => (Math.PI * 2 * i) / metrics.length - Math.PI / 2;

  const pts = (scale) => metrics.map((m, i) => {
    const a = angle(i);
    const v = typeof scale === 'function' ? scale(m) : scale;
    return [cx + r * v * Math.cos(a), cy + r * v * Math.sin(a)];
  });

  const toPath = (points) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

  const dataPoints = pts(normalize);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const rc = RISK_COLOR(patient.overall_risk);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {/* Grid rings */}
        {gridLevels.map(lv => (
          <polygon key={lv}
            points={pts(() => lv).map(p => p.join(',')).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        ))}
        {/* Axis lines */}
        {metrics.map((_, i) => {
          const a = angle(i);
          return <line key={i} x1={cx} y1={cy}
            x2={(cx + r * Math.cos(a)).toFixed(1)}
            y2={(cy + r * Math.sin(a)).toFixed(1)}
            stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} />;
        })}
        {/* Data polygon */}
        <path d={toPath(dataPoints)}
          fill={`${rc}22`} stroke={rc} strokeWidth={1.5} />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={rc} />
        ))}
        {/* Labels */}
        {metrics.map((m, i) => {
          const a = angle(i);
          const lx = cx + (r + 18) * Math.cos(a);
          const ly = cy + (r + 18) * Math.sin(a);
          return (
            <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="central"
              fontSize={9.5} fill="#94a3b8" fontFamily="Inter" fontWeight={600}>
              {m.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Feature 3: Passport Provenance Chain ──────────────────────────────────────
// Shows the cryptographic chain: OR Node → AEGIS Server → Physician
function ProvenanceChain({ patient }) {
  const steps = [
    {
      icon: '🤖', label: 'OR Telemetry Node',
      sub: patient.passport.signed_by,
      color: '#63b3ed', detail: `Intraoperative data captured. TRI ${patient.tissue_resistance_index}, ${patient.anomaly_flags.length} anomaly flag(s).`,
    },
    {
      icon: '⬡', label: 'AEGIS Core',
      sub: 'Hash validated · Immutable record',
      color: '#00e5c3', detail: `Risk multiplier ${patient.risk_multiplier}× applied. Healing class assigned: ${patient.healing_class.replace(/_/g,' ')}.`,
    },
    {
      icon: '👩‍⚕️', label: patient.surgeon,
      sub: patient.ward,
      color: '#68d391', detail: `Passport issued to attending physician. Cascade model seeded from OR fingerprint.`,
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔗</span> Provenance Chain
        </span>
        <span style={{ fontSize: '0.7rem', color: '#68d391', fontWeight: 600 }}>Cryptographically verified</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div style={{
                position: 'absolute', left: 19, top: 44, width: 2, height: 'calc(100% - 8px)',
                background: `linear-gradient(180deg, ${s.color}40, ${steps[i+1].color}20)`,
                zIndex: 0,
              }} />
            )}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: `${s.color}15`, border: `1.5px solid ${s.color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', position: 'relative', zIndex: 1,
              marginBottom: i < steps.length - 1 ? 0 : 0,
            }}>
              {s.icon}
            </div>
            <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: s.color }}>{s.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.sub}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 8 }}>
                {s.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature 4: Cross-Patient Anomaly Comparison ───────────────────────────────
function AnomalyMatrix() {
  const ALL_FLAGS = [
    'minor_retraction_event',
    'bile_leak_risk',
    'elevated_liver_enzymes',
    'hemodynamic_instability',
    'age_related_healing_delay',
  ];

  const FLAG_LABELS = {
    minor_retraction_event:  { label: 'Minor retraction', color: '#ffb300', icon: '⚡' },
    bile_leak_risk:          { label: 'Bile leak risk',   color: '#ff4d6d', icon: '🔴' },
    elevated_liver_enzymes:  { label: 'Liver enzymes ↑', color: '#ff4d6d', icon: '🔴' },
    hemodynamic_instability: { label: 'Hemodynamic ⚠',   color: '#ff4d6d', icon: '🔴' },
    age_related_healing_delay:{ label: 'Age delay',       color: '#b794f4', icon: '🟣' },
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🧬</span> Anomaly Flag Matrix — All Patients
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OR telemetry anomalies</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr>
              <td style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingBottom: 6, paddingRight: 12, whiteSpace: 'nowrap' }}>Anomaly Flag</td>
              {PATIENT_LIST.map(p => (
                <td key={p.patient_id} style={{ textAlign: 'center', fontSize: '0.68rem', color: RISK_COLOR(p.overall_risk), fontWeight: 700, paddingBottom: 6, minWidth: 70 }}>
                  #{p.patient_id}<br/>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.63rem' }}>{p.name.split(' ')[0]}</span>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_FLAGS.map(flag => {
              const cfg = FLAG_LABELS[flag];
              return (
                <tr key={flag}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingRight: 12, paddingTop: 2, paddingBottom: 2, whiteSpace: 'nowrap' }}>
                    {cfg.icon} {cfg.label}
                  </td>
                  {PATIENT_LIST.map(p => {
                    const has = p.anomaly_flags.includes(flag);
                    return (
                      <td key={p.patient_id} style={{ textAlign: 'center', paddingTop: 2, paddingBottom: 2 }}>
                        <div style={{
                          margin: '0 auto', width: 28, height: 28, borderRadius: 6,
                          background: has ? `${cfg.color}22` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${has ? cfg.color + '50' : 'transparent'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: has ? '0.8rem' : '0.6rem',
                          color: has ? cfg.color : 'rgba(255,255,255,0.1)',
                        }}>
                          {has ? '✓' : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* TRI comparison */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Tissue Resistance Index — all patients
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...PATIENT_LIST].sort((a, b) => b.tissue_resistance_index - a.tissue_resistance_index).map(p => (
            <div key={p.patient_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 100 }}>#{p.patient_id} {p.name.split(' ')[0]}</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
                <div style={{
                  width: `${((p.tissue_resistance_index - 0.9) / 0.6) * 100}%`,
                  height: '100%', borderRadius: 3,
                  background: TRI_COLOR(p.tissue_resistance_index),
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: TRI_COLOR(p.tissue_resistance_index), minWidth: 36, textAlign: 'right' }}>
                {p.tissue_resistance_index}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Feature 5: Healing Class Intelligence Briefing ────────────────────────────
function HealingClassBriefing({ patient }) {
  const hc = patient.healing_class;
  const config = HEALING_LABEL[hc] || HEALING_LABEL['class_ii_moderate'];

  const EXPECTATIONS = {
    class_i_primary: {
      desc: 'Clean wound with primary closure. Minimal inflammation expected. Standard analgesia sufficient.',
      milestones: [
        { day: 1, event: 'Wound sealed — primary intention', done: patient.day_post_op >= 1 },
        { day: 3, event: 'Inflammation peak — monitor temp', done: patient.day_post_op >= 3 },
        { day: 5, event: 'Re-epithelialisation begins', done: patient.day_post_op >= 5 },
        { day: 14, event: 'Full closure expected', done: patient.day_post_op >= 14 },
      ],
    },
    class_ii_moderate: {
      desc: 'Moderate procedural complexity. Some contamination risk. Enhanced monitoring protocol.',
      milestones: [
        { day: 1, event: 'Post-op baseline established', done: patient.day_post_op >= 1 },
        { day: 3, event: 'First wound inspection', done: patient.day_post_op >= 3 },
        { day: 7, event: 'Suture tension reassessment', done: patient.day_post_op >= 7 },
        { day: 21, event: 'Full tissue remodelling', done: patient.day_post_op >= 21 },
      ],
    },
    class_iii_complex: {
      desc: 'Major resection with high contamination risk. ICU monitoring required. Cascade risk elevated.',
      milestones: [
        { day: 1, event: 'Hemodynamic stabilisation target', done: patient.day_post_op >= 1 },
        { day: 2, event: 'Drain output assessment', done: patient.day_post_op >= 2 },
        { day: 3, event: 'Bile/fluid leak screening', done: patient.day_post_op >= 3 },
        { day: 7, event: 'ICU step-down evaluation', done: patient.day_post_op >= 7 },
      ],
    },
  };

  const exp = EXPECTATIONS[hc] || EXPECTATIONS['class_ii_moderate'];

  // Similar patients (same healing class)
  const similar = PATIENT_LIST.filter(p => p.healing_class === hc && p.patient_id !== patient.patient_id);

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: `${config.color}25` }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{config.icon}</span> Healing Class Intelligence
        </span>
        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: config.color }}>{config.label}</span>
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        {exp.desc}
      </p>

      {/* Milestone timeline */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Recovery milestones
        </div>
        <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
          {/* Progress track */}
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
          <div style={{
            position: 'absolute', top: 12, left: 12, height: 2,
            width: `${Math.min(100, (patient.day_post_op / exp.milestones[exp.milestones.length - 1].day) * 100)}%`,
            background: config.color, borderRadius: 1, transition: 'width 1s ease',
          }} />
          {exp.milestones.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', border: `2px solid ${m.done ? config.color : 'rgba(255,255,255,0.1)'}`,
                background: m.done ? `${config.color}20` : 'var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 800,
                color: m.done ? config.color : 'rgba(255,255,255,0.15)',
                position: 'relative', zIndex: 1,
              }}>
                {m.done ? '✓' : m.day}
              </div>
              <div style={{ textAlign: 'center', maxWidth: 80 }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>D{m.day}</div>
                <div style={{ fontSize: '0.63rem', color: m.done ? 'var(--text-secondary)' : 'rgba(255,255,255,0.2)', lineHeight: 1.3, textAlign: 'center' }}>
                  {m.event}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Similar patients */}
      {similar.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Same healing class — other patients
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {similar.map(p => (
              <div key={p.patient_id} style={{
                padding: '6px 12px', borderRadius: 8, background: 'var(--bg-surface)',
                border: '1px solid var(--border)', fontSize: '0.75rem',
              }}>
                <span style={{ color: RISK_COLOR(p.overall_risk), fontWeight: 700 }}>#{p.patient_id} {p.name.split(' ')[0]}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>D{p.day_post_op} · {Math.round(p.overall_risk * 100)}% risk</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main PassportScanner Page ─────────────────────────────────────────────────
export default function PassportScanner() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [scanDone, setScanDone]   = useState(false);
  const [hashInput, setHashInput] = useState('');

  const patient = selectedId ? PATIENTS[String(selectedId)] : null;

  const handleScan = (id) => {
    setSelectedId(id);
    setScanning(true);
    setScanDone(false);
  };

  const handleManualScan = () => {
    // Map hash input to a patient, or default to 58 (critical)
    const found = PATIENT_LIST.find(p =>
      hashInput.includes(p.patient_id) || hashInput.includes(p.name.split(' ')[0].toLowerCase())
    );
    handleScan(found ? found.patient_id : '58');
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Surgical Passport Scanner</h1>
        <p className="page-sub">
          OR telemetry fingerprint · Cryptographic patient identity · Full provenance chain
        </p>
      </div>

      {/* Manual hash input */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Scan Passport Hash</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" placeholder="Paste passport fingerprint hash…"
            value={hashInput} onChange={e => setHashInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualScan()} />
          <button className="btn btn-primary" onClick={handleManualScan}>🔍 Scan</button>
        </div>
      </div>

      {/* ── Feature 1: Quick-Select patient passports ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🪪</span> Patient Passports — Select to Verify
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>5 active passports on node</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PATIENT_LIST.map(p => {
            const rc = RISK_COLOR(p.overall_risk);
            const hcfg = HEALING_LABEL[p.healing_class] || HEALING_LABEL['class_ii_moderate'];
            const isActive = String(p.patient_id) === String(selectedId);
            return (
              <div key={p.patient_id}
                onClick={() => handleScan(p.patient_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                  borderRadius: 10, cursor: 'pointer',
                  background: isActive ? RISK_BG(p.overall_risk) : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? rc + '50' : 'var(--border)'}`,
                  transition: 'all .18s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = rc + '30'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: `${rc}18`, border: `2px solid ${rc}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.82rem', color: rc,
                }}>
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>#{p.patient_id}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: `${rc}15`, color: rc, border: `1px solid ${rc}30`,
                    }}>{p.risk_level.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                    {p.procedure_type} · {p.robot_model} · <span style={{ color: hcfg.color }}>{hcfg.label}</span>
                  </div>
                </div>

                {/* Node badge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {p.passport.signed_by.replace('AEGIS-OR-NODE-', '')}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#68d391', fontWeight: 600, marginTop: 2 }}>● Verified</div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Passport detail panel (shown after selection) ── */}
      {patient && scanning && (
        <>
          {/* Feature 1: Scan Terminal */}
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(0,229,195,0.2)' }}>
            <div className="card-header">
              <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💻</span> Live Verification Terminal
              </span>
              <span style={{ fontSize: '0.7rem', color: '#00e5c3', fontFamily: 'monospace' }}>
                {patient.passport.signed_by}
              </span>
            </div>
            <ScanTerminal patient={patient} onComplete={() => setScanDone(true)} />
          </div>

          {/* Verified badge */}
          {scanDone && (
            <div className="card slide-right" style={{ marginBottom: 20, borderColor: 'rgba(104,211,145,0.4)', background: 'rgba(104,211,145,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: '1rem', color: '#68d391', marginBottom: 2 }}>
                    Passport Verified — {patient.name}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Signed by {patient.passport.signed_by} · {patient.procedure_date} · {patient.healing_class.replace(/_/g,' ')}
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/patient/${patient.patient_id}`)}>
                  View Patient →
                </button>
              </div>
            </div>
          )}

          {scanDone && (
            <>
              {/* Passport data grid */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <span style={{ fontWeight: 700 }}>Passport Fields</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Immutable OR record</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { k: 'Patient ID',       v: `#${patient.patient_id}` },
                    { k: 'Procedure',        v: patient.procedure_type },
                    { k: 'Date',             v: patient.procedure_date },
                    { k: 'Robot / System',   v: patient.robot_model },
                    { k: 'TRI',              v: `${patient.tissue_resistance_index} (+${((patient.tissue_resistance_index - 1) * 100).toFixed(0)}%)`, alert: patient.tissue_resistance_index > 1.2 },
                    { k: 'Suture Tension',   v: `${patient.suture_tension_score} N/cm²`, alert: patient.suture_tension_score > 3 },
                    { k: 'Blood Loss',       v: patient.blood_loss_class },
                    { k: 'Healing Class',    v: patient.healing_class.replace(/_/g,' ') },
                    { k: 'Risk Multiplier',  v: `${patient.risk_multiplier}×`, alert: patient.risk_multiplier > 1.3 },
                    { k: 'Anomaly Flags',    v: patient.anomaly_flags.join(', ') || 'None', alert: patient.anomaly_flags.length > 0 },
                  ].map(({ k, v, alert }) => (
                    <div key={k} style={{
                      background: alert ? 'rgba(255,179,0,0.06)' : 'var(--bg-surface)',
                      padding: 12, borderRadius: 10,
                      border: alert ? '1px solid rgba(255,179,0,0.2)' : 'none',
                    }}>
                      <div className="stat-label">{k}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 4, textTransform: 'capitalize', color: alert ? '#ffb300' : 'var(--text-primary)' }}>
                        {v || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature 2: Telemetry Radar */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📡</span> OR Telemetry Fingerprint Radar
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>6-axis intraoperative profile</span>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TelemetryRadar patient={patient} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    {[
                      { label: 'Tissue Resistance', value: patient.tissue_resistance_index, max: 1.5, color: TRI_COLOR(patient.tissue_resistance_index), suffix: '' },
                      { label: 'Suture Tension',    value: patient.suture_tension_score,    max: 4,   color: patient.suture_tension_score > 3 ? '#ff4d6d' : '#68d391', suffix: ' N/cm²' },
                      { label: 'Risk Multiplier',   value: patient.risk_multiplier,          max: 1.8, color: patient.risk_multiplier > 1.3 ? '#ff4d6d' : '#ffb300', suffix: '×' },
                    ].map(m => (
                      <div key={m.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                          <span style={{ color: m.color, fontWeight: 700 }}>{m.value}{m.suffix}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                          <div style={{ width: `${(m.value / m.max) * 100}%`, height: '100%', background: m.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature 3: Provenance Chain */}
              <ProvenanceChain patient={patient} />

              {/* Feature 5: Healing Class Intelligence */}
              <HealingClassBriefing patient={patient} />
            </>
          )}
        </>
      )}

      {/* Feature 4: Anomaly Matrix — always visible */}
      <AnomalyMatrix />
    </div>
  );
}