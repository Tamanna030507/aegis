import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import CheckIn from './pages/CheckIn';
import WoundCamera from './pages/WoundCamera';
import KeystrokeLive from './pages/KeystrokeLive';
import Passport from './pages/Passport';
import VoiceOrb from './pages/VoiceOrb';
import { useAuth } from './hooks/useAuth';

const PATIENT_ID  = '0047';
const DAY_POST_OP = 5;

const TABS = [
  { to: '/',          label: 'Check-In',    icon: '🏥', end: true },
  { to: '/wound',     label: 'Wound',       icon: '🔬' },
  { to: '/keystroke', label: 'Pain Monitor',icon: '⌨️'  },
  { to: '/passport',  label: 'Passport',    icon: '🔑'  },
];

function ParticleCanvas() {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
      r: Math.random() * 1.3 + .3,
      a: Math.random() * .4 + .1,
      color: Math.random() > .6 ? '0,229,195' : '0,127,255',
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        particles.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 110) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,229,195,${.05 * (1 - d / 110)})`;
            ctx.lineWidth = .4; ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.a})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.45, pointerEvents: 'none' }} />;
}

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
        backgroundColor: '#040d18',
        color: '#00e5c3',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '2px solid rgba(0,229,195,0.15)',
          borderTopColor: '#00e5c3',
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

  if (user.role !== 'patient') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#040d18',
        color: '#ff4d6d',
        fontFamily: 'monospace',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2 style={{ marginBottom: '10px' }}>⚠️ ACCESS DENIED</h2>
        <p>This portal is reserved for patients. Your account is registered as a {user.role}.</p>
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

function Nav({ theme, toggleTheme, user, logout }) {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="nav">
      {/* Logo */}
      <div className="nav-logo">
        <svg className="hex-logo" width="28" height="28" viewBox="0 0 64 64" fill="none">
          <path d="M32 4L56 18V46L32 60L8 46V18L32 4Z" stroke="#00e5c3" strokeWidth="1.5" fill="rgba(0,229,195,.07)" />
          <path d="M32 12L50 22V42L32 52L14 42V22L32 12Z" stroke="rgba(0,229,195,.25)" strokeWidth="1" fill="none" />
          <path d="M20 32h6l3-8 4 16 3-8h8" stroke="#00e5c3" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ letterSpacing: '-.03em' }}>AE<span>GIS</span></span>
      </div>

      {/* Tabs */}
      <div className="nav-links">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Right strip */}
      <div className="nav-right">
        {user && (
          <span className="user-name-badge" style={{ fontSize: '0.8rem', color: '#00e5c3', border: '1px solid rgba(0,229,195,0.3)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,229,195,0.05)', marginRight: '10px' }}>
            👤 {user.name}
          </span>
        )}
        <div className="nav-status">
          <div className="status-dot" />
          <span>Live</span>
        </div>
        <span className="nav-clock" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>{clock}</span>
        <div className="day-badge">DAY {DAY_POST_OP}</div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {user && (
          <button 
            className="logout-btn" 
            onClick={logout} 
            title="Sign Out" 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'var(--text3)', 
              transition: 'color 0.2s, transform 0.2s', 
              marginLeft: '10px', 
              padding: '4px' 
            }} 
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.transform = 'translateX(2px)'; }} 
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.transform = 'none'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </nav>
  );
}

function AuthWrapper({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  
  return (
    <AuthGuard>
      <ParticleCanvas />
      <Nav theme={theme} toggleTheme={toggleTheme} user={user} logout={logout} />
      <Routes>
        <Route path="/"          element={<CheckIn       patientId={user?.patient_id || PATIENT_ID} dayPostOp={DAY_POST_OP} />} />
        <Route path="/wound"     element={<WoundCamera   patientId={user?.patient_id || PATIENT_ID} />} />
        <Route path="/keystroke" element={<KeystrokeLive patientId={user?.patient_id || PATIENT_ID} />} />
        <Route path="/passport"  element={<Passport      patientId={user?.patient_id || PATIENT_ID} />} />
      </Routes>
      <VoiceOrb patientId={user?.patient_id || PATIENT_ID} dayPostOp={DAY_POST_OP} />
    </AuthGuard>
  );
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <BrowserRouter>
      <AuthWrapper theme={theme} toggleTheme={toggleTheme} />
    </BrowserRouter>
  );
}