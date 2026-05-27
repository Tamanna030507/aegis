import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import CheckIn from './pages/CheckIn';
import WoundCamera from './pages/WoundCamera';
import KeystrokeLive from './pages/KeystrokeLive';
import Passport from './pages/Passport';
import VoiceOrb from './pages/VoiceOrb';

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

function Nav({ theme, toggleTheme }) {
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
        <div className="nav-status">
          <div className="status-dot" />
          <span>Live</span>
        </div>
        <span className="nav-clock" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>{clock}</span>
        <div className="day-badge">DAY {DAY_POST_OP}</div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
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
      <ParticleCanvas />
      <Nav theme={theme} toggleTheme={toggleTheme} />
      <Routes>
        <Route path="/"          element={<CheckIn       patientId={PATIENT_ID} dayPostOp={DAY_POST_OP} />} />
        <Route path="/wound"     element={<WoundCamera   patientId={PATIENT_ID} />} />
        <Route path="/keystroke" element={<KeystrokeLive patientId={PATIENT_ID} />} />
        <Route path="/passport"  element={<Passport      patientId={PATIENT_ID} />} />
      </Routes>
      <VoiceOrb patientId={PATIENT_ID} dayPostOp={DAY_POST_OP} />
    </BrowserRouter>
  );
}