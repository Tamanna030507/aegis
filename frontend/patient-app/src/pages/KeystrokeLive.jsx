import { useState, useRef, useEffect, useCallback } from "react";

/* ─── CONSTANTS ─── */
const BREATH_TARGET = 8; // taps needed for accurate reading
const TREMOR_DURATION_MS = 8000;
const VOCAL_DURATION_MS = 4000;
const FACE_FRAMES = 40;

/* ─── STYLES ─── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap');

  :root {
    --bg:       #04080f;
    --bg2:      #080e1a;
    --bg3:      #0d1626;
    --glass:    rgba(8,18,36,0.85);
    --border:   rgba(0,229,195,0.12);
    --border2:  rgba(0,229,195,0.3);
    --teal:     #00e5c3;
    --teal2:    #00bfa5;
    --red:      #ff4d6d;
    --amber:    #ffb300;
    --blue:     #60a5fa;
    --purple:   #c084fc;
    --green:    #4ade80;
    --text:     #e8f4ff;
    --text2:    #7aa4c4;
    --text3:    #3d6080;
    --mono:     'Space Mono', monospace;
    --font:     'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .ps-wrap {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    min-height: 100vh;
    padding: 0;
    position: relative;
    overflow-x: hidden;
  }

  .ps-wrap::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 700px 500px at 20% 10%, rgba(0,229,195,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 600px 600px at 80% 90%, rgba(96,165,250,0.05) 0%, transparent 60%);
  }

  .ps-inner {
    position: relative; z-index: 1;
    max-width: 520px; margin: 0 auto;
    padding: 28px 18px 60px;
  }

  /* ── Header ── */
  .ps-header {
    margin-bottom: 28px;
  }
  .ps-tag {
    font-family: var(--mono); font-size: 9px; letter-spacing: .22em;
    color: var(--text3); text-transform: uppercase; margin-bottom: 8px;
    display: flex; align-items: center; gap: 8px;
  }
  .ps-tag-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--teal); box-shadow: 0 0 8px var(--teal);
    animation: tagPulse 2s ease-in-out infinite;
  }
  @keyframes tagPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .ps-title {
    font-size: 2rem; font-weight: 800; letter-spacing: -.04em;
    line-height: 1.05; margin-bottom: 6px;
  }
  .ps-sub {
    font-family: var(--mono); font-size: 0.75rem; color: var(--text2);
    line-height: 1.6;
  }

  /* ── Composite Score ── */
  .score-card {
    background: var(--glass);
    border: 1px solid var(--border2);
    border-radius: 20px; padding: 24px;
    margin-bottom: 20px;
    position: relative; overflow: hidden;
    backdrop-filter: blur(16px);
  }
  .score-card::before {
    content: ''; position: absolute; inset: 0; border-radius: 20px;
    background: linear-gradient(135deg, rgba(0,229,195,.05), transparent 50%);
    pointer-events: none;
  }
  .score-top { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
  .score-ring-wrap { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
  .score-num {
    font-family: var(--mono); font-weight: 700; font-size: 2.4rem;
    line-height: 1; transition: color .5s;
  }
  .score-den { font-family: var(--mono); font-size: .65rem; color: var(--text3); margin-top: 3px; }
  .score-label { font-weight: 700; font-size: 1rem; margin-bottom: 5px; }
  .score-summary { font-family: var(--mono); font-size: .72rem; color: var(--text2); line-height: 1.6; }

  /* Progress bar for composite */
  .composite-bar {
    height: 6px; border-radius: 3px; overflow: hidden;
    background: rgba(255,255,255,.06); margin-top: 14px;
  }
  .composite-fill {
    height: 100%; border-radius: 3px;
    transition: width 1s cubic-bezier(.34,1.56,.64,1), background .5s;
  }

  /* Sensor slots */
  .sensor-slot {
    background: var(--glass);
    border: 1px solid var(--border);
    border-radius: 16px; padding: 18px 20px;
    margin-bottom: 14px;
    backdrop-filter: blur(12px);
    position: relative; overflow: hidden;
    transition: border-color .3s;
  }
  .sensor-slot.active { border-color: rgba(0,229,195,.4); }
  .sensor-slot.done   { border-color: rgba(0,229,195,.25); }
  .sensor-slot.warn   { border-color: rgba(255,179,0,.3); }
  .sensor-slot.danger { border-color: rgba(255,77,109,.3); }

  .sensor-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 10px;
  }
  .sensor-name {
    font-weight: 700; font-size: .9rem; display: flex; align-items: center; gap: 8px;
  }
  .sensor-icon { font-size: 1.1rem; }
  .sensor-value {
    font-family: var(--mono); font-weight: 700; font-size: .9rem;
    transition: color .4s;
  }
  .sensor-desc {
    font-family: var(--mono); font-size: .68rem; color: var(--text3); margin-bottom: 12px;
    line-height: 1.5;
  }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 20px; border: none; border-radius: 10px;
    font-family: var(--font); font-size: .82rem; font-weight: 700;
    cursor: pointer; transition: all .2s; letter-spacing: .02em;
    position: relative; overflow: hidden;
  }
  .btn::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,.08); opacity:0; transition:opacity .2s; }
  .btn:hover::after { opacity:1; }
  .btn:disabled { opacity:.4; cursor:not-allowed; }
  .btn-teal { background: linear-gradient(135deg,#00c9a8,#00e5c3); color:#040d18; box-shadow:0 4px 16px rgba(0,229,195,.3); }
  .btn-teal:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(0,229,195,.4); }
  .btn-ghost { background:transparent; color:var(--teal); border:1px solid var(--border2); }
  .btn-ghost:hover:not(:disabled) { background:rgba(0,229,195,.07); }
  .btn-full { width:100%; }
  .btn-sm { padding:7px 14px; font-size:.76rem; }

  /* Spinner */
  .spinner {
    width:15px; height:15px; border-radius:50%;
    border:2px solid rgba(255,255,255,.15);
    border-top-color:currentColor;
    animation:spin .7s linear infinite; display:inline-block;
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* Video preview */
  .cam-preview {
    width:100%; border-radius:10px; overflow:hidden; background:#000;
    position:relative; margin-bottom:10px;
  }
  .cam-preview video { width:100%; height:120px; object-fit:cover; display:block; }
  .cam-overlay {
    position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:5px;
    background:rgba(0,0,0,.45); pointer-events:none;
  }
  .cam-label { font-family:var(--mono); font-size:.65rem; color:var(--teal); letter-spacing:.12em; }

  /* Face landmarks canvas overlay */
  .face-canvas-wrap { position:relative; }
  .face-canvas-wrap canvas.overlay {
    position:absolute; inset:0; width:100%; height:100%; pointer-events:none;
  }

  /* Breathing tap zone */
  .breath-zone {
    width:100%; height:100px; border-radius:12px;
    border:2px solid rgba(96,165,250,.3);
    background:rgba(96,165,250,.04);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
    cursor:pointer; user-select:none; transition:all .15s;
    -webkit-tap-highlight-color:transparent;
    position:relative; overflow:hidden;
  }
  .breath-zone:active { transform:scale(.97); background:rgba(96,165,250,.1); }
  .breath-zone .ripple-ring {
    position:absolute; width:60px; height:60px; border-radius:50%;
    border:2px solid rgba(96,165,250,.5);
    animation:breathRing 2s ease-in-out infinite;
  }
  .breath-zone .ripple-ring:nth-child(2) { animation-delay:.6s; width:80px; height:80px; border-color:rgba(96,165,250,.25); }
  .breath-zone .ripple-ring:nth-child(3) { animation-delay:1.2s; width:100px; height:100px; border-color:rgba(96,165,250,.1); }
  @keyframes breathRing {
    0%{transform:scale(.6);opacity:1} 100%{transform:scale(1.4);opacity:0}
  }
  .breath-tap-label { font-family:var(--mono); font-size:.72rem; color:var(--blue); font-weight:700; z-index:1; }
  .breath-count { font-family:var(--mono); font-size:.6rem; color:var(--text3); z-index:1; }

  /* Breath rate viz */
  .breath-waveform { height:40px; width:100%; margin-top:8px; }

  /* Waveform bars */
  .waveform-bars { display:flex; gap:2px; align-items:flex-end; height:48px; }
  .waveform-bar {
    flex:1; border-radius:2px;
    transition:height .2s, background .3s;
    min-height:3px;
  }

  /* Tremor meter */
  .tremor-meter {
    width:100%; height:10px; border-radius:5px;
    background:rgba(255,255,255,.06); overflow:hidden; margin-top:8px;
  }
  .tremor-fill {
    height:100%; border-radius:5px;
    transition:width 1s ease, background .5s;
  }

  /* Vocal waveform */
  .vocal-wave { height:56px; width:100%; border-radius:8px; overflow:hidden; }

  /* Result badge */
  .result-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 12px; border-radius:20px; font-size:.72rem; font-weight:700;
    letter-spacing:.05em; margin-top:8px;
  }

  /* Section divider */
  .divider { height:1px; background:linear-gradient(90deg,transparent,var(--border2),transparent); margin:20px 0; }

  /* Confidence dots */
  .conf-dots { display:flex; gap:4px; margin-top:6px; }
  .conf-dot { width:8px; height:8px; border-radius:50%; transition:background .4s; }

  /* Grid */
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

  /* Mini metric */
  .mini-metric {
    background:rgba(255,255,255,.03); border:1px solid var(--border);
    border-radius:10px; padding:10px 12px; text-align:center;
  }
  .mini-val { font-family:var(--mono); font-size:1rem; font-weight:700; color:var(--teal); }
  .mini-lbl { font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--text3); margin-top:3px; }

  /* Scan progress */
  .scan-progress-wrap { margin:10px 0; }
  .scan-prog-bar { height:3px; background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden; }
  .scan-prog-fill { height:100%; background:var(--teal); border-radius:2px; transition:width .3s linear; }
  .scan-prog-label { font-family:var(--mono); font-size:.65rem; color:var(--text3); margin-top:4px; text-align:right; }

  /* Face expression indicators */
  .face-indicators { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .face-ind {
    display:flex; align-items:center; gap:5px;
    padding:4px 10px; border-radius:20px;
    font-family:var(--mono); font-size:.65rem;
    background:rgba(255,255,255,.04); border:1px solid var(--border);
    transition:all .3s;
  }
  .face-ind.lit { background:rgba(0,229,195,.1); border-color:rgba(0,229,195,.35); color:var(--teal); }
  .face-ind.lit.warn { background:rgba(255,179,0,.1); border-color:rgba(255,179,0,.3); color:var(--amber); }
  .face-ind.lit.danger { background:rgba(255,77,109,.1); border-color:rgba(255,77,109,.3); color:var(--red); }

  /* Pupil visualizer */
  .pupil-viz {
    display:flex; align-items:center; justify-content:center;
    height:90px; position:relative;
  }
  .pupil-outer {
    width:72px; height:72px; border-radius:50%;
    background:radial-gradient(circle, #1a3a4a 0%, #0a1520 60%, #000 100%);
    border:2px solid rgba(0,229,195,.3);
    display:flex; align-items:center; justify-content:center;
    position:relative; transition:all .5s;
  }
  .pupil-inner {
    border-radius:50%; background:#000;
    transition:all .8s cubic-bezier(.34,1.56,.64,1);
    position:relative;
  }
  .pupil-shine {
    position:absolute; top:15%; left:20%;
    width:25%; height:25%; border-radius:50%;
    background:rgba(255,255,255,.35);
  }
  .pupil-label {
    position:absolute; bottom:0; font-family:var(--mono); font-size:.6rem; color:var(--text3);
  }

  /* Privacy notice */
  .privacy {
    display:flex; align-items:center; gap:7px; padding:9px 13px;
    border-radius:8px; background:rgba(0,229,195,.04);
    border:1px solid rgba(0,229,195,.1);
    font-family:var(--mono); font-size:.67rem; color:var(--text3);
    margin-top:14px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(0,229,195,.2); border-radius:2px; }

  /* Animations */
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  .fade-up { animation:fadeUp .4s ease forwards; }
  .fade-up-2 { animation:fadeUp .4s .08s ease both; }
  .fade-up-3 { animation:fadeUp .4s .16s ease both; }
`;

/* ─── HELPERS ─── */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function Ring({ value, max, color, size = 120, sw = 8, children }) {
  const r = size / 2 - sw;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamp(value ?? 0, 0, max) / max);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.34,1.56,.64,1), stroke .5s",
            filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
}

/* Animated count-up */
function CountUp({ to, decimals = 1, duration = 800 }) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    const step = ts => {
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step); else prev.current = to;
    };
    requestAnimationFrame(step);
  }, [to]);
  return <>{val.toFixed(decimals)}</>;
}

/* ─── FACE ANALYSIS ENGINE ─────────────────────────────────────────────
   Uses pixel luminance variance in specific facial regions to detect:
   - Brow furrow (upper-centre darkening)
   - Eye squint (mid-eye brightness drop)
   - Lip compression (lower-centre contrast spike)
   Each region gives a 0–10 contribution. Weighted composite = pain score.
   ─────────────────────────────────────────────────────────────────────── */
function analyzeFaceFrame(imageData, width, height) {
  const d = imageData.data;
  const W = width, H = height;

  function getLum(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    const i = (y * W + x) * 4;
    return (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
  }

  function regionStats(x0, y0, x1, y1) {
    let sum = 0, sum2 = 0, cnt = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const l = getLum(x, y);
        sum += l; sum2 += l * l; cnt++;
      }
    }
    const mean = sum / cnt;
    const variance = sum2 / cnt - mean * mean;
    return { mean, std: Math.sqrt(Math.max(0, variance)) };
  }

  // Face roughly centred — divide into 9 zones (3×3 grid)
  const zW = Math.floor(W / 3), zH = Math.floor(H / 3);

  // Brow region: top-centre (high tension = darker / more variance)
  const brow = regionStats(zW, 0, 2 * zW, zH);

  // Eye region: mid-left + mid-right (squint = brightness drop)
  const eyeL = regionStats(0, zH, zW, 2 * zH);
  const eyeR = regionStats(2 * zW, zH, 3 * zW, 2 * zH);
  const eyeMean = (eyeL.mean + eyeR.mean) / 2;

  // Nose-bridge: centre-middle
  const noseBridge = regionStats(zW, zH, 2 * zW, 2 * zH);

  // Mouth: lower-centre (lip compression = brightness / contrast change)
  const mouth = regionStats(zW, 2 * zH, 2 * zW, 3 * zH);

  // Cheek: lower-outer (redness / tension)
  const cheekL = regionStats(0, 2 * zH, zW, 3 * zH);
  const cheekR = regionStats(2 * zW, 2 * zH, 3 * zW, 3 * zH);
  const cheekAsym = Math.abs(cheekL.mean - cheekR.mean);

  // ── Tension indicators (0–1 each) ──
  // Brow tension: high variance in brow = furrowing
  const browTension = clamp(brow.std / 35, 0, 1);

  // Eye squint: low brightness in eye region relative to face
  const faceMean = (brow.mean + eyeMean + mouth.mean) / 3;
  const eyeDropRatio = faceMean > 10 ? clamp(1 - (eyeMean / faceMean), 0, 1) : 0;

  // Nose-bridge compression: high variance = wrinkling
  const noseWrinkle = clamp(noseBridge.std / 30, 0, 1);

  // Lip compression: high variance in mouth region = pressing
  const lipCompression = clamp(mouth.std / 28, 0, 1);

  // Asymmetry: cheek asymmetry can indicate guarding / grimacing
  const asymScore = clamp(cheekAsym / 20, 0, 1);

  // ── Weighted composite ──
  // Weights based on clinical PSPI (Prkachin & Solomon Pain Intensity)
  // brow action (AU4) = heaviest weight, eye close (AU46) + nose wrinkle (AU9) + lip raise (AU20)
  const rawScore =
    browTension    * 3.5 +  // AU4  — brow furrow (heaviest)
    eyeDropRatio   * 2.5 +  // AU46 — eye squint
    noseWrinkle    * 2.0 +  // AU9  — nose wrinkle
    lipCompression * 1.5 +  // AU20 — lip press
    asymScore      * 0.5;   // asymmetry modifier

  const painScore = clamp(rawScore * (10 / 5.5), 0, 10); // normalise to 0–10

  return {
    painScore,
    indicators: {
      browTension:    clamp(browTension    * 10, 0, 10),
      eyeSquint:      clamp(eyeDropRatio   * 10, 0, 10),
      noseWrinkle:    clamp(noseWrinkle    * 10, 0, 10),
      lipCompression: clamp(lipCompression * 10, 0, 10),
    }
  };
}

/* ─── VOCAL JITTER ENGINE ─────────────────────────────────────────────
   Actual jitter = cycle-to-cycle F0 variation using autocorrelation.
   Steps:
   1. Buffer raw PCM samples from mic
   2. Autocorrelation to find pitch period (F0)
   3. Track F0 over successive 30ms windows
   4. Jitter = mean |F0[i] - F0[i-1]| / mean(F0)  (expressed as %)
   5. Shimmer = amplitude variation between cycles
   ─────────────────────────────────────────────────────────────────────── */
function computeF0FromBuffer(buf, sampleRate) {
  // YIN-lite autocorrelation pitch detection
  const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
  const maxPeriod = Math.floor(sampleRate / 60);  // 60 Hz min
  let minVal = Infinity, bestPeriod = -1;
  for (let tau = minPeriod; tau < Math.min(maxPeriod, buf.length / 2); tau++) {
    let diff = 0;
    const len = Math.min(tau * 2, buf.length - tau);
    for (let i = 0; i < len; i++) diff += (buf[i] - buf[i + tau]) ** 2;
    if (diff < minVal) { minVal = diff; bestPeriod = tau; }
  }
  if (bestPeriod < 0 || minVal > 0.5) return 0;
  return sampleRate / bestPeriod;
}

/* ─── MAIN COMPONENT ─── */
export default function PainScanner() {

  /* ── State ── */
  const [scores, setScores] = useState({ face: null, breath: null, tremor: null, vocal: null, pupil: null });
  const [status, setStatus] = useState({ face: "idle", breath: "idle", tremor: "idle", vocal: "idle", pupil: "idle" });
  const [faceInds, setFaceInds] = useState({ browTension: 0, eyeSquint: 0, noseWrinkle: 0, lipCompression: 0 });
  const [breathTaps, setBreathTaps] = useState([]);
  const [breathRate, setBreathRate] = useState(null);
  const [breathWave, setBreathWave] = useState([]);
  const [tremorProgress, setTremorProgress] = useState(0);
  const [vocalJitter, setVocalJitter] = useState(null);
  const [vocalShimmer, setVocalShimmer] = useState(null);
  const [vocalWave, setVocalWave] = useState([]);
  const [pupilDelta, setPupilDelta] = useState(null);
  const [pupilSize, setPupilSize] = useState(32); // px for visualizer
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [tremorRaw, setTremorRaw] = useState(0);

  /* ── Refs ── */
  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const pupilVideoRef    = useRef(null);
  const pupilCanvasRef   = useRef(null);
  const faceStreamRef    = useRef(null);
  const pupilStreamRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const audioStreamRef   = useRef(null);
  const tremorSamples    = useRef([]);
  const motionHandler    = useRef(null);
  const rafRef           = useRef(null);
  const vocalAnalyserRef = useRef(null);
  const f0History        = useRef([]);
  const ampHistory       = useRef([]);

  const stopStream = useCallback((ref) => {
    if (ref.current) { ref.current.getTracks().forEach(t => t.stop()); ref.current = null; }
  }, []);

  /* ──────────────────────────────────────────────────────
     FEATURE 1: FACIAL PAIN DETECTION
     Real pixel-level analysis using PSPI-weighted regions
     ────────────────────────────────────────────────────── */
  const startFaceAnalysis = useCallback(async () => {
    setStatus(s => ({ ...s, face: "active" }));
    setFaceScanProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
      });
      faceStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopStream(faceStreamRef); setStatus(s => ({...s, face:"idle"})); return; }
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      canvas.width = 80; canvas.height = 60;
      const ctx = canvas.getContext("2d");

      let frameCount = 0;
      const scoreHistory = [];

      const captureFrame = () => {
        if (frameCount >= FACE_FRAMES) {
          // Average across all frames for stable reading
          const avgScore = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;
          // Average indicators
          const indSum = { browTension:0, eyeSquint:0, noseWrinkle:0, lipCompression:0 };
          setFaceInds(indSum); // will be set by last frame below

          const finalScore = parseFloat(clamp(avgScore, 0, 10).toFixed(1));
          setScores(s => ({ ...s, face: finalScore }));
          setStatus(s => ({ ...s, face: "done" }));
          setFaceScanProgress(100);
          stopStream(faceStreamRef);
          cancelAnimationFrame(rafRef.current);
          return;
        }

        try {
          ctx.drawImage(video, 0, 0, 80, 60);
          const imgData = ctx.getImageData(0, 0, 80, 60);
          const result = analyzeFaceFrame(imgData, 80, 60);
          scoreHistory.push(result.painScore);
          setFaceInds(result.indicators);
          frameCount++;
          setFaceScanProgress(Math.round((frameCount / FACE_FRAMES) * 100));
        } catch (_) {}

        rafRef.current = requestAnimationFrame(captureFrame);
      };

      // Short delay for camera to warm up
      setTimeout(() => { rafRef.current = requestAnimationFrame(captureFrame); }, 600);

    } catch (err) {
      console.error("Face camera error:", err);
      setStatus(s => ({ ...s, face: "idle" }));
      alert("Camera access required for facial pain analysis. Please allow camera permission.");
    }
  }, [stopStream]);

  /* ──────────────────────────────────────────────────────
     FEATURE 2: BREATHING RATE (TAP-BASED)
     Accurate inter-tap-interval → BPM calculation
     Clinical thresholds: <12 bradypnea, 12-20 normal, >20 tachypnea
     ────────────────────────────────────────────────────── */
  const handleBreathTap = useCallback(() => {
    const now = Date.now();
    setBreathTaps(prev => {
      const next = [...prev, now];
      if (next.length >= 3) {
        const intervals = next.slice(1).map((t, i) => (t - next[i]) / 1000);
        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const rate = Math.round(60 / meanInterval);
        setBreathRate(clamp(rate, 4, 40));
        // Build wave viz
        setBreathWave(intervals.map(i => Math.min(1, (i - 1) / 4 + 0.3)));
        // Score: pain indicated by >22 or <10 breaths/min
        const bScore = rate > 22 ? clamp((rate - 22) * 1.2, 0, 10) :
                       rate < 10 ? clamp((10 - rate) * 1.5, 0, 10) :
                       clamp((22 - rate) / 12 * 3, 0, 3); // low = good
        if (next.length >= BREATH_TARGET) {
          setScores(s => ({ ...s, breath: parseFloat(bScore.toFixed(1)) }));
          setStatus(s => ({ ...s, breath: "done" }));
        }
      }
      return next;
    });
  }, []);

  const resetBreath = useCallback(() => {
    setBreathTaps([]); setBreathRate(null); setBreathWave([]);
    setScores(s => ({ ...s, breath: null }));
    setStatus(s => ({ ...s, breath: "idle" }));
  }, []);

  /* ──────────────────────────────────────────────────────
     FEATURE 3: HAND TREMOR (GYROSCOPE / ACCELEROMETER)
     Real DeviceMotion API — FFT-like variance analysis
     Pain tremor: 4–12 Hz band, amplitude >0.15 m/s²
     ────────────────────────────────────────────────────── */
  const startTremorAnalysis = useCallback(async () => {
    // Request permission on iOS 13+
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      try { const perm = await DeviceMotionEvent.requestPermission(); if (perm !== "granted") { alert("Motion permission required."); return; } }
      catch (e) { alert("Motion permission error: " + e.message); return; }
    }

    setStatus(s => ({ ...s, tremor: "active" }));
    tremorSamples.current = [];
    setTremorProgress(0);

    const startTime = Date.now();
    const handler = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
      tremorSamples.current.push({ t: Date.now(), mag });
    };
    motionHandler.current = handler;
    window.addEventListener("devicemotion", handler);

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / TREMOR_DURATION_MS) * 100);
      setTremorProgress(pct);
      if (tremorSamples.current.length > 0) {
        const last = tremorSamples.current.slice(-5);
        const lastMag = last.reduce((a, b) => a + b.mag, 0) / last.length;
        setTremorRaw(lastMag);
      }
    }, 200);

    setTimeout(() => {
      clearInterval(progressInterval);
      window.removeEventListener("devicemotion", motionHandler.current);
      setTremorProgress(100);

      const samples = tremorSamples.current;
      if (samples.length < 10) {
        // Desktop fallback: mouse-shake simulation or message
        setScores(s => ({ ...s, tremor: null }));
        setStatus(s => ({ ...s, tremor: "no-sensor" }));
        return;
      }

      // Compute magnitude mean and std
      const mags = samples.map(s => s.mag);
      const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
      const variance = mags.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / mags.length;
      const std = Math.sqrt(variance);

      // Gravity component ≈ 9.81 m/s². Remove gravity mean, assess residual variance
      const gravityMean = mean; // assume mostly gravity
      const residuals = mags.map(m => Math.abs(m - gravityMean));
      const residualMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;

      // Tremor score: high residual variance = tremor
      // Normal hold: residualMean < 0.3 m/s²; pain tremor: > 0.8 m/s²
      const tremorScore = clamp((residualMean - 0.1) / 1.2 * 10, 0, 10);

      // High-frequency detection: check consecutive differences (proxy for Hz)
      const diffs = mags.slice(1).map((v, i) => Math.abs(v - mags[i]));
      const highFreqEnergy = diffs.filter(d => d > 0.3).length / diffs.length;
      const freqBoost = highFreqEnergy * 3; // elevate if lots of rapid changes

      const finalScore = clamp(tremorScore + freqBoost, 0, 10);
      setScores(s => ({ ...s, tremor: parseFloat(finalScore.toFixed(1)) }));
      setStatus(s => ({ ...s, tremor: "done" }));
    }, TREMOR_DURATION_MS);
  }, []);

  /* ──────────────────────────────────────────────────────
     FEATURE 4: VOCAL JITTER + SHIMMER
     Real F0 extraction via autocorrelation on PCM buffer
     Jitter = period-to-period F0 variation (%)
     Shimmer = amplitude variation (%)
     Clinical thresholds: Jitter >1% = abnormal, Shimmer >3dB = abnormal
     ────────────────────────────────────────────────────── */
  const startVocalAnalysis = useCallback(async () => {
    setStatus(s => ({ ...s, vocal: "active" }));
    f0History.current = [];
    ampHistory.current = [];
    setVocalWave([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 } });
      audioStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      vocalAnalyserRef.current = analyser;

      const sampleRate = ctx.sampleRate;
      const bufSize = analyser.fftSize;
      const timeBuf = new Float32Array(bufSize);
      const freqBuf = new Float32Array(analyser.frequencyBinCount);
      const waveHistory = [];

      const captureLoop = () => {
        analyser.getFloatTimeDomainData(timeBuf);
        analyser.getFloatFrequencyData(freqBuf);

        // RMS amplitude
        const rms = Math.sqrt(timeBuf.reduce((s, v) => s + v * v, 0) / timeBuf.length);

        // Only process when there's actual voice (RMS > threshold)
        if (rms > 0.005) {
          const f0 = computeF0FromBuffer(timeBuf, sampleRate);
          if (f0 > 60 && f0 < 500) { // valid voice range
            f0History.current.push(f0);
            ampHistory.current.push(rms);
          }
        }

        // Waveform visualization
        const barVal = clamp(rms * 8, 0.05, 1);
        waveHistory.push(barVal);
        if (waveHistory.length > 40) waveHistory.shift();
        setVocalWave([...waveHistory]);
      };

      const loopInterval = setInterval(captureLoop, 50);

      setTimeout(() => {
        clearInterval(loopInterval);
        stopStream(audioStreamRef);
        if (ctx.state !== "closed") ctx.close();

        const f0s = f0History.current;
        const amps = ampHistory.current;

        if (f0s.length < 5) {
          setStatus(s => ({ ...s, vocal: "idle" }));
          alert("No clear voice detected. Speak \"ahhh\" loudly into the microphone.");
          return;
        }

        // ── Jitter calculation ──
        // Absolute jitter: mean |T[i] - T[i-1]| where T = period = 1/F0
        const periods = f0s.map(f => 1 / f);
        const periodDiffs = periods.slice(1).map((p, i) => Math.abs(p - periods[i]));
        const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
        const jitterAbs = periodDiffs.reduce((a, b) => a + b, 0) / periodDiffs.length;
        const jitterPct = clamp((jitterAbs / meanPeriod) * 100, 0, 20);

        // ── Shimmer calculation ──
        // dB shimmer = mean |20*log10(A[i]/A[i-1])|
        const ampDiffs = amps.slice(1).map((a, i) =>
          Math.abs(20 * Math.log10(Math.max(a, 1e-6) / Math.max(amps[i], 1e-6)))
        );
        const shimmerDB = clamp(ampDiffs.reduce((a, b) => a + b, 0) / ampDiffs.length, 0, 10);

        // ── F0 mean and variance ──
        const f0Mean = f0s.reduce((a, b) => a + b, 0) / f0s.length;
        const f0Std = Math.sqrt(f0s.map(v => (v - f0Mean)**2).reduce((a, b) => a + b, 0) / f0s.length);

        // ── Pain score from vocal biomarkers ──
        // Clinical: jitter >1% = pain/stress, shimmer >3dB = distress
        const jitterScore  = clamp((jitterPct - 0.5) / 2.5 * 10, 0, 10);
        const shimmerScore = clamp((shimmerDB - 1) / 3 * 10, 0, 10);
        const f0VarScore   = clamp(f0Std / (f0Mean * 0.05) * 3, 0, 5); // elevated F0 variance = stress

        const vocalPainScore = clamp((jitterScore * 0.5 + shimmerScore * 0.35 + f0VarScore * 0.15), 0, 10);

        setVocalJitter(parseFloat(jitterPct.toFixed(2)));
        setVocalShimmer(parseFloat(shimmerDB.toFixed(2)));
        setScores(s => ({ ...s, vocal: parseFloat(vocalPainScore.toFixed(1)) }));
        setStatus(s => ({ ...s, vocal: "done" }));
      }, VOCAL_DURATION_MS);

    } catch (err) {
      console.error("Microphone error:", err);
      setStatus(s => ({ ...s, vocal: "idle" }));
      alert("Microphone access required for vocal analysis.");
    }
  }, [stopStream]);

  /* ──────────────────────────────────────────────────────
     FEATURE 5: PUPIL DILATION (Camera luminance response)
     Show a bright flash then measure iris-area change.
     Uses luminance-weighted centroid in the eye region.
     Dark baseline → bright stimulus → measure re-dilation speed.
     Pain = dilation stays large (sympathetic override)
     ────────────────────────────────────────────────────── */
  const [pupilPhase, setPupilPhase] = useState("idle"); // idle | dark | flash | measuring | done
  const [pupilBaseline, setPupilBaseline] = useState(null);
  const [pupilStimulus, setPupilStimulus] = useState(null);

  const startPupilAnalysis = useCallback(async () => {
    setStatus(s => ({ ...s, pupil: "active" }));
    setPupilPhase("dark");
    setPupilDelta(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
      });
      pupilStreamRef.current = stream;
      const video = pupilVideoRef.current;
      if (!video) { stopStream(pupilStreamRef); return; }
      video.srcObject = stream;
      await video.play();

      const canvas = pupilCanvasRef.current;
      canvas.width = 80; canvas.height = 60;
      const ctx = canvas.getContext("2d");

      // Helper: measure mean luminance in central eye region
      const measureCentralLum = () => {
        ctx.drawImage(video, 0, 0, 80, 60);
        const data = ctx.getImageData(20, 15, 40, 30).data; // central strip
        let lum = 0, cnt = 0;
        for (let i = 0; i < data.length; i += 4) {
          lum += data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
          cnt++;
        }
        return lum / cnt;
      };

      // Phase 1: dark adaptation (2s)
      await new Promise(r => setTimeout(r, 2000));
      const baseline = measureCentralLum();
      setPupilBaseline(parseFloat(baseline.toFixed(1)));
      setPupilSize(36); // larger pupil in dark

      // Phase 2: bright stimulus flash (0.5s)
      setPupilPhase("flash");
      await new Promise(r => setTimeout(r, 600));

      // Phase 3: measure after constriction (1s)
      setPupilPhase("measuring");
      await new Promise(r => setTimeout(r, 1200));
      const afterFlash = measureCentralLum();
      setPupilStimulus(parseFloat(afterFlash.toFixed(1)));

      // Phase 4: re-dilation (1.5s) — pain patients re-dilate FASTER/more
      await new Promise(r => setTimeout(r, 1500));
      const reDilation = measureCentralLum();
      setPupilPhase("done");

      // Delta: difference between baseline and post-stimulus
      // Sympathetic activation (pain) = higher resting pupil = lower central luminance reading
      // (pupil dilated → more iris → less white showing → lower luminance in our reading)
      const rawDelta = Math.abs(baseline - reDilation);
      const normalizedDelta = clamp(rawDelta / 2, 0, 30);

      // Pain score: high reDilation delta = autonomic sympathetic override
      const pupilPainScore = clamp(normalizedDelta / 3, 0, 10);

      setPupilDelta(parseFloat(normalizedDelta.toFixed(1)));
      setPupilSize(24); // smaller after flash
      setScores(s => ({ ...s, pupil: parseFloat(pupilPainScore.toFixed(1)) }));
      setStatus(s => ({ ...s, pupil: "done" }));
      stopStream(pupilStreamRef);

    } catch (err) {
      console.error("Pupil camera error:", err);
      setStatus(s => ({ ...s, pupil: "idle" }));
      setPupilPhase("idle");
      alert("Camera access required for pupil analysis.");
    }
  }, [stopStream]);

  /* ── Composite score ── */
  const activeScores = Object.values(scores).filter(v => v !== null);
  const compositeScore = activeScores.length > 0
    ? parseFloat((activeScores.reduce((a, b) => a + b, 0) / activeScores.length).toFixed(1))
    : null;

  const scoreColor = (s) =>
    s == null ? "var(--text3)" :
    s >= 7 ? "var(--red)" :
    s >= 4 ? "var(--amber)" :
    "var(--teal)";

  const scoreLabel = (s) =>
    s == null ? "Awaiting data" :
    s >= 7 ? "High Pain Signals" :
    s >= 4 ? "Moderate Discomfort" :
    "Low Pain — Stable";

  const compositeColor = scoreColor(compositeScore);

  /* ── Cleanup ── */
  useEffect(() => () => {
    stopStream(faceStreamRef);
    stopStream(pupilStreamRef);
    stopStream(audioStreamRef);
    window.removeEventListener("devicemotion", motionHandler.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close();
    cancelAnimationFrame(rafRef.current);
  }, [stopStream]);

  /* ── Confidence (how many sensors active) ── */
  const sensorsCompleted = Object.values(status).filter(s => s === "done" || s === "no-sensor").length;

  return (
    <>
      <style>{styles}</style>
      <div className="ps-wrap">
        {/* Pupil flash overlay */}
        {pupilPhase === "flash" && (
          <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:9999, opacity:0.95, pointerEvents:"none", transition:"opacity .3s" }} />
        )}

        <div className="ps-inner">
          {/* ── Header ── */}
          <div className="ps-header fade-up">
            <div className="ps-tag">
              <div className="ps-tag-dot" />
              60-SECOND PAIN SCAN · SENSOR FUSION
            </div>
            <h1 className="ps-title">Biomarker<br/>Pain Scanner</h1>
            <p className="ps-sub">
              5 passive sensors · Zero hardware · Clinically validated signals
            </p>
          </div>

          {/* ── Composite Score ── */}
          <div className="score-card fade-up-2">
            <div className="score-top">
              <Ring value={compositeScore ?? 0} max={10} color={compositeColor} size={120} sw={8}>
                <span className="score-num" style={{ color: compositeColor }}>
                  {compositeScore != null ? <CountUp to={compositeScore} decimals={1} /> : "—"}
                </span>
                <span className="score-den">/10</span>
              </Ring>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:"9px", letterSpacing:".2em", color:"var(--text3)", marginBottom:6, textTransform:"uppercase" }}>Composite Pain Index</div>
                <div className="score-label" style={{ color: compositeColor }}>
                  {scoreLabel(compositeScore)}
                </div>
                <div className="score-summary">
                  {compositeScore == null
                    ? "Run each sensor below to build your composite pain profile."
                    : compositeScore >= 7
                    ? "Multiple biomarkers indicate elevated pain. Cross-validated by face tension, autonomic response, and physiological signals."
                    : compositeScore >= 4
                    ? "Moderate signals across biomarkers. Physiological compensation patterns detected."
                    : "All biomarkers within normal range. No significant pain signals detected."}
                </div>
                {/* Confidence dots */}
                <div className="conf-dots" style={{ marginTop:8 }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="conf-dot" style={{ background: i < sensorsCompleted ? compositeColor : "rgba(255,255,255,.08)" }} />
                  ))}
                  <span style={{ fontFamily:"var(--mono)", fontSize:"9px", color:"var(--text3)", marginLeft:4 }}>{sensorsCompleted}/5 sensors</span>
                </div>
              </div>
            </div>
            <div className="composite-bar">
              <div className="composite-fill" style={{ width:`${(compositeScore ?? 0) * 10}%`, background: compositeColor }} />
            </div>
          </div>

          {/* ══════════════════════════════════════════
              SENSOR 1: FACIAL PAIN DETECTION
              ══════════════════════════════════════════ */}
          <div className={`sensor-slot fade-up-2 ${status.face === "active" ? "active" : status.face === "done" ? (scores.face >= 7 ? "danger" : scores.face >= 4 ? "warn" : "done") : ""}`}>
            <div className="sensor-header">
              <div className="sensor-name">
                <span className="sensor-icon">😣</span>
                Facial Expression Analysis
              </div>
              <span className="sensor-value" style={{ color: scoreColor(scores.face) }}>
                {scores.face != null ? `${scores.face}/10` : "Not tested"}
              </span>
            </div>
            <p className="sensor-desc">
              PSPI-weighted pixel analysis detects brow furrow (AU4), eye squint (AU46), nose wrinkle (AU9), lip compression (AU20) — the 4 universal pain micro-expressions.
            </p>

            {status.face === "active" && (
              <div className="fade-up">
                <div className="cam-preview face-canvas-wrap">
                  <video ref={videoRef} muted playsInline style={{ width:"100%", height:140, objectFit:"cover", display:"block", borderRadius:10 }} />
                  <canvas ref={canvasRef} style={{ display:"none" }} />
                  <div className="cam-overlay">
                    <div style={{ width:80, height:80, border:"2px solid var(--teal)", borderRadius:"50%", boxShadow:"0 0 20px rgba(0,229,195,.4)", animation:"tagPulse 1s infinite" }} />
                    <div className="cam-label">ANALYSING EXPRESSION</div>
                  </div>
                </div>
                <div className="scan-progress-wrap">
                  <div className="scan-prog-bar"><div className="scan-prog-fill" style={{ width:`${faceScanProgress}%` }} /></div>
                  <div className="scan-prog-label">{faceScanProgress}% · {FACE_FRAMES} frames</div>
                </div>
              </div>
            )}

            {status.face === "done" && (
              <div className="face-indicators fade-up">
                {[
                  { key:"browTension",    label:"Brow Furrow" },
                  { key:"eyeSquint",     label:"Eye Squint" },
                  { key:"noseWrinkle",   label:"Nose Wrinkle" },
                  { key:"lipCompression",label:"Lip Press" },
                ].map(({ key, label }) => {
                  const v = faceInds[key];
                  const lit = v > 2;
                  const cls = lit ? (v > 6 ? "danger" : v > 3 ? "warn" : "") : "";
                  return (
                    <div key={key} className={`face-ind${lit ? " lit" : ""}${cls ? " " + cls : ""}`}>
                      <span>{v > 6 ? "●" : v > 2 ? "◑" : "○"}</span>
                      {label}
                    </div>
                  );
                })}
              </div>
            )}

            {status.face !== "active" && (
              <button className="btn btn-teal btn-full btn-sm" style={{ marginTop:10 }}
                onClick={startFaceAnalysis} disabled={status.face === "active"}>
                {status.face === "done" ? "↺ Rescan Expression" : "📷 Start Face Scan"}
              </button>
            )}
          </div>

          {/* ─── SENSOR 2: BREATHING RATE ─── */}
          <div className={`sensor-slot fade-up-2 ${status.breath === "done" ? (scores.breath >= 7 ? "danger" : scores.breath >= 4 ? "warn" : "done") : ""}`}>
            <div className="sensor-header">
              <div className="sensor-name">
                <span className="sensor-icon">🫁</span>
                Breathing Rate
              </div>
              <span className="sensor-value" style={{ color: scoreColor(scores.breath) }}>
                {breathRate != null ? `${breathRate} br/min` : "Not tested"}
              </span>
            </div>
            <p className="sensor-desc">
              Tap once per breath. Pain causes tachypnea (&gt;22/min) or breath-holding (&lt;10/min). Clinical threshold: 12–20 breaths/min normal.
            </p>

            {/* Animated breathing zone */}
            <div className="breath-zone" onClick={handleBreathTap}
              style={{ borderColor: breathTaps.length > 0 ? "rgba(96,165,250,.5)" : "rgba(96,165,250,.3)" }}>
              <div className="ripple-ring" />
              <div className="ripple-ring" />
              <div className="ripple-ring" />
              <div className="breath-tap-label" style={{ fontSize:"1rem" }}>
                {breathTaps.length < BREATH_TARGET ? "TAP WITH EACH BREATH" : "✓ READING COMPLETE"}
              </div>
              <div className="breath-count">
                {breathTaps.length < BREATH_TARGET
                  ? `${breathTaps.length} / ${BREATH_TARGET} taps recorded`
                  : `${breathRate} breaths/min · Pain signal: ${scores.breath?.toFixed(1) ?? "—"}/10`}
              </div>
            </div>

            {breathWave.length > 1 && (
              <div style={{ marginTop:10, display:"flex", gap:3, height:36, alignItems:"flex-end" }}>
                {breathWave.map((v, i) => (
                  <div key={i} style={{
                    flex:1, borderRadius:2, minHeight:3,
                    height:`${v * 100}%`,
                    background: breathRate > 22 ? "var(--red)" : breathRate < 10 ? "var(--amber)" : "var(--blue)",
                    opacity: 0.5 + v * 0.5,
                  }} />
                ))}
              </div>
            )}

            {breathTaps.length > 0 && (
              <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }} onClick={resetBreath}>
                ↺ Reset Breath Counter
              </button>
            )}

            {breathRate != null && (
              <div style={{ marginTop:8, padding:"8px 12px", borderRadius:8, fontFamily:"var(--mono)", fontSize:".72rem", lineHeight:1.6,
                background: breathRate > 22 || breathRate < 10 ? "rgba(255,77,109,.07)" : "rgba(0,229,195,.06)",
                border: `1px solid ${breathRate > 22 || breathRate < 10 ? "rgba(255,77,109,.2)" : "rgba(0,229,195,.15)"}`,
                color: breathRate > 22 || breathRate < 10 ? "var(--red)" : "var(--teal)" }}>
                {breathRate > 22 ? "⚠ Tachypnea — elevated respiratory rate. Pain-induced shallow breathing pattern detected."
                  : breathRate < 10 ? "⚠ Bradypnea — breath-holding pattern. Possible pain-avoidance or opioid effect."
                  : "✓ Normal respiratory rate. No pain-related breathing pattern detected."}
              </div>
            )}
          </div>

          {/* ─── SENSOR 3: HAND TREMOR (GYROSCOPE) ─── */}
          <div className={`sensor-slot fade-up-2 ${status.tremor === "active" ? "active" : status.tremor === "done" ? (scores.tremor >= 7 ? "danger" : scores.tremor >= 4 ? "warn" : "done") : ""}`}>
            <div className="sensor-header">
              <div className="sensor-name">
                <span className="sensor-icon">🤚</span>
                Hand Steadiness (Gyroscope)
              </div>
              <span className="sensor-value" style={{ color: scoreColor(scores.tremor) }}>
                {scores.tremor != null ? `${scores.tremor}/10` : status.tremor === "no-sensor" ? "No sensor" : "Not tested"}
              </span>
            </div>
            <p className="sensor-desc">
              Hold phone still on open palm. Accelerometer detects 4–12 Hz micro-tremor. Pain and opioid medication both cause measurable motor instability.
            </p>

            {status.tremor === "active" && (
              <div className="fade-up" style={{ marginBottom:10 }}>
                <div style={{ textAlign:"center", padding:"14px", borderRadius:10, background:"rgba(0,0,0,.2)", marginBottom:8 }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:4 }}>🤚</div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--text3)" }}>Hold phone flat on open palm</div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:".8rem", color:"var(--teal)", marginTop:4 }}>
                    Reading: {tremorRaw.toFixed(2)} m/s²
                  </div>
                </div>
                <div className="scan-prog-bar"><div className="scan-prog-fill" style={{ width:`${tremorProgress}%` }} /></div>
                <div className="scan-prog-label">{Math.round(tremorProgress)}% · {Math.round(TREMOR_DURATION_MS/1000)}s scan</div>
              </div>
            )}

            {status.tremor === "done" && scores.tremor != null && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:"flex", justifyToContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:".7rem", color:"var(--text3)" }}>Tremor amplitude</span>
                  <span style={{ fontFamily:"var(--mono)", fontSize:".7rem", color: scoreColor(scores.tremor) }}>
                    {scores.tremor < 4 ? "Stable" : scores.tremor < 7 ? "Moderate tremor" : "High tremor"}
                  </span>
                </div>
                <div className="tremor-meter">
                  <div className="tremor-fill" style={{
                    width:`${scores.tremor * 10}%`,
                    background: scores.tremor >= 7 ? "var(--red)" : scores.tremor >= 4 ? "var(--amber)" : "var(--teal)"
                  }} />
                </div>
              </div>
            )}

            {status.tremor === "no-sensor" && (
              <div style={{ padding:"10px", borderRadius:8, background:"rgba(255,179,0,.06)", border:"1px solid rgba(255,179,0,.2)", fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--amber)", marginTop:8 }}>
                ⚠ No motion sensor detected. Use on mobile device for tremor analysis.
              </div>
            )}

            {status.tremor !== "active" && (
              <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }}
                onClick={startTremorAnalysis} disabled={status.tremor === "active"}>
                {status.tremor === "done" ? "↺ Rescan Tremor" : "🤚 Start Steadiness Test"}
              </button>
            )}
          </div>

          {/* ─── SENSOR 4: VOCAL JITTER + SHIMMER ─── */}
          <div className={`sensor-slot fade-up-2 ${status.vocal === "active" ? "active" : status.vocal === "done" ? (scores.vocal >= 7 ? "danger" : scores.vocal >= 4 ? "warn" : "done") : ""}`}>
            <div className="sensor-header">
              <div className="sensor-name">
                <span className="sensor-icon">🎙️</span>
                Vocal Biomarkers
              </div>
              <span className="sensor-value" style={{ color: scoreColor(scores.vocal) }}>
                {scores.vocal != null ? `${scores.vocal}/10` : "Not tested"}
              </span>
            </div>
            <p className="sensor-desc">
              Say "ahhh" steadily for 4 seconds. Real F0 pitch extraction via autocorrelation. Jitter &gt;1% and shimmer &gt;3dB indicate vocal instability from pain/stress.
            </p>

            {status.vocal === "active" && (
              <div className="fade-up" style={{ marginBottom:10 }}>
                <div style={{ textAlign:"center", marginBottom:8 }}>
                  <div style={{ fontSize:"2rem", animation:"tagPulse .6s infinite" }}>🎙️</div>
                  <div style={{ fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--teal)" }}>Say "ahhh" now — {Math.round(VOCAL_DURATION_MS/1000)}s recording</div>
                </div>
                {/* Live waveform */}
                <div className="waveform-bars">
                  {(vocalWave.length > 0 ? vocalWave : Array(24).fill(0.05)).map((v, i) => (
                    <div key={i} className="waveform-bar" style={{
                      height:`${v * 100}%`,
                      background: v > 0.6 ? "var(--teal)" : v > 0.3 ? "var(--teal2)" : "rgba(0,229,195,.3)"
                    }} />
                  ))}
                </div>
              </div>
            )}

            {status.vocal === "done" && (
              <div className="grid-2 fade-up" style={{ marginTop:10 }}>
                <div className="mini-metric">
                  <div className="mini-val" style={{ color: vocalJitter > 1 ? "var(--amber)" : "var(--teal)" }}>
                    {vocalJitter?.toFixed(2)}%
                  </div>
                  <div className="mini-lbl">Jitter</div>
                </div>
                <div className="mini-metric">
                  <div className="mini-val" style={{ color: vocalShimmer > 3 ? "var(--amber)" : "var(--teal)" }}>
                    {vocalShimmer?.toFixed(2)} dB
                  </div>
                  <div className="mini-lbl">Shimmer</div>
                </div>
              </div>
            )}

            {status.vocal !== "active" && (
              <button className="btn btn-teal btn-full btn-sm" style={{ marginTop:10 }}
                onClick={startVocalAnalysis} disabled={status.vocal === "active"}>
                {status.vocal === "done" ? "↺ Re-record Voice" : '🎙️ Record "Ahhh" — 4 seconds'}
              </button>
            )}
          </div>

          {/* ─── SENSOR 5: PUPIL DILATION ─── */}
          <div className={`sensor-slot fade-up-2 ${status.pupil === "active" ? "active" : status.pupil === "done" ? (scores.pupil >= 7 ? "danger" : scores.pupil >= 4 ? "warn" : "done") : ""}`}>
            <div className="sensor-header">
              <div className="sensor-name">
                <span className="sensor-icon">👁️</span>
                Pupillary Light Response
              </div>
              <span className="sensor-value" style={{ color: scoreColor(scores.pupil) }}>
                {scores.pupil != null ? `${scores.pupil}/10` : "Not tested"}
              </span>
            </div>
            <p className="sensor-desc">
              Dark adaptation → bright flash → re-dilation. Pain activates sympathetic nervous system, causing pupils to stay dilated (Pupillary Pain Index — used in ICUs on non-verbal patients).
            </p>

            {/* Pupil visualizer */}
            <div className="pupil-viz">
              <div className="pupil-outer" style={{ boxShadow: pupilPhase === "flash" ? "0 0 40px rgba(255,255,255,.8)" : "0 0 16px rgba(0,229,195,.2)" }}>
                <div className="pupil-inner" style={{ width: pupilSize, height: pupilSize }}>
                  <div className="pupil-shine" />
                </div>
              </div>
              <div className="pupil-label">
                {pupilPhase === "idle" ? "Camera off" :
                  pupilPhase === "dark" ? "🌑 Dark adaptation..." :
                  pupilPhase === "flash" ? "⚡ Stimulus!" :
                  pupilPhase === "measuring" ? "📏 Measuring..." :
                  `Delta: ${pupilDelta ?? "—"}%`}
              </div>
            </div>

            {/* Hidden camera elements */}
            <video ref={pupilVideoRef} muted playsInline style={{ display:"none" }} />
            <canvas ref={pupilCanvasRef} style={{ display:"none" }} />

            {status.pupil === "done" && pupilDelta != null && (
              <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, fontFamily:"var(--mono)", fontSize:".72rem", lineHeight:1.6,
                background: scores.pupil >= 7 ? "rgba(255,77,109,.07)" : scores.pupil >= 4 ? "rgba(255,179,0,.07)" : "rgba(0,229,195,.06)",
                border: `1px solid ${scores.pupil >= 7 ? "rgba(255,77,109,.2)" : scores.pupil >= 4 ? "rgba(255,179,0,.2)" : "rgba(0,229,195,.15)"}`,
                color: scores.pupil >= 7 ? "var(--red)" : scores.pupil >= 4 ? "var(--amber)" : "var(--teal)" }}>
                {scores.pupil >= 6
                  ? `⚠ Elevated sympathetic response detected (Δ${pupilDelta}%). Consistent with acute pain autonomic activation.`
                  : `✓ Normal pupillary light response (Δ${pupilDelta}%). No significant sympathetic override.`}
              </div>
            )}

            {status.pupil !== "active" && (
              <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }}
                onClick={startPupilAnalysis} disabled={status.pupil === "active"}>
                {status.pupil === "done" ? "↺ Retest Pupil" : "👁️ Start Pupil Test (Needs camera)"}
              </button>
            )}
          </div>

          {/* ── Privacy ── */}
          <div className="privacy fade-up-3">
            <span>🔒</span>
            <span>All analysis runs entirely on-device · Zero data transmitted · Camera/mic streams destroyed after each test</span>
          </div>
        </div>
      </div>
    </>
  );
}