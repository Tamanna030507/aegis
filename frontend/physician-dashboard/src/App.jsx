import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import RiskQueue from './pages/RiskQueue';
import PatientView from './pages/PatientView';
import CascadeGraph from './pages/CascadeGraph';
import EvidenceBrief from './pages/EvidenceBrief';
import PassportScanner from './pages/PassportScanner';
import FederatedStatus from './components/FederatedStatus';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';

const NAV = [
  { to: '/',          label: 'Risk Queue',       icon: '⚡', end: true },
  { to: '/cascade',   label: 'Cascade Graph',    icon: '🧬' },
  { to: '/brief',     label: 'Evidence Brief',   icon: '📋' },
  { to: '/passport',  label: 'Passport Scanner', icon: '🔑' },
  { to: '/federated', label: 'Federated Network',icon: '🌐' },
];

function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#071425',
        color: '#60a5fa',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '2px solid rgba(96,165,250,0.15)',
          borderTopColor: '#60a5fa',
          animation: 'spin-auth 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-auth { to { transform: rotate(360deg); } }
        `}} />
        <p style={{ marginTop: '20px', fontFamily: 'monospace', letterSpacing: '0.15em' }}>Loading AEGIS Session...</p>
      </div>
    );
  }

  if (!user) {
    window.location.href = import.meta.env.VITE_LOGIN_URL || "http://localhost:3007";
    return null;
  }

  if (user.role !== 'physician') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#071425',
        color: '#ff4d6d',
        fontFamily: 'monospace',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2 style={{ marginBottom: '10px' }}>⚠️ ACCESS DENIED</h2>
        <p>This portal is reserved for physicians. Your account is registered as a {user.role}.</p>
        <button 
          onClick={() => { window.location.href = import.meta.env.VITE_LOGIN_URL || "http://localhost:3007" }}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#ff4d6d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Return to Login
        </button>
      </div>
    );
  }

  return children;
}

function Sidebar({ theme, toggleTheme, user, logout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">⬡</span>
        <div>
          <div className="sidebar-logo-text">AEGIS</div>
          <div className="sidebar-logo-sub">PHYSICIAN DASHBOARD</div>
        </div>
      </div>

      {user && (
        <div style={{ padding: '12px 14px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AUTHORIZED CLINICIAN</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontSize: '0.85rem' }}>
            ⚕️ {user.name}
          </div>
        </div>
      )}

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

      {user && (
        <button
          onClick={logout}
          title="Sign Out"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 10, cursor: 'pointer',
            color: '#ef4444',
            fontSize: '0.85rem', fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            marginBottom: 16,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      )}

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

function AuthWrapper() {
  const { theme, toggle } = useTheme();
  const [escalationToast, setEscalationToast] = useState(null);
  const { user, logout } = useAuth();
  useEscalationWS(setEscalationToast);

  return (
    <AuthGuard>
      <Sidebar theme={theme} toggleTheme={toggle} user={user} logout={logout} />
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
    </AuthGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthWrapper />
    </BrowserRouter>
  );
}