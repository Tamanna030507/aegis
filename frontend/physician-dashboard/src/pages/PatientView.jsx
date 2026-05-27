import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Bar } from 'recharts';
import { getPatient } from '../data/patients';
import { api } from '../services/api';

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,12,22,0.95)',
  border: '1px solid rgba(0,229,195,0.2)',
  borderRadius: 10, color: '#e2e8f0', fontSize: '0.82rem',
};

const HEALING_CURVES = {
  class_i_primary:   (day) => Math.max(65, Math.round(98 - day * 1.8)),
  class_ii_moderate: (day) => Math.max(52, Math.round(95 - day * 3.0)),
  class_iii_complex: (day) => Math.max(38, Math.round(90 - day * 4.5)),
};

const LEVEL_COLOR = { critical: '#ff4d6d', warning: '#ffb300', info: 'var(--accent-primary)' };
const LEVEL_ICON  = { critical: '🔴', warning: '🟡', info: '🔵' };

// ── Why Now Panel ─────────────────────────────────────────────────────────────
function WhyNow({ signals }) {
  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(255,179,0,.2)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1rem' }}>⚡</span> Why Now? — Clinical Evidence Stack
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live · Auto-updated</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {signals.map((s, i) => (
          <div key={i} style={{
            padding: '10px 14px', borderRadius: 10,
            background: s.level === 'critical' ? 'rgba(255,77,109,.07)'
                      : s.level === 'warning'  ? 'rgba(255,179,0,.07)'
                      : 'rgba(0,229,195,.05)',
            border: `1px solid ${s.level === 'critical' ? 'rgba(255,77,109,.25)'
                               : s.level === 'warning'  ? 'rgba(255,179,0,.2)'
                               : 'rgba(0,229,195,.15)'}`,
            display: 'flex', alignItems: 'flex-start', gap: 10,
            animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
          }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>{LEVEL_ICON[s.level]}</span>
            <span style={{ fontSize: '0.85rem', color: LEVEL_COLOR[s.level], lineHeight: 1.5 }}>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recovery GPS ──────────────────────────────────────────────────────────────
function RecoveryGPS({ patient }) {
  const curve = HEALING_CURVES[patient.healing_class] || HEALING_CURVES['class_ii_moderate'];
  const day = patient.day_post_op;
  const actual = patient.wound_score;
  const expected = curve(day);
  const delta = actual - expected;
  const ahead = delta >= 0;

  // Build path data: past actual + expected future
  const maxDay = Math.max(day + 7, 14);
  const pathData = Array.from({ length: maxDay }, (_, i) => ({
    day: i + 1,
    expected: curve(i + 1),
    actual: i < day ? (patient.wound_history[i]?.wound_score || null) : null,
    forecast: i >= day - 1 ? curve(i + 1) + (delta * Math.max(0, 1 - (i - day + 1) * 0.15)) : null,
  }));

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: ahead ? 'rgba(104,211,145,.25)' : 'rgba(255,179,0,.25)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🗺</span> Recovery GPS
        </span>
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
          background: ahead ? 'rgba(104,211,145,.12)' : 'rgba(255,179,0,.12)',
          border: `1px solid ${ahead ? 'rgba(104,211,145,.3)' : 'rgba(255,179,0,.3)'}`,
          color: ahead ? 'var(--accent-green)' : 'var(--accent-amber)',
        }}>
          📍 You are here · {ahead ? `${Math.abs(delta)} pts ahead` : `${Math.abs(delta)} pts behind`} of average
        </div>
      </div>

      {/* Progress indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Surgery</span>
            <span style={{ color: ahead ? 'var(--accent-green)' : 'var(--accent-amber)', fontWeight: 700 }}>📍 Day {day}</span>
            <span>Full Recovery</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'visible', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min((day / 30) * 100, 100)}%`,
              background: `linear-gradient(90deg, ${ahead ? '#68d391' : '#ffb300'}, ${ahead ? '#00e5c3' : '#ff9f43'})`,
              borderRadius: 4, transition: 'width 1s ease',
            }} />
            {/* You are here pin */}
            <div style={{
              position: 'absolute',
              left: `calc(${Math.min((day / 30) * 100, 98)}% - 6px)`,
              top: -6, width: 20, height: 20,
              background: ahead ? 'var(--accent-green)' : 'var(--accent-amber)',
              borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
              border: '2px solid var(--bg-card)', boxShadow: `0 0 12px ${ahead ? 'rgba(104,211,145,.5)' : 'rgba(255,179,0,.5)'}`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>Day 0</span><span>Day 15</span><span>Day 30</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={pathData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,195,.06)" />
          <XAxis dataKey="day" tick={{ fill: '#4a7a9b', fontSize: 10 }} label={{ value: 'Day post-op', position: 'insideBottom', offset: -2, fill: '#4a7a9b', fontSize: 10 }} />
          <YAxis domain={[30, 100]} tick={{ fill: '#4a7a9b', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine x={day} stroke="rgba(0,229,195,.4)" strokeDasharray="4 4" label={{ value: 'Today', fill: 'var(--accent-primary)', fontSize: 10 }} />
          <Line type="monotone" dataKey="expected" stroke="rgba(0,229,195,.25)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Average Recovery" />
          <Line type="monotone" dataKey="actual"   stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ fill: 'var(--accent-primary)', r: 4 }} name="Actual Score" connectNulls={false} />
          <Line type="monotone" dataKey="forecast" stroke={ahead ? '#68d391' : '#ffb300'} strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Forecast" connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── What-If Simulator ─────────────────────────────────────────────────────────
function WhatIfSimulator({ patient }) {
  const [painDelta, setPainDelta]    = useState(0);
  const [woundDelta, setWoundDelta]  = useState(0);
  const [tempDelta, setTempDelta]    = useState(0);

  const baseRisk = patient.overall_risk;
  const simRisk = Math.min(0.99, Math.max(0.01,
    baseRisk + (painDelta * 0.04) + (woundDelta * -0.015) + (tempDelta * 0.12)
  ));
  const riskDelta = simRisk - baseRisk;
  const riskPct = Math.round(simRisk * 100);
  const riskColor = simRisk >= 0.75 ? '#ff4d6d' : simRisk >= 0.55 ? '#ffb300' : '#68d391';

  // 12h forecast bars
  const forecastHours = [2, 4, 6, 8, 10, 12].map(h => ({
    hour: `+${h}h`,
    risk: Math.min(0.99, Math.max(0.01, simRisk + (h * 0.004 * Math.sign(riskDelta || 0.001)))),
  }));

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(99,179,237,.2)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🧪</span> What-If Risk Simulator
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 600 }}>Adjust parameters to simulate</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Sliders */}
        <div>
          {[
            { label: 'Pain score change', value: painDelta,   setter: setPainDelta,   min: -5, max: 5,   step: 0.5,  unit: ' pts', color: '#ff4d6d' },
            { label: 'Wound score change',value: woundDelta,  setter: setWoundDelta,  min: -20, max: 20, step: 1,    unit: ' pts', color: 'var(--accent-primary)' },
            { label: 'Temperature change', value: tempDelta,  setter: setTempDelta,   min: -1, max: 2,   step: 0.1,  unit: '°C',   color: '#ffb300' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>
                  {s.value >= 0 ? '+' : ''}{s.value.toFixed(1)}{s.unit}
                </span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step}
                value={s.value} onChange={e => s.setter(parseFloat(e.target.value))}
                style={{ accentColor: s.color }} />
            </div>
          ))}
          <button
            onClick={() => { setPainDelta(0); setWoundDelta(0); setTempDelta(0); }}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >Reset</button>
        </div>

        {/* Simulated risk gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Simulated Risk</div>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            border: `6px solid ${riskColor}`,
            boxShadow: `0 0 30px ${riskColor}40`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: `${riskColor}10`,
            transition: 'all .3s ease',
          }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: riskColor, lineHeight: 1 }}>{riskPct}%</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>risk score</span>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.78rem', fontWeight: 600,
            color: riskDelta > 0.05 ? '#ff4d6d' : riskDelta < -0.05 ? '#68d391' : 'var(--text-muted)',
          }}>
            {riskDelta > 0.005 ? `↑ +${(riskDelta * 100).toFixed(0)}% from baseline`
           : riskDelta < -0.005 ? `↓ ${(riskDelta * 100).toFixed(0)}% from baseline`
           : '= Baseline unchanged'}
          </div>
        </div>
      </div>

      {/* 12h forecast */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>12-Hour Risk Forecast</div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={forecastHours} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,195,.06)" />
            <XAxis dataKey="hour" tick={{ fill: '#4a7a9b', fontSize: 9 }} />
            <YAxis domain={[0, 1]} tick={{ fill: '#4a7a9b', fontSize: 9 }} tickFormatter={v => `${Math.round(v * 100)}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${Math.round(v * 100)}%`, 'Risk']} />
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={riskColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={riskColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="risk" stroke={riskColor} strokeWidth={2} fill="url(#riskGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main PatientView ──────────────────────────────────────────────────────────
export default function PatientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = getPatient(id);

  const [escalating, setEscalating]   = useState(false);
  const [escalateResult, setEscalateResult] = useState(null);
  const [activeTab, setActiveTab]     = useState('overview');

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      const res = await api.escalate(id);
      setEscalateResult(res.brief);
    } catch {
      setEscalateResult(patient.evidence_brief);
    }
    setEscalating(false);
  };

  const riskColor = patient.overall_risk >= 0.75 ? 'var(--accent-red)'
                  : patient.overall_risk >= 0.55 ? 'var(--accent-amber)'
                  : 'var(--accent-green)';

  const twinCurve = HEALING_CURVES[patient.healing_class] || HEALING_CURVES['class_ii_moderate'];

  const chartData = patient.wound_history.map(w => ({
    day: `D${w.day}`,
    'Wound Score':     w.wound_score,
    'Expected Twin':   twinCurve(w.day),
    'Pain (×10)':      Math.round(w.pcps * 10),
    'Heart Rate':      w.hr,
    'Temperature (×10)': Math.round(w.temp * 10),
  }));

  const TABS = ['overview', 'why now', 'recovery gps', 'what-if', 'biomarkers'];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Queue</button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ marginBottom: 2 }}>{patient.name}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Patient #{patient.patient_id} · Day {patient.day_post_op} post-op ·{' '}
            <span style={{ color: riskColor, fontWeight: 700 }}>{patient.risk_level.toUpperCase()} RISK</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · {patient.ward}</span>
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/cascade/${id}`)}>🧬 Cascade</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/brief/${id}`)}>📋 Brief</button>
        <button className="btn btn-danger btn-sm" onClick={handleEscalate} disabled={escalating}>
          {escalating ? '⟳ Escalating...' : '⚡ Escalate'}
        </button>
      </div>

      {/* Escalation result */}
      {escalateResult && (
        <div className="card slide-right" style={{ marginBottom: 16, borderColor: 'rgba(252,129,129,0.4)', background: 'rgba(252,129,129,0.05)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: 2 }}>{escalateResult.title}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WhatsApp alert sent. Urgency: {escalateResult.urgency}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Overall Risk',  value: `${Math.round(patient.overall_risk * 100)}%`, color: riskColor },
          { label: 'Wound Score',   value: `${patient.wound_score}/100`,                  color: patient.wound_score < 65 ? 'var(--accent-red)' : 'var(--accent-green)' },
          { label: 'Pain PCPS',     value: `${patient.pcps}/10`,                          color: patient.pcps > 6 ? 'var(--accent-red)' : 'var(--accent-amber)' },
          { label: 'Temperature',   value: `${patient.temperature}°C`,                    color: patient.temperature > 37.8 ? 'var(--accent-amber)' : 'var(--accent-green)' },
        ].map(s => (
          <div key={s.label} className="stat-tile">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: '1.4rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 18px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
            border: `1px solid ${activeTab === tab ? 'rgba(0,229,195,.4)' : 'var(--border)'}`,
            background: activeTab === tab ? 'rgba(0,229,195,.1)' : 'transparent',
            color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
            textTransform: 'capitalize',
          }}>{tab}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          {/* Recovery chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span style={{ fontWeight: 700 }}>Recovery Timeline vs. Digital Twin</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {patient.healing_class.replace(/_/g, ' ')}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,195,.08)" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="Wound Score"   stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ fill: 'var(--accent-primary)', r: 4 }} />
                <Line type="monotone" dataKey="Expected Twin" stroke="rgba(0,229,195,.3)"    strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Pain (×10)"   stroke="var(--accent-red)"     strokeWidth={2}   dot={{ fill: 'var(--accent-red)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Risk fingerprint */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 700 }}>Surgical Risk Fingerprint</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>OR Telemetry</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { k: 'Tissue Resistance Index', v: `${patient.tissue_resistance_index} (+${Math.round((patient.tissue_resistance_index - 1) * 100)}%)` },
                { k: 'Suture Tension Score',    v: `${patient.suture_tension_score} N/cm²` },
                { k: 'Blood Loss Class',        v: patient.blood_loss_class },
                { k: 'Healing Class',           v: patient.healing_class.replace(/_/g, ' ') },
                { k: 'Risk Multiplier',         v: `${patient.risk_multiplier}×` },
                { k: 'Anomaly Flags',           v: patient.anomaly_flags.join(', ') || 'None' },
              ].map(({ k, v }) => (
                <div key={k} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 10 }}>
                  <div className="stat-label">{k}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, textTransform: 'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'why now' && <WhyNow signals={patient.why_now} />}
      {activeTab === 'recovery gps' && <RecoveryGPS patient={patient} />}
      {activeTab === 'what-if' && <WhatIfSimulator patient={patient} />}

      {activeTab === 'biomarkers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { key: 'pain',        label: 'Pain Score (PCPS)', unit: '/10', color: '#ff4d6d' },
            { key: 'wound',       label: 'Wound Score',       unit: '/100',color: 'var(--accent-primary)' },
            { key: 'temperature', label: 'Temperature',       unit: '°C',  color: '#ffb300' },
            { key: 'heart_rate',  label: 'Heart Rate',        unit: ' BPM',color: '#60a5fa' },
          ].map(b => (
            <div key={b.key} className="card">
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{b.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: b.color }}>
                  {patient.biomarkers[b.key]?.slice(-1)[0]?.value}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.unit}</span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={patient.biomarkers[b.key]} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,195,.06)" />
                  <XAxis dataKey="day" tick={{ fill: '#4a7a9b', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#4a7a9b', fontSize: 9 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}${b.unit}`, b.label]} />
                  <defs>
                    <linearGradient id={`grad-${b.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={b.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={b.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke={b.color} strokeWidth={2} fill={`url(#grad-${b.key})`} dot={{ fill: b.color, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}