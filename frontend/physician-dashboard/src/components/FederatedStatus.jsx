import { useState, useEffect, useRef } from 'react';
import { PATIENTS, PATIENT_LIST } from '../data/patients';

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_COLOR = (r) =>
  r >= 0.75 ? '#ff4d6d' : r >= 0.55 ? '#ffb300' : r >= 0.35 ? '#b794f4' : '#68d391';

// Each patient is "owned" by a federated node
const PATIENT_NODE_MAP = {
  '47': 'NodeA',
  '12': 'NodeB',
  '23': 'NodeA',
  '58': 'NodeC',
  '91': 'NodeB',
};

const NODE_META = {
  NodeA: { label: 'NodeA — Apollo General',     color: '#00e5c3', city: 'Mumbai',       flag: '🇮🇳', patients: ['47', '23'] },
  NodeB: { label: 'NodeB — Borealis Medical',   color: '#63b3ed', city: 'Oslo',          flag: '🇳🇴', patients: ['12', '91'] },
  NodeC: { label: 'NodeC — Cape Apex Hospital', color: '#b794f4', city: 'Cape Town',     flag: '🇿🇦', patients: ['58']       },
};

// ── Feature 1: Global Network Topology Map (SVG) ──────────────────────────────
function NetworkTopology({ activeNode, roundsCompleted }) {
  const nodes = [
    { id: 'NodeA', x: 220, y: 80  },
    { id: 'NodeB', x: 430, y: 80  },
    { id: 'NodeC', x: 325, y: 220 },
    { id: 'AEGIS', x: 325, y: 145, isHub: true },
  ];
  const edges = [
    ['NodeA', 'AEGIS'],
    ['NodeB', 'AEGIS'],
    ['NodeC', 'AEGIS'],
  ];

  const nodePos = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🌐</span> Global Federated Network Topology
        </span>
        <span style={{ fontSize: '0.7rem', color: '#68d391', fontWeight: 600 }}>
          {roundsCompleted} aggregation round{roundsCompleted !== 1 ? 's' : ''} completed
        </span>
      </div>

      <svg width="100%" viewBox="0 0 650 310" style={{ display: 'block', overflow: 'visible' }}>
        {/* Edges */}
        {edges.map(([a, b]) => {
          const pa = nodePos[a], pb = nodePos[b];
          const active = !activeNode || activeNode === a;
          return (
            <line key={`${a}-${b}`}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={active ? NODE_META[a]?.color || '#00e5c3' : 'rgba(255,255,255,0.05)'}
              strokeWidth={active ? 1.5 : 0.5}
              strokeDasharray={roundsCompleted > 0 ? '0' : '4,4'}
              opacity={active ? 0.4 : 0.1}
            />
          );
        })}

        {/* Animated gradient pulses along edges when rounds run */}
        {roundsCompleted > 0 && edges.map(([a, b]) => {
          const pa = nodePos[a], pb = nodePos[b];
          return (
            <circle key={`pulse-${a}-${b}`} r={4} fill={NODE_META[a]?.color || '#00e5c3'} opacity={0.8}>
              <animateMotion dur={`${1.2 + Math.random() * 0.5}s`} repeatCount="indefinite"
                path={`M${pa.x},${pa.y} L${pb.x},${pb.y}`} />
            </circle>
          );
        })}

        {/* Hub node */}
        {(() => {
          const hub = nodePos['AEGIS'];
          return (
            <g key="AEGIS">
              <circle cx={hub.x} cy={hub.y} r={22}
                fill="rgba(0,229,195,0.1)" stroke="#00e5c3" strokeWidth={1.5} />
              <circle cx={hub.x} cy={hub.y} r={28}
                fill="none" stroke="#00e5c3" strokeWidth={0.5} opacity={0.3}
                strokeDasharray="3,3" />
              <text x={hub.x} y={hub.y - 1} textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight={700} fill="#00e5c3" fontFamily="Inter">AEGIS</text>
              <text x={hub.x} y={hub.y + 13} textAnchor="middle"
                fontSize={8.5} fill="rgba(0,229,195,0.6)" fontFamily="Inter">Core</text>
            </g>
          );
        })()}

        {/* Hospital nodes */}
        {nodes.filter(n => !n.isHub).map(n => {
          const meta = NODE_META[n.id];
          const isActive = !activeNode || activeNode === n.id;
          const nodePatients = PATIENT_LIST.filter(p => PATIENT_NODE_MAP[p.patient_id] === n.id);
          const criticalCount = nodePatients.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').length;

          return (
            <g key={n.id} style={{ cursor: 'pointer' }}>
              {/* Glow ring */}
              <circle cx={n.x} cy={n.y} r={30}
                fill="none" stroke={meta.color} strokeWidth={0.5}
                opacity={isActive ? 0.2 : 0.04} />
              <circle cx={n.x} cy={n.y} r={20}
                fill={`${meta.color}${isActive ? '18' : '06'}`}
                stroke={meta.color} strokeWidth={isActive ? 1.5 : 0.5}
                opacity={isActive ? 1 : 0.3} />
              <text x={n.x} y={n.y - 1} textAnchor="middle" dominantBaseline="central"
                fontSize={8.5} fontWeight={700} fill={isActive ? meta.color : 'rgba(255,255,255,0.2)'}
                fontFamily="Inter">{n.id}</text>

              {/* City + flag */}
              <text x={n.x} y={n.y + 34} textAnchor="middle"
                fontSize={9} fill={isActive ? '#94a3b8' : 'rgba(255,255,255,0.15)'}
                fontFamily="Inter">{meta.flag} {meta.city}</text>

              {/* Patient count badge */}
              <circle cx={n.x + 16} cy={n.y - 16} r={8}
                fill={criticalCount > 0 ? 'rgba(255,77,109,0.9)' : 'rgba(104,211,145,0.8)'} />
              <text x={n.x + 16} y={n.y - 16} textAnchor="middle" dominantBaseline="central"
                fontSize={8} fontWeight={800}
                fill="#fff" fontFamily="Inter">{nodePatients.length}</text>
            </g>
          );
        })}

        {/* Legend */}
        <text x={20} y={295} fontSize={9} fill="rgba(255,255,255,0.25)" fontFamily="monospace">
          Badge = patient count on node · Pulsing lines = gradient weights in transit
        </text>
      </svg>

      {/* Node table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
        {Object.entries(NODE_META).map(([id, meta]) => {
          const nodePatients = PATIENT_LIST.filter(p => PATIENT_NODE_MAP[p.patient_id] === id);
          return (
            <div key={id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-surface)', border: `1px solid ${meta.color}25` }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: meta.color, marginBottom: 2 }}>
                {meta.flag} {id}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>{meta.city}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {nodePatients.map(p => (
                  <span key={p.patient_id} style={{
                    fontSize: '0.62rem', padding: '1px 5px', borderRadius: 4,
                    background: `${RISK_COLOR(p.overall_risk)}15`,
                    color: RISK_COLOR(p.overall_risk), fontWeight: 700,
                  }}>#{p.patient_id}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Feature 2: Patient Risk Contribution Heatmap ─────────────────────────────
// Shows how each patient's data shapes the federated model weights
function RiskContributionHeatmap() {
  const weightDimensions = ['Pain model', 'Wound model', 'Temp model', 'Cascade model', 'Recovery model'];

  // Derive each patient's contribution strength per dimension from their biomarkers
  const getContrib = (p, dim) => {
    const m = {
      'Pain model':     p.pcps / 10,
      'Wound model':    1 - (p.wound_score / 100),
      'Temp model':     Math.min(1, (p.temperature - 36.5) / 2),
      'Cascade model':  p.overall_risk,
      'Recovery model': 1 - (p.wound_score / 100) * (1 - p.overall_risk),
    };
    return Math.max(0.05, Math.min(0.98, m[dim] || 0));
  };

  const sorted = [...PATIENT_LIST].sort((a, b) => b.overall_risk - a.overall_risk);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔥</span> Patient Risk Contribution Heatmap
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>How each patient shapes federated model weights</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px' }}>
          <thead>
            <tr>
              <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingRight: 10, paddingBottom: 8 }}>Patient</td>
              {weightDimensions.map(d => (
                <td key={d} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 8, minWidth: 76 }}>
                  {d}
                </td>
              ))}
              <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 8 }}>Influence</td>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const rc = RISK_COLOR(p.overall_risk);
              const contribs = weightDimensions.map(d => getContrib(p, d));
              const avgContrib = contribs.reduce((a, b) => a + b, 0) / contribs.length;

              return (
                <tr key={p.patient_id}>
                  <td style={{ paddingRight: 10, paddingBottom: 4, paddingTop: 4, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', color: rc }}>#{p.patient_id} {p.name.split(' ')[0]}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>D{p.day_post_op} · {NODE_META[PATIENT_NODE_MAP[p.patient_id]]?.city}</div>
                  </td>
                  {contribs.map((c, i) => {
                    const intensity = Math.round(c * 100);
                    const cellColor = c > 0.7 ? '#ff4d6d' : c > 0.45 ? '#ffb300' : c > 0.25 ? '#63b3ed' : '#68d391';
                    return (
                      <td key={i} style={{ textAlign: 'center', paddingBottom: 4, paddingTop: 4 }}>
                        <div title={`${intensity}% contribution`} style={{
                          margin: '0 auto', width: 46, height: 28, borderRadius: 6,
                          background: `${cellColor}${Math.round(c * 255).toString(16).padStart(2,'0')}`,
                          border: `1px solid ${cellColor}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, color: c > 0.4 ? '#fff' : '#94a3b8',
                        }}>
                          {intensity}%
                        </div>
                      </td>
                    );
                  })}
                  {/* Influence bar */}
                  <td style={{ paddingBottom: 4, paddingTop: 4, paddingLeft: 8 }}>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, width: 60 }}>
                      <div style={{ width: `${avgContrib * 100}%`, height: '100%', background: rc, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, textAlign: 'center' }}>
                      {Math.round(avgContrib * 100)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>🔴 &gt;70% — dominant signal</span>
        <span>🟡 45-70% — strong signal</span>
        <span>🔵 25-45% — moderate</span>
        <span>🟢 &lt;25% — weak</span>
      </div>
    </div>
  );
}

// ── Feature 3: Differential Privacy Budget Tracker ───────────────────────────
// Shows noise injection per-patient to maintain privacy while training
function PrivacyBudgetTracker({ roundsCompleted }) {
  const EPSILON_TOTAL = 10.0;
  const epsilonPerRound = 0.18;

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(104,211,145,0.2)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔐</span> Differential Privacy Budget Tracker
        </span>
        <span style={{ fontSize: '0.7rem', color: '#68d391', fontWeight: 600 }}>ε-DP enforced per patient</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Big counter */}
        <div style={{ textAlign: 'center', padding: '14px 20px', borderRadius: 10, background: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.15)', flex: 1 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Patient bytes transferred
          </div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#68d391', lineHeight: 1 }}>0</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Only gradient weights leave the hospital</div>
        </div>
        <div style={{ textAlign: 'center', padding: '14px 20px', borderRadius: 10, background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.15)', flex: 1 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Privacy budget (ε) consumed
          </div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#63b3ed', lineHeight: 1 }}>
            {(roundsCompleted * epsilonPerRound).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            of {EPSILON_TOTAL} total · {((roundsCompleted * epsilonPerRound / EPSILON_TOTAL) * 100).toFixed(1)}% consumed
          </div>
        </div>
      </div>

      {/* Per-patient budget bars */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Per-patient differential privacy noise level
        </div>
        {PATIENT_LIST.map(p => {
          // Higher risk patients contribute more to the model → more noise needed
          const noiseLevel = 0.05 + p.overall_risk * 0.12;
          const consumed = roundsCompleted * noiseLevel;
          const budget = 2.0;
          const pct = Math.min(99, (consumed / budget) * 100);
          const barColor = pct > 70 ? '#ff4d6d' : pct > 40 ? '#ffb300' : '#68d391';

          return (
            <div key={p.patient_id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  #{p.patient_id} {p.name.split(' ')[0]}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>σ={noiseLevel.toFixed(3)}</span>
                </span>
                <span style={{ color: barColor, fontWeight: 700 }}>
                  ε={consumed.toFixed(3)} / {budget} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 12px', background: 'rgba(99,179,237,0.05)', borderRadius: 8, border: '1px solid rgba(99,179,237,0.12)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: '#63b3ed' }}>How it works:</strong> Each gradient update is perturbed with Gaussian noise (σ proportional to patient risk profile).
        Higher-risk patients like Robert Dlamini (#58, σ=0.156) receive more noise to protect sensitive data, while lower-risk patients
        like Lena Kovács (#23, σ=0.072) require less perturbation.
      </div>
    </div>
  );
}

// ── Feature 4: Model Weight Convergence Visualizer ───────────────────────────
function WeightConvergenceChart({ rounds, nodeWeights }) {
  const maxRounds = Math.max(rounds, 1);

  // Synthetic convergence data based on patient risk distribution
  const getDivergence = (round) => {
    // Start high, converge toward 0 with some noise
    const base = Math.exp(-round * 0.35) * 0.22;
    const noise = Math.sin(round * 1.7) * 0.008 + Math.cos(round * 2.3) * 0.005;
    return Math.max(0.001, base + noise);
  };

  const WIDTH = 560, HEIGHT = 120;
  const PAD = { t: 12, r: 20, b: 28, l: 44 };
  const chartW = WIDTH - PAD.l - PAD.r;
  const chartH = HEIGHT - PAD.t - PAD.b;

  const plotRounds = Math.max(8, rounds + 3);
  const points = Array.from({ length: plotRounds }, (_, i) => {
    const r = i;
    const v = getDivergence(r);
    const x = PAD.l + (r / (plotRounds - 1)) * chartW;
    const y = PAD.t + (1 - v / 0.25) * chartH;
    return { x: x.toFixed(1), y: y.toFixed(1), v, r };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${points[0].x},${HEIGHT - PAD.b} ` + points.map(p => `L${p.x},${p.y}`).join(' ') + ` L${points[points.length - 1].x},${HEIGHT - PAD.b} Z`;

  // Y gridlines at 0, 5, 10, 15, 20%
  const yGrids = [0, 0.05, 0.10, 0.15, 0.20, 0.25];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📈</span> Model Weight Convergence
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cross-node gradient divergence over rounds</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
        {/* Grid */}
        {yGrids.map(v => {
          const y = PAD.t + (1 - v / 0.25) * chartH;
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={WIDTH - PAD.r} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
              <text x={PAD.l - 4} y={y} textAnchor="end" dominantBaseline="central"
                fontSize={8.5} fill="#4a7a9b" fontFamily="Inter">{(v * 100).toFixed(0)}%</text>
            </g>
          );
        })}

        {/* X axis */}
        <line x1={PAD.l} y1={HEIGHT - PAD.b} x2={WIDTH - PAD.r} y2={HEIGHT - PAD.b} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

        {/* Area fill */}
        <path d={area} fill="rgba(0,229,195,0.06)" />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#00e5c3" strokeWidth={2} strokeLinejoin="round" />

        {/* Current round marker */}
        {rounds > 0 && points[rounds] && (
          <>
            <line x1={points[rounds].x} y1={PAD.t} x2={points[rounds].x} y2={HEIGHT - PAD.b}
              stroke="rgba(0,229,195,0.3)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={points[rounds].x} cy={points[rounds].y} r={4} fill="#00e5c3" />
            <text x={parseFloat(points[rounds].x) + 6} y={parseFloat(points[rounds].y) - 4}
              fontSize={9} fill="#00e5c3" fontFamily="Inter" fontWeight={600}>
              Round {rounds} · Δ={((getDivergence(rounds)) * 100).toFixed(1)}%
            </text>
          </>
        )}

        {/* X axis labels */}
        {[0, 2, 4, 6, 8].filter(r => r < plotRounds).map(r => {
          const x = PAD.l + (r / (plotRounds - 1)) * chartW;
          return (
            <text key={r} x={x.toFixed(1)} y={HEIGHT - PAD.b + 14}
              textAnchor="middle" fontSize={8.5} fill="#4a7a9b" fontFamily="Inter">R{r}</text>
          );
        })}

        {/* Labels */}
        <text x={PAD.l - 1} y={PAD.t - 2} fontSize={8} fill="#4a7a9b" fontFamily="Inter">Divergence</text>
      </svg>

      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
        Gradient divergence measures how different the 3 nodes' local models are from the global average.
        As federated rounds complete, all hospitals' models converge to a shared understanding of post-surgical risk.
      </div>
    </div>
  );
}

// ── Feature 5: Per-Patient Federated Learning Impact ─────────────────────────
// Shows which specific clinical patterns each patient teaches the global model
function PatientLearningImpact({ roundsCompleted }) {
  const INSIGHTS = {
    '47': [
      'Taught model: wound score decline >14pts/48h predicts seroma with 64% accuracy',
      'Pattern added: tramadol trough PCPS correlation with tissue stress',
    ],
    '12': [
      'Taught model: PT session deficit as DVT predictor post-TKR',
      'Pattern added: mobility lag signature for Day 8 orthopedic recovery',
    ],
    '23': [
      'Taught model: optimal discharge timing — Day 4 after laparoscopic appendectomy',
      'Pattern added: sub-2 PCPS + wound ≥90 = discharge-ready signature',
    ],
    '58': [
      'Taught model: SIRS early indicator — HR+RR combo at Day 2 post-hepatectomy',
      'Pattern added: bile leak risk cascade from wound score drop rate',
    ],
    '91': [
      'Taught model: age-adjusted healing delay curve for Class II patients ≥70',
      'Pattern added: protein deficiency proxy from wound plateau pattern',
    ],
  };

  const sorted = [...PATIENT_LIST].sort((a, b) => b.overall_risk - a.overall_risk);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🧠</span> What Each Patient Taught the Global Model
        </span>
        <span style={{ fontSize: '0.7rem', color: '#b794f4', fontWeight: 600 }}>
          {roundsCompleted > 0 ? `${roundsCompleted} round${roundsCompleted > 1 ? 's' : ''} of learning integrated` : 'Run a round to integrate learnings'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(p => {
          const rc = RISK_COLOR(p.overall_risk);
          const nodeId = PATIENT_NODE_MAP[p.patient_id];
          const nodeMeta = NODE_META[nodeId];
          const insights = INSIGHTS[p.patient_id] || [];
          const integrated = roundsCompleted > 0;

          return (
            <div key={p.patient_id} style={{
              padding: '12px 14px', borderRadius: 10,
              background: integrated ? `${rc}08` : 'var(--bg-surface)',
              border: `1px solid ${integrated ? rc + '30' : 'var(--border)'}`,
              opacity: integrated ? 1 : 0.5,
              transition: 'all 0.4s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: integrated ? 8 : 0 }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `${rc}18`, border: `1.5px solid ${rc}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.72rem', color: rc,
                }}>
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: rc }}>
                    #{p.patient_id} {p.name}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                    via {nodeMeta.flag} {nodeId} — {nodeMeta.city}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                  background: integrated ? `${rc}15` : 'rgba(255,255,255,0.05)',
                  color: integrated ? rc : 'var(--text-muted)',
                  fontWeight: 700, border: `1px solid ${integrated ? rc + '30' : 'transparent'}`,
                }}>
                  {integrated ? '✓ Integrated' : '○ Pending'}
                </div>
              </div>

              {integrated && (
                <div style={{ paddingLeft: 42 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{
                      fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                      display: 'flex', gap: 8, marginBottom: i < insights.length - 1 ? 4 : 0,
                    }}>
                      <span style={{ color: nodeMeta.color, flexShrink: 0 }}>→</span>
                      {insight}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main FederatedStatus Page ─────────────────────────────────────────────────
export default function FederatedStatus() {
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [triggering, setTriggering] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  const [nodeWeights, setNodeWeights] = useState({
    NodeA: [0.102, 0.248, 0.183],
    NodeB: [0.118, 0.231, 0.201],
    NodeC: [0.093, 0.261, 0.194],
  });

  const NODE_COLORS = {
    NodeA: NODE_META.NodeA.color,
    NodeB: NODE_META.NodeB.color,
    NodeC: NODE_META.NodeC.color,
  };

  const addLog = (text, color = 'var(--text-secondary)') => {
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString()}] ${text}`, color }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = 9999; }, 50);
  };

  const triggerRound = async (nodeId) => {
    setTriggering(true);
    setActiveNode(nodeId);
    const nodeMeta = NODE_META[nodeId];
    const nodePatients = PATIENT_LIST.filter(p => PATIENT_NODE_MAP[p.patient_id] === nodeId);

    addLog(`Initiating federated round from ${nodeId} (${nodeMeta.city})...`, NODE_COLORS[nodeId]);
    await new Promise(r => setTimeout(r, 600));

    addLog(`Local training on ${nodePatients.length} patient(s): ${nodePatients.map(p => '#' + p.patient_id).join(', ')}`, '#94a3b8');
    await new Promise(r => setTimeout(r, 700));

    // Inject noise into weights
    const newWeights = { ...nodeWeights };
    const perturb = (v) => parseFloat((v + (Math.random() - 0.5) * 0.04).toFixed(4));
    newWeights[nodeId] = nodeWeights[nodeId].map(perturb);
    addLog(`Gradient computed. Differential noise injected (σ=${(0.05 + PATIENT_LIST.filter(p => PATIENT_NODE_MAP[p.patient_id] === nodeId).reduce((s, p) => s + p.overall_risk, 0) / 5 * 0.12).toFixed(3)})`, '#ffb300');
    await new Promise(r => setTimeout(r, 600));

    addLog(`Sending gradient Δ to AEGIS Core (0 patient bytes transferred)...`, '#94a3b8');
    await new Promise(r => setTimeout(r, 500));

    // FedAvg simulation
    const avg = nodeWeights.NodeA.map((_, i) =>
      parseFloat(((newWeights.NodeA[i] + newWeights.NodeB[i] + newWeights.NodeC[i]) / 3).toFixed(4))
    );
    ['NodeA', 'NodeB', 'NodeC'].forEach(n => { newWeights[n] = avg.map(v => parseFloat((v + (Math.random() - 0.5) * 0.01).toFixed(4))); });

    setNodeWeights(newWeights);
    await new Promise(r => setTimeout(r, 400));

    const newRounds = roundsCompleted + 1;
    setRoundsCompleted(newRounds);
    addLog(`✅ Round ${newRounds} complete — all 3 nodes updated. Divergence: ${(Math.exp(-newRounds * 0.35) * 22).toFixed(1)}%`, '#68d391');

    setTriggering(false);
    setActiveNode(null);
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Federated Learning Network</h1>
        <p className="page-sub">
          Privacy-preserving cross-hospital model updates · 3 active nodes · 5 patients contributing
        </p>
      </div>

      {/* Feature 1: Network Topology Map */}
      <NetworkTopology activeNode={activeNode} roundsCompleted={roundsCompleted} />

      {/* Node trigger cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {Object.entries(NODE_META).map(([id, meta]) => {
          const nodePatients = PATIENT_LIST.filter(p => PATIENT_NODE_MAP[p.patient_id] === id);
          const criticalCount = nodePatients.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').length;

          return (
            <div key={id} className="card" style={{ borderColor: `${meta.color}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.85rem' }}>{meta.flag} {id}</span>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{meta.city}</div>
                </div>
                <span className="risk-badge risk-low" style={{ fontSize: '0.65rem', alignSelf: 'flex-start' }}>● Online</span>
              </div>

              {/* Patients on node */}
              <div style={{ marginBottom: 10 }}>
                {nodePatients.map(p => (
                  <div key={p.patient_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                    <span style={{ color: RISK_COLOR(p.overall_risk), fontWeight: 600 }}>#{p.patient_id} {p.name.split(' ')[0]}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{Math.round(p.overall_risk * 100)}% risk</span>
                  </div>
                ))}
              </div>

              {/* Local weights */}
              <div style={{ marginBottom: 10 }}>
                {nodeWeights[id]?.map((w, i) => (
                  <div key={i} style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                      <span>w{i + 1}</span><span style={{ fontFamily: 'monospace' }}>{w.toFixed(4)}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-surface)', borderRadius: 2 }}>
                      <div style={{ width: `${Math.abs(w) * 300}%`, height: '100%', background: meta.color, borderRadius: 2, maxWidth: '100%' }} />
                    </div>
                  </div>
                ))}
              </div>

              {criticalCount > 0 && (
                <div style={{ fontSize: '0.68rem', color: '#ff4d6d', marginBottom: 8, fontWeight: 600 }}>
                  ⚠ {criticalCount} high/critical patient{criticalCount > 1 ? 's' : ''} on this node
                </div>
              )}

              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}
                onClick={() => triggerRound(id)} disabled={triggering}>
                {triggering && activeNode === id ? '⟳ Training...' : `↑ Inject from ${id}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature 2: Risk Contribution Heatmap */}
      <RiskContributionHeatmap />

      {/* Feature 3: Privacy Budget */}
      <PrivacyBudgetTracker roundsCompleted={roundsCompleted} />

      {/* Feature 4: Convergence Chart */}
      <WeightConvergenceChart rounds={roundsCompleted} nodeWeights={nodeWeights} />

      {/* Feature 5: Patient Learning Impact */}
      <PatientLearningImpact roundsCompleted={roundsCompleted} />

      {/* Event log */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 700 }}>Event Log</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="section-label">Rounds: {roundsCompleted}</span>
            {log.length > 0 && (
              <button onClick={() => setLog([])}
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                Clear
              </button>
            )}
          </div>
        </div>
        <div ref={logRef} style={{
          fontFamily: '"Courier New", monospace', fontSize: '0.75rem',
          color: 'var(--text-secondary)', minHeight: 80, maxHeight: 200, overflowY: 'auto',
        }}>
          {log.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter' }}>
              Trigger a federated round to see the event log...
            </p>
          )}
          {log.map((l, i) => (
            <div key={i} style={{
              padding: '3px 0', borderBottom: '1px solid var(--border)',
              color: l.color || (l.text.includes('✅') ? '#68d391' : 'var(--text-secondary)'),
            }}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}