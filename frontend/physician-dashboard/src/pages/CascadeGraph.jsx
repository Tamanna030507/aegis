import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { PATIENTS, PATIENT_LIST } from '../data/patients';

// ── Status colours ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  current:             '#63b3ed',
  predicted:           '#b794f4',
  intervention_window: '#68d391',
  avoidable:           '#fc8181',
};

const STATUS_LABEL = {
  current:             'Current',
  predicted:           'Predicted',
  intervention_window: 'Intervention Window',
  avoidable:           'Avoidable',
};

const RISK_COLOR = (r) =>
  r >= 0.75 ? '#ff4d6d' : r >= 0.55 ? '#ffb300' : r >= 0.35 ? '#b794f4' : '#68d391';

// ── 1. Patient Selector strip ─────────────────────────────────────────────────
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
        const rc = RISK_COLOR(p.overall_risk);
        return (
          <button key={p.patient_id} onClick={() => onSelect(p.patient_id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
              border: `1px solid ${active ? rc : 'var(--border)'}`,
              background: active ? `${rc}18` : 'transparent',
              color: active ? rc : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc, display: 'inline-block' }} />
            #{p.patient_id} {p.name.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}

// ── 2. Risk Velocity Meter ────────────────────────────────────────────────────
function RiskVelocityMeter({ patient }) {
  const history = patient.risk_history;
  if (history.length < 2) return null;
  const last = history[history.length - 1].overall_risk;
  const prev = history[history.length - 2].overall_risk;
  const velocity = ((last - prev) / prev) * 100;
  const accel = history.length >= 3
    ? (last - prev) - (prev - history[history.length - 3].overall_risk)
    : 0;

  const velColor = velocity > 10 ? '#ff4d6d' : velocity > 3 ? '#ffb300' : velocity < 0 ? '#68d391' : '#63b3ed';

  // Gauge arc
  const svgSize = 120;
  const cx = 60, cy = 70, r = 46;
  const startAngle = Math.PI * 0.85;
  const endAngle   = Math.PI * 2.15;
  const clampedV   = Math.max(-30, Math.min(30, velocity));
  const norm        = (clampedV + 30) / 60;
  const needleAngle = startAngle + norm * (endAngle - startAngle);
  const arcPath     = (fromA, toA) => {
    const x1 = cx + r * Math.cos(fromA), y1 = cy + r * Math.sin(fromA);
    const x2 = cx + r * Math.cos(toA),   y2 = cy + r * Math.sin(toA);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const nx = cx + 36 * Math.cos(needleAngle);
  const ny = cy + 36 * Math.sin(needleAngle);

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: `${velColor}30` }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📡</span> Risk Velocity Meter
        </span>
        <span style={{ fontSize: '0.7rem', color: velColor, fontWeight: 700 }}>
          {velocity > 0 ? '↑ Deteriorating' : velocity < 0 ? '↓ Improving' : '→ Stable'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Gauge */}
        <svg width={svgSize} height={svgSize} style={{ flexShrink: 0 }}>
          {/* Track */}
          <path d={arcPath(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
          {/* Colored fill to needle */}
          <path d={arcPath(startAngle, needleAngle)} fill="none" stroke={velColor} strokeWidth={10} strokeLinecap="round" />
          {/* Needle */}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={velColor} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={4} fill={velColor} />
          {/* Labels */}
          <text x={cx - 38} y={cy + 18} fontSize={9} fill="#4a7a9b" fontFamily="Inter">SLOW</text>
          <text x={cx + 16} y={cy + 18} fontSize={9} fill="#4a7a9b" fontFamily="Inter">FAST</text>
          <text x={cx} y={cy + 38} fontSize={13} fontWeight={700} fill={velColor} textAnchor="middle" fontFamily="Inter">
            {velocity > 0 ? '+' : ''}{velocity.toFixed(1)}%
          </text>
        </svg>

        {/* Stats */}
        <div style={{ flex: 1 }}>
          {[
            { label: 'Risk Δ (last period)',  value: `${velocity > 0 ? '+' : ''}${velocity.toFixed(1)}%`, color: velColor },
            { label: 'Acceleration',           value: accel > 0.005 ? '↑ Accelerating' : accel < -0.005 ? '↓ Decelerating' : '→ Steady', color: accel > 0.005 ? '#ff4d6d' : accel < -0.005 ? '#68d391' : '#94a3b8' },
            { label: 'Current Risk Score',     value: `${Math.round(last * 100)}%`, color: RISK_COLOR(last) },
            { label: 'Projected in 24h',       value: `${Math.min(99, Math.round((last + (last - prev)) * 100))}%`, color: RISK_COLOR(last + (last - prev)) },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. Probability Heatmap Timeline ─────────────────────────────────────────
function ProbabilityHeatmap({ patient }) {
  const nodes = patient.cascade.nodes;
  const maxDay = nodes[nodes.length - 1].day + 2;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔥</span> Probability Heatmap Timeline
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Complication risk by day</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${maxDay}, 1fr)`, gap: 2, minWidth: 500 }}>
          {/* Header row */}
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Event</div>
          {Array.from({ length: maxDay }, (_, i) => (
            <div key={i} style={{
              fontSize: '0.62rem', color: patient.day_post_op === i + 1 ? 'var(--accent-primary)' : 'var(--text-muted)',
              textAlign: 'center', fontWeight: patient.day_post_op === i + 1 ? 700 : 400,
              paddingBottom: 4,
            }}>D{i + 1}</div>
          ))}

          {/* Node rows */}
          {nodes.map((node) => (
            <>
              {/* Label */}
              <div key={`label-${node.event}`} style={{
                fontSize: '0.7rem', color: STATUS_COLOR[node.status],
                alignSelf: 'center', fontWeight: 600, paddingRight: 8,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={node.event.replace(/_/g, ' ')}>
                {node.event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).substring(0, 18)}
              </div>

              {/* Cells */}
              {Array.from({ length: maxDay }, (_, i) => {
                const day = i + 1;
                const isNodeDay = day === node.day;
                const prob = isNodeDay ? node.probability : 0;
                const opacity = isNodeDay ? Math.max(0.12, prob) : 0.03;
                const isToday = day === patient.day_post_op;
                return (
                  <div key={`${node.event}-d${day}`} style={{
                    height: 28, borderRadius: 4,
                    background: isNodeDay ? `${STATUS_COLOR[node.status]}` : 'rgba(255,255,255,0.03)',
                    opacity: isNodeDay ? opacity + 0.15 : 0.06,
                    border: isToday ? '1px solid rgba(0,229,195,0.3)' : '1px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', color: isNodeDay ? '#fff' : 'transparent',
                    fontWeight: 700, transition: 'all .2s',
                    cursor: isNodeDay ? 'default' : 'default',
                  }}>
                    {isNodeDay ? `${Math.round(prob * 100)}%` : ''}
                  </div>
                );
              })}
            </>
          ))}
        </div>

        {/* Today marker label */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--accent-primary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid var(--accent-primary)', display: 'inline-block' }} />
          Today (Day {patient.day_post_op}) — cell borders highlighted
        </div>
      </div>
    </div>
  );
}

// ── 4. Intervention Impact Simulator ────────────────────────────────────────
function InterventionSimulator({ patient }) {
  const nodes = patient.cascade.nodes;
  const [chosenDay, setChosenDay] = useState(patient.cascade.optimal_intervention_day);

  // Find which avoidable nodes this intervention would prevent
  const avoidableNodes = nodes.filter(n => n.status === 'avoidable');
  const preventedNodes = avoidableNodes.filter(n => n.day > chosenDay);
  const savedProbability = preventedNodes.reduce((sum, n) => sum + n.probability, 0);
  const baselineRisk = patient.overall_risk;
  const simulatedRisk = Math.max(0.01, baselineRisk - savedProbability * 0.35);
  const riskReduction = baselineRisk - simulatedRisk;

  const interventionDays = nodes.filter(n => n.day <= patient.day_post_op + 3).map(n => n.day);

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(104,211,145,0.2)' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚙️</span> Intervention Impact Simulator
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 700 }}>
          Optimal: Day {patient.cascade.optimal_intervention_day}
        </span>
      </div>

      {/* Day selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Select intervention day to simulate outcome:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {nodes.map(n => {
            const isOpt = n.day === patient.cascade.optimal_intervention_day;
            const isChosen = n.day === chosenDay;
            const late = n.day > patient.cascade.optimal_intervention_day;
            return (
              <button key={n.day} onClick={() => setChosenDay(n.day)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                  border: `1.5px solid ${isChosen ? STATUS_COLOR[n.status] : 'var(--border)'}`,
                  background: isChosen ? `${STATUS_COLOR[n.status]}18` : 'transparent',
                  color: isChosen ? STATUS_COLOR[n.status] : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                }}>
                Day {n.day}
                {isOpt && <span style={{ position: 'absolute', top: -6, right: -4, fontSize: '0.55rem', background: '#68d391', color: '#000', borderRadius: 4, padding: '1px 4px' }}>BEST</span>}
                {late && !isOpt && <span style={{ position: 'absolute', top: -6, right: -4, fontSize: '0.55rem', background: '#ffb300', color: '#000', borderRadius: 4, padding: '1px 4px' }}>LATE</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Outcome display */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Complications prevented</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#68d391' }}>{preventedNodes.length}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>of {avoidableNodes.length} avoidable</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Risk reduction</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#68d391' }}>−{Math.round(riskReduction * 100)}%</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{Math.round(baselineRisk * 100)}% → {Math.round(simulatedRisk * 100)}%</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 10 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Probability saved</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa' }}>{(savedProbability * 100).toFixed(0)}%</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>cumulative avoided risk</div>
        </div>
      </div>

      {preventedNodes.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(104,211,145,0.05)', borderRadius: 8, border: '1px solid rgba(104,211,145,0.15)' }}>
          <div style={{ fontSize: '0.73rem', color: '#68d391', fontWeight: 600, marginBottom: 4 }}>Complications this intervention would prevent:</div>
          {preventedNodes.map(n => (
            <div key={n.event} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 8 }}>
              ✓ Day {n.day} — {n.event.replace(/_/g, ' ')} ({Math.round(n.probability * 100)}% probability)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 5. Cascade Replay Animation (D3 DAG) ─────────────────────────────────────
function CascadeDAG({ patient }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(null); // null = all visible

  const dag = patient.cascade;

  const renderDAG = useCallback((svgEl, visCount) => {
    const W = svgEl.clientWidth || 700;
    const H = 460;
    const nodeW = 198, nodeH = 70;
    const nodes = [...dag.nodes].sort((a, b) => a.day - b.day);
    const n = nodes.length;
    const showCount = visCount === null ? n : visCount;

    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl)
      .attr('width', W).attr('height', H)
      .style('overflow', 'visible');

    nodes.forEach((node, i) => {
      node._x = W / 2;
      node._y = 44 + i * ((H - 88) / Math.max(n - 1, 1));
    });

    // Probability flow path (background spline)
    if (nodes.length >= 2) {
      const pathPts = nodes.map(nd => [nd._x, nd._y]);
      const line = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom);
      svg.append('path')
        .attr('d', line(pathPts))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(99,179,237,0.06)')
        .attr('stroke-width', nodeW * 0.6)
        .attr('stroke-linecap', 'round');
    }

    // Edges
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const visible = i < showCount - 1;
      svg.append('line')
        .attr('x1', a._x).attr('y1', a._y + nodeH / 2)
        .attr('x2', b._x).attr('y2', b._y - nodeH / 2)
        .attr('stroke', visible ? 'rgba(99,179,237,0.25)' : 'rgba(99,179,237,0.06)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', b.status === 'avoidable' ? '5,5' : '0');
    }

    // Probability bars (horizontal) behind each node
    nodes.forEach((node, i) => {
      if (i >= showCount) return;
      const barW = Math.max(8, node.probability * nodeW * 0.85);
      svg.append('rect')
        .attr('x', node._x - barW / 2)
        .attr('y', node._y - nodeH / 2 - 4)
        .attr('width', barW).attr('height', 2)
        .attr('rx', 1)
        .attr('fill', STATUS_COLOR[node.status])
        .attr('opacity', 0.35);
    });

    // Nodes
    const nodeGroup = svg.selectAll('g.node')
      .data(nodes).enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d._x - nodeW / 2}, ${d._y - nodeH / 2})`)
      .style('opacity', (d, i) => i < showCount ? 0 : 0)
      .style('cursor', 'pointer');

    // Fade in nodes up to showCount
    nodeGroup.filter((d, i) => i < showCount)
      .transition().duration(350).delay((d, i) => i * 120)
      .style('opacity', 1);

    nodeGroup
      .on('mouseenter', function(event, d) {
        const containerRect = svgEl.parentElement.getBoundingClientRect();
        setTooltip({
          x: event.clientX - containerRect.left + 14,
          y: event.clientY - containerRect.top - 10,
          node: d,
        });
      })
      .on('mouseleave', () => setTooltip(null));

    // Node bg
    nodeGroup.append('rect')
      .attr('width', nodeW).attr('height', nodeH).attr('rx', 12)
      .attr('fill', d => `${STATUS_COLOR[d.status]}12`)
      .attr('stroke', d => STATUS_COLOR[d.status])
      .attr('stroke-width', d => d.status === 'intervention_window' ? 2.5 : 1.5)
      .style('filter', d => d.status === 'intervention_window'
        ? `drop-shadow(0 0 10px ${STATUS_COLOR[d.status]}60)` : 'none');

    // Pulse ring
    nodeGroup.filter(d => d.status === 'intervention_window')
      .append('rect')
      .attr('width', nodeW).attr('height', nodeH).attr('rx', 12)
      .attr('fill', 'none').attr('stroke', STATUS_COLOR.intervention_window)
      .attr('stroke-width', 2).attr('opacity', 0.5)
      .call(el => {
        const pulse = () => el.attr('opacity', 0.5).transition().duration(900).attr('opacity', 0).on('end', pulse);
        pulse();
      });

    // Probability bar inside node
    nodeGroup.append('rect')
      .attr('x', 10).attr('y', nodeH - 8).attr('rx', 2)
      .attr('width', d => Math.max(4, (nodeW - 20) * d.probability))
      .attr('height', 3)
      .attr('fill', d => STATUS_COLOR[d.status])
      .attr('opacity', 0.5);

    // Day label
    nodeGroup.append('text')
      .attr('x', 10).attr('y', 18)
      .attr('fill', d => STATUS_COLOR[d.status])
      .attr('font-size', '10px').attr('font-weight', '700').attr('font-family', 'Inter')
      .text(d => `Day ${d.day}`);

    // Event label
    nodeGroup.append('text')
      .attr('x', 10).attr('y', 38)
      .attr('fill', '#e2e8f0')
      .attr('font-size', '12px').attr('font-weight', '700').attr('font-family', 'Inter')
      .text(d => d.event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).substring(0, 26));

    // Prob / intervention label
    nodeGroup.append('text')
      .attr('x', 10).attr('y', 56)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px').attr('font-family', 'Inter')
      .text(d => d.intervention_label || `${(d.probability * 100).toFixed(0)}% probability`);

    // "Today" marker
    const todayNode = nodes.find(nd => nd.day === patient.day_post_op);
    if (todayNode) {
      svg.append('text')
        .attr('x', todayNode._x + nodeW / 2 + 8)
        .attr('y', todayNode._y + 4)
        .attr('fill', 'var(--accent-primary, #00e5c3)')
        .attr('font-size', '10px').attr('font-family', 'Inter').attr('font-weight', '600')
        .text('← TODAY');
    }
  }, [dag, patient]);

  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    let af;
    const draw = () => { af = requestAnimationFrame(() => renderDAG(el, visibleCount)); };
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(af); };
  }, [renderDAG, visibleCount]);

  // Replay logic
  const handleReplay = () => {
    setReplaying(true);
    setVisibleCount(1);
    const totalNodes = dag.nodes.length;
    let i = 2;
    const interval = setInterval(() => {
      setVisibleCount(i);
      i++;
      if (i > totalNodes) {
        clearInterval(interval);
        setVisibleCount(null);
        setReplaying(false);
      }
    }, 500);
  };

  return (
    <div className="card" style={{ marginBottom: 20, position: 'relative' }}>
      <div className="card-header">
        <span style={{ fontWeight: 700 }}>Complication Cascade DAG</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleReplay} disabled={replaying}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid rgba(99,179,237,0.3)', background: 'rgba(99,179,237,0.08)',
              color: '#63b3ed', cursor: replaying ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
            {replaying ? '⟳ Replaying...' : '▶ Replay Cascade'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>

      <svg ref={svgRef} style={{ width: '100%', height: 460, display: 'block' }} />

      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y,
          background: 'rgba(8,12,22,0.97)',
          border: `1px solid ${STATUS_COLOR[tooltip.node.status]}40`,
          borderRadius: 10, padding: '10px 14px',
          fontSize: '0.78rem', color: '#e2e8f0',
          pointerEvents: 'none', zIndex: 10, maxWidth: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 700, color: STATUS_COLOR[tooltip.node.status], marginBottom: 4 }}>
            Day {tooltip.node.day} — {tooltip.node.event.replace(/_/g, ' ')}
          </div>
          <div>Probability: <strong>{(tooltip.node.probability * 100).toFixed(0)}%</strong></div>
          <div style={{ color: '#94a3b8', textTransform: 'capitalize', marginTop: 2 }}>
            {tooltip.node.status.replace(/_/g, ' ')}
          </div>
          {tooltip.node.intervention_label && (
            <div style={{ marginTop: 4, color: '#68d391' }}>{tooltip.node.intervention_label}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 6. Cross-Patient Risk Comparison ────────────────────────────────────────
function CrossPatientComparison({ activeId }) {
  const sorted = [...PATIENT_LIST].sort((a, b) => b.overall_risk - a.overall_risk);
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📊</span> Cross-Patient Risk Comparison
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All 5 patients</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(p => {
          const isActive = String(p.patient_id) === String(activeId);
          const rc = RISK_COLOR(p.overall_risk);
          return (
            <div key={p.patient_id} style={{
              padding: '10px 14px', borderRadius: 10,
              background: isActive ? `${rc}10` : 'var(--bg-surface)',
              border: `1px solid ${isActive ? rc + '40' : 'transparent'}`,
              transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? rc : 'var(--text-primary)', minWidth: 120 }}>
                  {isActive ? '● ' : ''}{p.name.split(' ')[0]} #{p.patient_id}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flex: 1 }}>
                  {p.procedure_type.split(' ').slice(0, 3).join(' ')} · Day {p.day_post_op}
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: rc }}>{Math.round(p.overall_risk * 100)}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{
                  width: `${p.overall_risk * 100}%`, height: '100%',
                  background: rc, borderRadius: 3, transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CascadeGraph page ────────────────────────────────────────────────────
export default function CascadeGraph() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Default to first patient if no id provided
  const defaultId = id || PATIENT_LIST.sort((a, b) => b.overall_risk - a.overall_risk)[0].patient_id;
  const [activeId, setActiveId] = useState(defaultId);
  const patient = PATIENTS[String(activeId)] || PATIENTS['58'];

  const handleSelect = (newId) => {
    setActiveId(newId);
    navigate(`/cascade/${newId}`, { replace: true });
  };

  const riskColor = RISK_COLOR(patient.overall_risk);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Complication Cascade Graph</h1>
          <p className="page-sub">
            Forward-simulated causal DAG ·{' '}
            <span style={{ color: riskColor, fontWeight: 700 }}>{patient.name} — {patient.risk_level.toUpperCase()} RISK</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · Day {patient.day_post_op} · {patient.procedure_type}</span>
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/brief/${activeId}`)}>📋 Evidence Brief →</button>
      </div>

      {/* Feature 1: Patient Selector */}
      <PatientSelector activeId={activeId} onSelect={handleSelect} />

      {/* Optimal intervention callout */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(104,211,145,0.3)', background: 'rgba(104,211,145,0.04)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: 4 }}>
              Optimal Intervention Window — Day {patient.cascade.optimal_intervention_day}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{patient.cascade.summary}</p>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
            background: `${riskColor}18`, border: `1px solid ${riskColor}40`, color: riskColor,
            flexShrink: 0,
          }}>
            {patient.risk_level.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Feature 2: Risk Velocity Meter */}
      <RiskVelocityMeter patient={patient} />

      {/* Feature 3: Probability Heatmap */}
      <ProbabilityHeatmap patient={patient} />

      {/* Feature 4: Cascade DAG (with replay) */}
      <CascadeDAG patient={patient} />

      {/* Feature 5: Intervention Impact Simulator */}
      <InterventionSimulator patient={patient} />

      {/* Feature 6: Cross-patient comparison */}
      <CrossPatientComparison activeId={activeId} />
    </div>
  );
}