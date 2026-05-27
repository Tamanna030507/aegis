import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import RiskQueue from './pages/RiskQueue';
import PatientView from './pages/PatientView';
import CascadeGraph from './pages/CascadeGraph';
import EvidenceBrief from './pages/EvidenceBrief';
import PassportScanner from './pages/PassportScanner';
import FederatedStatus from './components/FederatedStatus';
import { useTheme } from './hooks/useTheme';

const NAV = [
  { to: '/',          label: 'Risk Queue',       icon: '⚡', end: true },
  { to: '/cascade',   label: 'Cascade Graph',    icon: '🧬' },
  { to: '/brief',     label: 'Evidence Brief',   icon: '📋' },
  { to: '/passport',  label: 'Passport Scanner', icon: '🔑' },
  { to: '/federated', label: 'Federated Network',icon: '🌐' },
];

function Sidebar({ theme, toggleTheme }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">⬡</span>
        <div>
          <div className="sidebar-logo-text">AEGIS</div>
          <div className="sidebar-logo-sub">PHYSICIAN DASHBOARD</div>
        </div>
      </div>
      {NAV.map(n => (
        <NavLink key={n.to} to={n.to} end={n.end}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-item-icon">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
      <div style={{ flex: 1 }} />

      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 10, cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem', fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all 0.2s',
          marginBottom: 8,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <span style={{ fontSize: '1rem' }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>

      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>AEGIS DEMO NODE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>Online</span>
        </div>
      </div>
    </aside>
  );
}

function useEscalationWS(setToast) {
  useEffect(() => {
    let ws;
    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/dashboard');
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'escalation') {
              setToast({ patientId: msg.patient_id, urgency: msg.brief?.urgency, title: msg.brief?.title });
              setTimeout(() => setToast(null), 8000);
            }
          } catch {}
        };
        ws.onerror = () => {};
        ws.onclose = () => setTimeout(connect, 5000);
      } catch {}
    };
    connect();
    return () => ws?.close();
  }, [setToast]);
}

export default function App() {
  const { theme, toggle } = useTheme();
  const [escalationToast, setEscalationToast] = useState(null);
  useEscalationWS(setEscalationToast);

  return (
    <BrowserRouter>
      <Sidebar theme={theme} toggleTheme={toggle} />
      <main className="main">
        <Routes>
          <Route path="/"            element={<RiskQueue />} />
          <Route path="/patient/:id" element={<PatientView />} />
          <Route path="/cascade"     element={<CascadeGraph />} />
          <Route path="/cascade/:id" element={<CascadeGraph />} />
          <Route path="/brief"       element={<EvidenceBrief />} />
          <Route path="/brief/:id"   element={<EvidenceBrief />} />
          <Route path="/passport"    element={<PassportScanner />} />
          <Route path="/federated"   element={<FederatedStatus />} />
        </Routes>
      </main>

      {escalationToast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 999,
          background: 'rgba(252,129,129,0.1)',
          border: '1px solid rgba(252,129,129,0.4)',
          borderRadius: 12, padding: '14px 18px', maxWidth: 320,
          animation: 'slide-in 0.3s ease',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontWeight: 700, color: '#fc8181', marginBottom: 4 }}>
            🔴 {(escalationToast.urgency || 'URGENT').toUpperCase()} ALERT
          </div>
          <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
            {escalationToast.title || 'Patient escalation triggered'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
            Patient {escalationToast.patientId} — check dashboard
          </div>
          <button onClick={() => setEscalationToast(null)}
            style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
            ✕
          </button>
        </div>
      )}
    </BrowserRouter>
  );
}