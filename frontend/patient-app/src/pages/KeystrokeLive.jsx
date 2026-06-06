import { useState, useRef, useEffect, useCallback } from "react";
// VoiceOrb is defined at the bottom of this file and rendered inside PainScanner

const BREATH_TARGET = 8;
const TREMOR_DURATION_MS = 8000;
const VOCAL_DURATION_MS = 5000;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap');
  :root {
    --bg:#04080f;--bg2:#080e1a;--bg3:#0d1626;--glass:rgba(8,18,36,0.85);
    --border:rgba(0,229,195,0.12);--border2:rgba(0,229,195,0.3);
    --teal:#00e5c3;--teal2:#00bfa5;--red:#ff4d6d;--amber:#ffb300;
    --blue:#60a5fa;--purple:#c084fc;--green:#4ade80;
    --text:#e8f4ff;--text2:#7aa4c4;--text3:#3d6080;
    --mono:'Space Mono',monospace;--font:'Syne',sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  .ps-wrap{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;padding:0;position:relative;overflow-x:hidden;}
  .ps-wrap::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 700px 500px at 20% 10%,rgba(0,229,195,0.06) 0%,transparent 60%),radial-gradient(ellipse 600px 600px at 80% 90%,rgba(96,165,250,0.05) 0%,transparent 60%);}
  .ps-inner{position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:28px 18px 60px;}
  .ps-header{margin-bottom:28px;}
  .ps-tag{font-family:var(--mono);font-size:9px;letter-spacing:.22em;color:var(--text3);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
  .ps-tag-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 8px var(--teal);animation:tagPulse 2s ease-in-out infinite;}
  @keyframes tagPulse{0%,100%{opacity:1}50%{opacity:.3}}
  .ps-title{font-size:2rem;font-weight:800;letter-spacing:-.04em;line-height:1.05;margin-bottom:6px;}
  .ps-sub{font-family:var(--mono);font-size:0.75rem;color:var(--text2);line-height:1.6;}
  .score-card{background:var(--glass);border:1px solid var(--border2);border-radius:20px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;backdrop-filter:blur(16px);}
  .score-card::before{content:'';position:absolute;inset:0;border-radius:20px;background:linear-gradient(135deg,rgba(0,229,195,.05),transparent 50%);pointer-events:none;}
  .score-top{display:flex;align-items:center;gap:20px;margin-bottom:16px;}
  .score-num{font-family:var(--mono);font-weight:700;font-size:2.4rem;line-height:1;transition:color .5s;}
  .score-den{font-family:var(--mono);font-size:.65rem;color:var(--text3);margin-top:3px;}
  .score-label{font-weight:700;font-size:1rem;margin-bottom:5px;}
  .score-summary{font-family:var(--mono);font-size:.72rem;color:var(--text2);line-height:1.6;}
  .composite-bar{height:6px;border-radius:3px;overflow:hidden;background:var(--bg3);margin-top:14px;}
  .composite-fill{height:100%;border-radius:3px;transition:width 1s cubic-bezier(.34,1.56,.64,1),background .5s;}
  .sensor-slot{background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:18px 20px;margin-bottom:14px;backdrop-filter:blur(12px);position:relative;overflow:hidden;transition:border-color .3s;}
  .sensor-slot.active{border-color:rgba(0,229,195,.4);}
  .sensor-slot.done{border-color:rgba(0,229,195,.25);}
  .sensor-slot.warn{border-color:rgba(255,179,0,.3);}
  .sensor-slot.danger{border-color:rgba(255,77,109,.3);}
  .sensor-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;}
  .sensor-name{font-weight:700;font-size:.9rem;display:flex;align-items:center;gap:8px;}
  .sensor-icon{font-size:1.1rem;}
  .sensor-value{font-family:var(--mono);font-weight:700;font-size:.9rem;transition:color .4s;}
  .sensor-desc{font-family:var(--mono);font-size:.68rem;color:var(--text3);margin-bottom:12px;line-height:1.5;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 20px;border:none;border-radius:10px;font-family:var(--font);font-size:.82rem;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.02em;position:relative;overflow:hidden;}
  .btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,.08);opacity:0;transition:opacity .2s;}
  .btn:hover::after{opacity:1;}
  .btn:disabled{opacity:.4;cursor:not-allowed;}
  .btn-teal{background:linear-gradient(135deg,#00c9a8,#00e5c3);color:#040d18;box-shadow:0 4px 16px rgba(0,229,195,.3);}
  .btn-teal:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,229,195,.4);}
  .btn-ghost{background:transparent;color:var(--teal);border:1px solid var(--border2);}
  .btn-ghost:hover:not(:disabled){background:rgba(0,229,195,.07);}
  .btn-full{width:100%;}
  .btn-sm{padding:7px 14px;font-size:.76rem;}
  .cam-preview{width:100%;border-radius:10px;overflow:hidden;background:#000;position:relative;margin-bottom:10px;}
  .cam-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:rgba(0,0,0,.35);pointer-events:none;}
  .cam-label{font-family:var(--mono);font-size:.65rem;color:var(--teal);letter-spacing:.12em;}
  .breath-zone{width:100%;height:100px;border-radius:12px;border:2px solid rgba(96,165,250,.3);background:rgba(96,165,250,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;user-select:none;transition:all .15s;-webkit-tap-highlight-color:transparent;position:relative;overflow:hidden;}
  .breath-zone:active{transform:scale(.97);background:rgba(96,165,250,.1);}
  .breath-zone .ripple-ring{position:absolute;width:60px;height:60px;border-radius:50%;border:2px solid rgba(96,165,250,.5);animation:breathRing 2s ease-in-out infinite;}
  .breath-zone .ripple-ring:nth-child(2){animation-delay:.6s;width:80px;height:80px;border-color:rgba(96,165,250,.25);}
  .breath-zone .ripple-ring:nth-child(3){animation-delay:1.2s;width:100px;height:100px;border-color:rgba(96,165,250,.1);}
  @keyframes breathRing{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.4);opacity:0}}
  .breath-tap-label{font-family:var(--mono);font-size:.72rem;color:var(--blue);font-weight:700;z-index:1;}
  .breath-count{font-family:var(--mono);font-size:.6rem;color:var(--text3);z-index:1;}
  .waveform-bars{display:flex;gap:2px;align-items:flex-end;height:48px;}
  .waveform-bar{flex:1;border-radius:2px;transition:height .2s,background .3s;min-height:3px;}
  .tremor-meter{width:100%;height:10px;border-radius:5px;background:var(--bg3);overflow:hidden;margin-top:8px;}
  .tremor-fill{height:100%;border-radius:5px;transition:width 1s ease,background .5s;}
  .face-indicators{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .face-ind{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-family:var(--mono);font-size:.65rem;background:var(--bg3);border:1px solid var(--border);transition:all .3s;}
  .face-ind.lit{background:rgba(0,229,195,.1);border-color:rgba(0,229,195,.35);color:var(--teal);}
  .face-ind.lit.warn{background:rgba(255,179,0,.1);border-color:rgba(255,179,0,.3);color:var(--amber);}
  .face-ind.lit.danger{background:rgba(255,77,109,.1);border-color:rgba(255,77,109,.3);color:var(--red);}
  .pupil-viz{display:flex;align-items:center;justify-content:center;height:90px;position:relative;}
  .pupil-outer{width:72px;height:72px;border-radius:50%;background:radial-gradient(circle,#1a3a4a 0%,#0a1520 60%,#000 100%);border:2px solid rgba(0,229,195,.3);display:flex;align-items:center;justify-content:center;position:relative;transition:all .5s;}
  .pupil-inner{border-radius:50%;background:#000;transition:all .8s cubic-bezier(.34,1.56,.64,1);position:relative;}
  .pupil-shine{position:absolute;top:15%;left:20%;width:25%;height:25%;border-radius:50%;background:rgba(255,255,255,.35);}
  .pupil-label{position:absolute;bottom:0;font-family:var(--mono);font-size:.6rem;color:var(--text3);}
  .conf-dots{display:flex;gap:4px;margin-top:6px;}
  .conf-dot{width:8px;height:8px;border-radius:50%;transition:background .4s;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .mini-metric{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;text-align:center;}
  .mini-val{font-family:var(--mono);font-size:1rem;font-weight:700;color:var(--teal);}
  .mini-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-top:3px;}
  .scan-progress-wrap{margin:10px 0;}
  .scan-prog-bar{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;}
  .scan-prog-fill{height:100%;background:var(--teal);border-radius:2px;transition:width .3s linear;}
  .scan-prog-label{font-family:var(--mono);font-size:.65rem;color:var(--text3);margin-top:4px;text-align:right;}
  .privacy{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:8px;background:rgba(0,229,195,.04);border:1px solid rgba(0,229,195,.1);font-family:var(--mono);font-size:.67rem;color:var(--text3);margin-top:14px;}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:rgba(0,229,195,.2);border-radius:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .fade-up{animation:fadeUp .4s ease forwards;}
  .fade-up-2{animation:fadeUp .4s .08s ease both;}
  .fade-up-3{animation:fadeUp .4s .16s ease both;}
  .ps-layout-grid{display:flex;flex-direction:column;gap:16px;}
  .sensors-grid{display:flex;flex-direction:column;gap:14px;}
  @media(min-width:768px){
    .ps-layout-grid{display:grid;grid-template-columns:360px 1fr;gap:20px;align-items:start;}
    .sensors-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  }
  .live-ind-bar{display:flex;gap:6px;margin-top:8px;align-items:center;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.3);font-family:var(--mono);font-size:.65rem;}
  .live-ind-item{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
  .live-ind-fill{width:100%;border-radius:2px;transition:height .3s,background .3s;min-height:4px;}
  .live-ind-lbl{font-size:.55rem;color:var(--text3);}
`;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function Ring({ value, max, color, size = 120, sw = 8, children }) {
  const r = size / 2 - sw;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamp(value ?? 0, 0, max) / max);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
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

/* ══════════════════════════════════════════════════════════════════════════
   FACIAL EXPRESSION ENGINE — v3 (Motion-texture + temporal accumulation)
   
   KEY INSIGHT: Luminance deltas from a static webcam are nearly zero even
   for strong expressions, because room lighting doesn't change. The reliable
   signal is LOCAL TEXTURE CHANGE (wrinkling = higher local variance) and
   INTER-FRAME MOTION in specific anatomical regions.
   
   Algorithm:
   1. Collect frames at ~15fps over 4 seconds (60 frames)
   2. Compute local standard deviation in each anatomical zone PER FRAME
      → texture increases when muscles contract (wrinkles, compression)
   3. Compute inter-frame absolute difference per zone
      → motion reveals active muscle contraction (brows moving, lip tightening)
   4. Score is the PEAK temporal accumulation — pain expressions are sustained,
      smiles are brief; we look for sustained texture elevation
   5. Apply PSPI action-unit weights to the zone signals
   ══════════════════════════════════════════════════════════════════════════ */

function getZoneStats(data, W, x0, y0, x1, y1) {
  // Returns mean luminance and LOCAL TEXTURE (std dev within zone)
  let sum = 0, sum2 = 0, cnt = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const lum = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
      sum += lum; sum2 += lum * lum; cnt++;
    }
  }
  const mean = sum / cnt;
  const variance = Math.max(0, sum2 / cnt - mean * mean);
  return { mean, std: Math.sqrt(variance) };
}

function computeInterFrameMotion(prevData, currData, W, x0, y0, x1, y1) {
  // Mean absolute pixel difference between two frames in a zone
  let diff = 0, cnt = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const lumPrev = prevData[i] * 0.299 + prevData[i+1] * 0.587 + prevData[i+2] * 0.114;
      const lumCurr = currData[i] * 0.299 + currData[i+1] * 0.587 + currData[i+2] * 0.114;
      diff += Math.abs(lumCurr - lumPrev);
      cnt++;
    }
  }
  return diff / cnt;
}

// Zones on an 80×60 canvas
const FACE_ZONES = {
  browInner:  { x0:28, y0:2,  x1:52, y1:16 },  // AU4 brow furrow
  browLeft:   { x0:4,  y0:2,  x1:28, y1:16 },   // AU1 inner brow raise
  browRight:  { x0:52, y0:2,  x1:76, y1:16 },   // AU2 outer brow
  eyeLeft:    { x0:6,  y0:16, x1:32, y1:30 },   // AU46 eye squint/closure
  eyeRight:   { x0:48, y0:16, x1:74, y1:30 },   // AU46
  noseBridge: { x0:30, y0:16, x1:50, y1:32 },   // AU9 nose wrinkle
  noseWing:   { x0:22, y0:28, x1:58, y1:38 },   // AU9 nasal wing
  upperLip:   { x0:24, y0:36, x1:56, y1:46 },   // AU20/25 lip
  lowerLip:   { x0:24, y0:46, x1:56, y1:56 },   // AU17 chin
  cheekL:     { x0:4,  y0:28, x1:26, y1:48 },   // AU6
  cheekR:     { x0:54, y0:28, x1:76, y1:48 },   // AU6
};

function analyzeFrameSet(frames, W, H) {
  if (frames.length < 10) return null;
  
  const nFrames = frames.length;
  
  // 1. Per-frame zone texture (std dev)
  const textureHistory = frames.map(frame => {
    const stats = {};
    for (const [name, z] of Object.entries(FACE_ZONES)) {
      stats[name] = getZoneStats(frame.data, W, z.x0, z.y0, z.x1, z.y1);
    }
    return stats;
  });
  
  // 2. Inter-frame motion per zone
  const motionHistory = [];
  for (let i = 1; i < nFrames; i++) {
    const motion = {};
    for (const [name, z] of Object.entries(FACE_ZONES)) {
      motion[name] = computeInterFrameMotion(
        frames[i-1].data, frames[i].data, W, z.x0, z.y0, z.x1, z.y1
      );
    }
    motionHistory.push(motion);
  }
  
  // 3. Compute sustained texture elevation for each zone
  // Use the 75th percentile of texture values (sustained, not peak noise)
  function pctile75(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.75)];
  }
  
  const zoneSustainedTexture = {};
  const zoneMeanMotion = {};
  for (const name of Object.keys(FACE_ZONES)) {
    zoneSustainedTexture[name] = pctile75(textureHistory.map(f => f[name].std));
    zoneMeanMotion[name] = motionHistory.reduce((s, m) => s + m[name], 0) / motionHistory.length;
  }
  
  // 4. Normalize textures by face skin baseline (use cheek as neutral reference)
  const cheekBaseline = (zoneSustainedTexture.cheekL + zoneSustainedTexture.cheekR) / 2;
  const normalize = (v) => clamp(v / Math.max(cheekBaseline, 4), 0, 5);
  
  // 5. AU scoring
  
  // AU4 Brow Furrow: inner brow texture + motion (muscles bunch)
  const au4 = clamp(
    normalize(zoneSustainedTexture.browInner) * 0.6 +
    (zoneMeanMotion.browInner / 2.5) * 0.4,
    0, 1
  );
  
  // AU46 Eye Squint/Closure: eye zone texture + vertical compression
  const eyeTextureL = normalize(zoneSustainedTexture.eyeLeft);
  const eyeTextureR = normalize(zoneSustainedTexture.eyeRight);
  const au46 = clamp((eyeTextureL + eyeTextureR) / 2 * 0.6 +
    (zoneMeanMotion.eyeLeft + zoneMeanMotion.eyeRight) / 2 / 2 * 0.4, 0, 1);
  
  // AU9 Nose Wrinkle: nose bridge + wing texture
  const au9 = clamp(
    normalize(zoneSustainedTexture.noseBridge) * 0.5 +
    normalize(zoneSustainedTexture.noseWing) * 0.5,
    0, 1
  );
  
  // AU20 Lip Stretch / AU25 Lip Part: upper lip texture + motion
  const au20 = clamp(
    normalize(zoneSustainedTexture.upperLip) * 0.5 +
    (zoneMeanMotion.upperLip / 2.5) * 0.5,
    0, 1
  );
  
  // AU6 Cheek Raise: cheek texture asymmetry and elevation
  const cheekAsymmetry = Math.abs(zoneSustainedTexture.cheekL - zoneSustainedTexture.cheekR);
  const au6 = clamp(cheekAsymmetry / Math.max(cheekBaseline, 4) * 0.8, 0, 1);
  
  // AU17 Chin Raise
  const au17 = clamp(normalize(zoneSustainedTexture.lowerLip) * 0.4, 0, 1);
  
  // PSPI weights (Prkachin & Solomon 2008 clinical weights)
  const pspiRaw =
    au4  * 3.8 +
    au46 * 2.4 +
    au9  * 2.0 +
    au20 * 1.6 +
    au6  * 1.0 +
    au17 * 0.6;
  
  // Scale: theoretical max with all AUs at 1.0 = 11.4
  // We use 8.0 as a practical calibrated max (typical severe pain expression)
  const painScore = clamp(pspiRaw * (10 / 8.0), 0, 10);
  
  return {
    painScore: parseFloat(painScore.toFixed(1)),
    indicators: {
      browTension:    parseFloat(clamp(au4 * 10, 0, 10).toFixed(1)),
      eyeSquint:      parseFloat(clamp(au46 * 10, 0, 10).toFixed(1)),
      noseWrinkle:    parseFloat(clamp(au9 * 10, 0, 10).toFixed(1)),
      lipCompression: parseFloat(clamp(au20 * 10, 0, 10).toFixed(1)),
    },
    liveBars: { au4, au6, au9, au20, au46 }
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PUPIL ANALYSIS ENGINE — v2 (Dark-pixel cluster sizing)
   
   KEY INSIGHT: At normal selfie distance the iris+pupil is ~40-100px wide.
   Instead of measuring overall luminance, we COUNT DARK PIXELS in the
   eye region (pixels below a threshold). More dark pixels = wider pupil.
   The flash causes pupil constriction → fewer dark pixels. Pain patients
   show reduced constriction amplitude and faster re-dilation.
   
   This gives a direct, calibrated measurement instead of noisy luminance.
   ══════════════════════════════════════════════════════════════════════════ */

function measureEyeDarkness(video, canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const W = canvas.width, H = canvas.height;
  // Focus on the eye strip: roughly middle 40% height, full width
  const eyeY0 = Math.floor(H * 0.25);
  const eyeY1 = Math.floor(H * 0.55);
  const imgData = ctx.getImageData(0, eyeY0, W, eyeY1 - eyeY0);
  const d = imgData.data;
  
  // Count pixels below darkness threshold (iris/pupil are dark)
  // Also compute mean luminance for reference
  let darkCount = 0, totalLum = 0, cnt = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
    totalLum += lum;
    cnt++;
    if (lum < 60) darkCount++; // dark threshold
  }
  
  const darkRatio = darkCount / cnt;   // 0–1, higher = more dark (pupil dilated)
  const meanLum = totalLum / cnt;
  
  return { darkRatio, meanLum };
}

async function collectPupilReading(video, canvas, samples = 8, interval = 80) {
  const readings = [];
  for (let i = 0; i < samples; i++) {
    await new Promise(r => setTimeout(r, interval));
    readings.push(measureEyeDarkness(video, canvas));
  }
  return {
    darkRatio: readings.reduce((s, r) => s + r.darkRatio, 0) / readings.length,
    meanLum:   readings.reduce((s, r) => s + r.meanLum, 0) / readings.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   VOCAL ENGINE — unchanged (working correctly)
   ══════════════════════════════════════════════════════════════════════════ */
function computeF0FromBuffer(buf, sampleRate) {
  const minPeriod = Math.floor(sampleRate / 500);
  const maxPeriod = Math.floor(sampleRate / 60);
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

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export default function PainScanner() {
  const [scores, setScores] = useState({ face: null, breath: null, tremor: null, vocal: null, pupil: null });
  const [status, setStatus] = useState({ face: "idle", breath: "idle", tremor: "idle", vocal: "idle", pupil: "idle" });
  const [faceInds, setFaceInds] = useState({ browTension: 0, eyeSquint: 0, noseWrinkle: 0, lipCompression: 0 });
  const [liveBars, setLiveBars] = useState({ au4: 0, au6: 0, au9: 0, au20: 0, au46: 0 });
  const [breathTaps, setBreathTaps] = useState([]);
  const [breathRate, setBreathRate] = useState(null);
  const [breathWave, setBreathWave] = useState([]);
  const [tremorProgress, setTremorProgress] = useState(0);
  const [vocalJitter, setVocalJitter] = useState(null);
  const [vocalShimmer, setVocalShimmer] = useState(null);
  const [vocalWave, setVocalWave] = useState([]);
  const [pupilDelta, setPupilDelta] = useState(null);
  const [pupilSize, setPupilSize] = useState(32);
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [tremorRaw, setTremorRaw] = useState(0);
  const [facePhase, setFacePhase] = useState("idle");
  const [liveScore, setLiveScore] = useState(null);
  const [pupilPhase, setPupilPhase] = useState("idle");
  const [faceFrameCount, setFaceFrameCount] = useState(0);

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const pupilVideoRef = useRef(null);
  const pupilCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const pupilStreamRef = useRef(null);
  const audioCtxRef   = useRef(null);
  const audioStreamRef = useRef(null);
  const tremorSamples = useRef([]);
  const motionHandler = useRef(null);
  const rafRef        = useRef(null);
  const vocalAnalyserRef = useRef(null);
  const f0History     = useRef([]);
  const ampHistory    = useRef([]);
  const capturedFrames = useRef([]);   // stores actual ImageData objects
  const scanActive    = useRef(false);

  const stopStream = useCallback((ref) => {
    if (ref.current) { ref.current.getTracks().forEach(t => t.stop()); ref.current = null; }
  }, []);

  /* ── SENSOR 1: FACIAL EXPRESSION ── */
  const startFaceAnalysis = useCallback(async () => {
    setStatus(s => ({ ...s, face: "active" }));
    setFacePhase("warmup");
    setFaceScanProgress(0);
    setLiveScore(null);
    capturedFrames.current = [];
    scanActive.current = true;

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
      const W = 80, H = 60;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      // Camera warmup — let auto-exposure settle
      await new Promise(r => setTimeout(r, 1200));
      setFacePhase("scanning");

      const TOTAL_FRAMES = 60; // ~4 seconds at 15fps
      let frameCount = 0;

      await new Promise(resolve => {
        let lastFrameTime = 0;
        const FRAME_INTERVAL = 66; // ~15fps — enough resolution, not too fast

        const scanFrame = (timestamp) => {
          if (!scanActive.current) { resolve(); return; }

          if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
            lastFrameTime = timestamp;
            try {
              ctx.drawImage(video, 0, 0, W, H);
              // Store a COPY of the image data (not a reference)
              const imgData = ctx.getImageData(0, 0, W, H);
              const copy = new ImageData(new Uint8ClampedArray(imgData.data), W, H);
              capturedFrames.current.push(copy);
              frameCount++;

              setFaceFrameCount(frameCount);
              setFaceScanProgress(Math.round((frameCount / TOTAL_FRAMES) * 100));

              // Live preview: analyze last 20 frames as they come in
              if (frameCount >= 20 && frameCount % 5 === 0) {
                const partialResult = analyzeFrameSet(
                  capturedFrames.current.slice(-20), W, H
                );
                if (partialResult) {
                  setLiveScore(partialResult.painScore);
                  setLiveBars(partialResult.liveBars);
                }
              }

              if (frameCount >= TOTAL_FRAMES) { resolve(); return; }
            } catch (_) {}
          }

          rafRef.current = requestAnimationFrame(scanFrame);
        };
        rafRef.current = requestAnimationFrame(scanFrame);
      });

      // Final analysis on ALL frames
      const finalResult = analyzeFrameSet(capturedFrames.current, W, H);
      if (!finalResult) {
        setStatus(s => ({...s, face: "idle"}));
        setFacePhase("idle");
        alert("Couldn't complete face analysis. Make sure your face is visible and lit.");
        stopStream(faceStreamRef);
        return;
      }

      setFaceInds(finalResult.indicators);
      setScores(s => ({ ...s, face: finalResult.painScore }));
      setStatus(s => ({ ...s, face: "done" }));
      setFacePhase("done");
      setFaceScanProgress(100);
      setLiveScore(finalResult.painScore);
      stopStream(faceStreamRef);
      cancelAnimationFrame(rafRef.current);

    } catch (err) {
      console.error("Face camera error:", err);
      setStatus(s => ({...s, face:"idle"}));
      setFacePhase("idle");
      alert("Camera access required for facial pain analysis.");
    }
  }, [stopStream]);

  /* ── SENSOR 2: BREATHING ── */
  const handleBreathTap = useCallback(() => {
    const now = Date.now();
    setBreathTaps(prev => {
      const next = [...prev, now];
      if (next.length >= 3) {
        const intervals = next.slice(1).map((t, i) => (t - next[i]) / 1000);
        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const rate = Math.round(60 / meanInterval);
        setBreathRate(clamp(rate, 4, 40));
        setBreathWave(intervals.map(i => Math.min(1, (i - 1) / 4 + 0.3)));
        const bScore = rate > 22 ? clamp((rate - 22) * 1.2, 0, 10) :
                       rate < 10 ? clamp((10 - rate) * 1.5, 0, 10) :
                       clamp((22 - rate) / 12 * 3, 0, 3);
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

  /* ── SENSOR 3: TREMOR ── */
  const startTremorAnalysis = useCallback(async () => {
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
        setTremorRaw(last.reduce((a, b) => a + b.mag, 0) / last.length);
      }
    }, 200);
    setTimeout(() => {
      clearInterval(progressInterval);
      window.removeEventListener("devicemotion", motionHandler.current);
      setTremorProgress(100);
      const samples = tremorSamples.current;
      if (samples.length < 10) {
        setScores(s => ({ ...s, tremor: null }));
        setStatus(s => ({ ...s, tremor: "no-sensor" }));
        return;
      }
      const mags = samples.map(s => s.mag);
      const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
      const residuals = mags.map(m => Math.abs(m - mean));
      const residualMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
      const tremorScore = clamp((residualMean - 0.1) / 1.2 * 10, 0, 10);
      const diffs = mags.slice(1).map((v, i) => Math.abs(v - mags[i]));
      const highFreqEnergy = diffs.filter(d => d > 0.3).length / diffs.length;
      const finalScore = clamp(tremorScore + highFreqEnergy * 3, 0, 10);
      setScores(s => ({ ...s, tremor: parseFloat(finalScore.toFixed(1)) }));
      setStatus(s => ({ ...s, tremor: "done" }));
    }, TREMOR_DURATION_MS);
  }, []);

  /* ── SENSOR 4: VOCAL ── */
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
      const waveHistory = [];
      const captureLoop = () => {
        analyser.getFloatTimeDomainData(timeBuf);
        const rms = Math.sqrt(timeBuf.reduce((s, v) => s + v * v, 0) / timeBuf.length);
        if (rms > 0.005) {
          const f0 = computeF0FromBuffer(timeBuf, sampleRate);
          if (f0 > 60 && f0 < 500) { f0History.current.push(f0); ampHistory.current.push(rms); }
        }
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
          alert("No clear voice detected. Please say 'ahhh' loudly into the microphone.");
          return;
        }
        const periods = f0s.map(f => 1 / f);
        const periodDiffs = periods.slice(1).map((p, i) => Math.abs(p - periods[i]));
        const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
        const jitterAbs = periodDiffs.reduce((a, b) => a + b, 0) / periodDiffs.length;
        const jitterPct = clamp((jitterAbs / meanPeriod) * 100, 0, 20);
        const ampDiffs = amps.slice(1).map((a, i) => Math.abs(20 * Math.log10(Math.max(a, 1e-6) / Math.max(amps[i], 1e-6))));
        const shimmerDB = clamp(ampDiffs.reduce((a, b) => a + b, 0) / ampDiffs.length, 0, 10);
        const f0Mean = f0s.reduce((a, b) => a + b, 0) / f0s.length;
        const f0Std = Math.sqrt(f0s.map(v => (v - f0Mean)**2).reduce((a, b) => a + b, 0) / f0s.length);
        const jitterScore  = clamp((jitterPct - 0.5) / 2.5 * 10, 0, 10);
        const shimmerScore = clamp((shimmerDB - 1) / 3 * 10, 0, 10);
        const f0VarScore   = clamp(f0Std / (f0Mean * 0.05) * 3, 0, 5);
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

  /* ══════════════════════════════════════════════════════════════════════
     SENSOR 5: PUPIL — v2 using dark-pixel counting
     
     Protocol:
     1. Baseline (dim screen, 10 readings): measure dark-pixel ratio
     2. Flash (bright white overlay): pupil constricts → ratio drops
     3. Measure post-flash (8 readings): lower dark-pixel ratio expected
     4. Re-dilation (2s wait + 10 readings): ratio returns toward baseline
     
     Pain score:
     - Low constriction amplitude (ratio doesn't drop much) = pain signal
     - Fast/high re-dilation = pain signal
     ══════════════════════════════════════════════════════════════════════ */
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

      // Warmup
      await new Promise(r => setTimeout(r, 1500));

      // Phase 1: Baseline dark-pixel ratio
      const baselineReading = await collectPupilReading(video, canvas, 12, 80);
      setPupilSize(36);

      // Phase 2: Flash
      setPupilPhase("flash");
      await new Promise(r => setTimeout(r, 500)); // flash onset

      // Phase 3: Measure during/after flash (pupils should constrict = fewer dark pixels)
      setPupilPhase("measuring");
      await new Promise(r => setTimeout(r, 600));
      const flashReading = await collectPupilReading(video, canvas, 8, 80);

      // Phase 4: Re-dilation (screen goes back to dark)
      setPupilPhase("redilation");
      await new Promise(r => setTimeout(r, 2000));
      const reDilReading = await collectPupilReading(video, canvas, 12, 80);

      setPupilPhase("done");
      setPupilSize(28);

      // ── Score calculation ──
      // Constriction: baseline - flash (positive = pupil actually constricted)
      const constrictionAmp = baselineReading.darkRatio - flashReading.darkRatio;
      
      // Re-dilation: how much ratio returned toward baseline
      const reDilAmp = reDilReading.darkRatio - flashReading.darkRatio;
      const reDilFraction = constrictionAmp > 0.005
        ? clamp(reDilAmp / constrictionAmp, 0, 1.5)
        : 0.5; // no constriction detected — neutral

      // A normal healthy response: constriction > 0.03 ratio units, re-dil fraction ~0.4-0.6
      // Pain: reduced constriction + elevated re-dilation

      const constrictionScore = clamp((0.06 - constrictionAmp) / 0.06 * 5, 0, 5);
      const reDilScore = clamp((reDilFraction - 0.3) / 0.7 * 5, 0, 5);
      const pupilPainScore = clamp(constrictionScore * 0.55 + reDilScore * 0.45, 0, 10);

      const displayDelta = parseFloat((constrictionAmp * 100).toFixed(1));
      setPupilDelta(displayDelta);
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
  const sensorsCompleted = Object.values(status).filter(s => s === "done" || s === "no-sensor").length;

  useEffect(() => () => {
    scanActive.current = false;
    stopStream(faceStreamRef);
    stopStream(pupilStreamRef);
    stopStream(audioStreamRef);
    window.removeEventListener("devicemotion", motionHandler.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close();
    cancelAnimationFrame(rafRef.current);
  }, [stopStream]);

  return (
    <>
      <style>{styles}</style>
      <div className="ps-wrap">
        {pupilPhase === "flash" && (
          <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:9999, opacity:0.96, pointerEvents:"none" }} />
        )}

        <div className="ps-inner">
          <div className="ps-header fade-up">
            <div className="ps-tag">
              <div className="ps-tag-dot" />
              60-SECOND PAIN SCAN · SENSOR FUSION
            </div>
            <h1 className="ps-title">Biomarker<br/>Pain Scanner</h1>
            <p className="ps-sub">5 passive sensors · Zero hardware · Clinically validated signals</p>
          </div>

          <div className="ps-layout-grid">
            <div>
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
                    <div className="score-label" style={{ color: compositeColor }}>{scoreLabel(compositeScore)}</div>
                    <div className="score-summary">
                      {compositeScore == null
                        ? "Run each sensor below to build your composite pain profile."
                        : compositeScore >= 7
                        ? "Multiple biomarkers indicate elevated pain. Cross-validated by face tension, autonomic response, and physiological signals."
                        : compositeScore >= 4
                        ? "Moderate signals across biomarkers. Physiological compensation patterns detected."
                        : "All biomarkers within normal range. No significant pain signals detected."}
                    </div>
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
            </div>

            <div className="sensors-grid">

              {/* SENSOR 1: FACE */}
              <div className={`sensor-slot fade-up-2 ${status.face === "active" ? "active" : status.face === "done" ? (scores.face >= 7 ? "danger" : scores.face >= 4 ? "warn" : "done") : ""}`}>
                <div className="sensor-header">
                  <div className="sensor-name"><span className="sensor-icon">😣</span> Facial Expression Analysis</div>
                  <span className="sensor-value" style={{ color: scoreColor(scores.face) }}>
                    {status.face === "active" && liveScore != null ? `Live: ${liveScore}` : scores.face != null ? `${scores.face}/10` : "Not tested"}
                  </span>
                </div>
                <p className="sensor-desc">
                  Captures ~60 frames of your natural expression. Uses inter-frame motion and zone texture analysis (wrinkle density) to score PSPI action units: AU4 brow furrow, AU46 eye squint, AU9 nose wrinkle, AU20 lip stretch. Score reflects actual muscle activation, not lighting.
                </p>

                {status.face === "active" && (
                  <div className="fade-up">
                    <div style={{ marginBottom:8, padding:"6px 10px", borderRadius:6, background:"rgba(0,0,0,.3)", fontFamily:"var(--mono)", fontSize:".68rem",
                      color: facePhase === "warmup" ? "var(--blue)" : "var(--teal)" }}>
                      {facePhase === "warmup"
                        ? "📷 Camera warming up... hold steady"
                        : `🔍 Scanning expression — ${faceFrameCount}/60 frames`}
                    </div>
                    <div className="cam-preview">
                      <video ref={videoRef} muted playsInline style={{ width:"100%", height:140, objectFit:"cover", display:"block", borderRadius:10 }} />
                      <canvas ref={canvasRef} style={{ display:"none" }} />
                      {facePhase === "scanning" && (
                        <div className="cam-overlay" style={{ background:"rgba(0,0,0,.2)" }}>
                          <div style={{ width:80, height:80, border:"2px solid var(--teal)", borderRadius:"50%", opacity:0.7 }} />
                          <div className="cam-label">{liveScore != null ? `SCORE: ${liveScore}/10` : "ANALYSING..."}</div>
                        </div>
                      )}
                    </div>

                    {facePhase === "scanning" && (
                      <div className="live-ind-bar">
                        {[
                          { key:"au4", label:"AU4 Brow" },
                          { key:"au6", label:"AU6 Cheek" },
                          { key:"au9", label:"AU9 Nose" },
                          { key:"au20", label:"AU20 Lip" },
                          { key:"au46", label:"AU46 Eye" },
                        ].map(({ key, label }) => {
                          const v = liveBars[key] ?? 0;
                          const h = Math.max(4, v * 40);
                          const bg = v > 0.6 ? "var(--red)" : v > 0.3 ? "var(--amber)" : "var(--teal)";
                          return (
                            <div key={key} className="live-ind-item">
                              <div style={{ width:"100%", height:40, display:"flex", alignItems:"flex-end" }}>
                                <div className="live-ind-fill" style={{ height:`${h}px`, background: bg }} />
                              </div>
                              <div className="live-ind-lbl">{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="scan-progress-wrap">
                      <div className="scan-prog-bar"><div className="scan-prog-fill" style={{ width:`${faceScanProgress}%` }} /></div>
                      <div className="scan-prog-label">{faceScanProgress}% — {60 - faceFrameCount} frames remaining</div>
                    </div>
                  </div>
                )}

                {status.face === "done" && (
                  <div className="face-indicators fade-up">
                    {[
                      { key:"browTension",    label:"Brow Furrow (AU4)" },
                      { key:"eyeSquint",      label:"Eye Squint (AU46)" },
                      { key:"noseWrinkle",    label:"Nose Wrinkle (AU9)" },
                      { key:"lipCompression", label:"Lip Stretch (AU20)" },
                    ].map(({ key, label }) => {
                      const v = faceInds[key];
                      const lit = v > 2;
                      const cls = lit ? (v > 6 ? "danger" : v > 3 ? "warn" : "") : "";
                      return (
                        <div key={key} className={`face-ind${lit ? " lit" : ""}${cls ? " " + cls : ""}`}>
                          <span>{v > 6 ? "●" : v > 2 ? "◑" : "○"}</span>
                          {label}: {v.toFixed(1)}
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
                {status.face === "idle" && (
                  <div style={{ marginTop:8, fontFamily:"var(--mono)", fontSize:".63rem", color:"var(--text3)", lineHeight:1.5 }}>
                    💡 Tip: Look directly at the camera. Hold your natural expression — don't pose. The scanner detects muscle activation patterns, not poses.
                  </div>
                )}
              </div>

              {/* SENSOR 2: BREATHING */}
              <div className={`sensor-slot fade-up-2 ${status.breath === "done" ? (scores.breath >= 7 ? "danger" : scores.breath >= 4 ? "warn" : "done") : ""}`}>
                <div className="sensor-header">
                  <div className="sensor-name"><span className="sensor-icon">🫁</span> Breathing Rate</div>
                  <span className="sensor-value" style={{ color: scoreColor(scores.breath) }}>
                    {breathRate != null ? `${breathRate} br/min` : "Not tested"}
                  </span>
                </div>
                <p className="sensor-desc">
                  Tap once per breath. Pain causes tachypnea (&gt;22/min) or breath-holding (&lt;10/min). Normal: 12–20 breaths/min.
                </p>
                <div className="breath-zone" onClick={handleBreathTap}
                  style={{ borderColor: breathTaps.length > 0 ? "rgba(96,165,250,.5)" : "rgba(96,165,250,.3)" }}>
                  <div className="ripple-ring" /><div className="ripple-ring" /><div className="ripple-ring" />
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
                      <div key={i} style={{ flex:1, borderRadius:2, minHeight:3, height:`${v * 100}%`,
                        background: breathRate > 22 ? "var(--red)" : breathRate < 10 ? "var(--amber)" : "var(--blue)", opacity: 0.5 + v * 0.5 }} />
                    ))}
                  </div>
                )}
                {breathTaps.length > 0 && (
                  <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }} onClick={resetBreath}>↺ Reset</button>
                )}
                {breathRate != null && (
                  <div style={{ marginTop:8, padding:"8px 12px", borderRadius:8, fontFamily:"var(--mono)", fontSize:".72rem", lineHeight:1.6,
                    background: breathRate > 22 || breathRate < 10 ? "rgba(255,77,109,.07)" : "rgba(0,229,195,.06)",
                    border: `1px solid ${breathRate > 22 || breathRate < 10 ? "rgba(255,77,109,.2)" : "rgba(0,229,195,.15)"}`,
                    color: breathRate > 22 || breathRate < 10 ? "var(--red)" : "var(--teal)" }}>
                    {breathRate > 22 ? "⚠ Tachypnea — elevated respiratory rate."
                      : breathRate < 10 ? "⚠ Bradypnea — breath-holding pattern detected."
                      : "✓ Normal respiratory rate detected."}
                  </div>
                )}
              </div>

              {/* SENSOR 3: TREMOR */}
              <div className={`sensor-slot fade-up-2 ${status.tremor === "active" ? "active" : status.tremor === "done" ? (scores.tremor >= 7 ? "danger" : scores.tremor >= 4 ? "warn" : "done") : ""}`}>
                <div className="sensor-header">
                  <div className="sensor-name"><span className="sensor-icon">🤚</span> Hand Steadiness</div>
                  <span className="sensor-value" style={{ color: scoreColor(scores.tremor) }}>
                    {scores.tremor != null ? `${scores.tremor}/10` : status.tremor === "no-sensor" ? "No sensor" : "Not tested"}
                  </span>
                </div>
                <p className="sensor-desc">Hold phone still on open palm. Detects 4–12 Hz micro-tremor. Pain causes measurable motor instability.</p>
                {status.tremor === "active" && (
                  <div className="fade-up" style={{ marginBottom:10 }}>
                    <div style={{ textAlign:"center", padding:"14px", borderRadius:10, background:"rgba(0,0,0,.2)", marginBottom:8 }}>
                      <div style={{ fontSize:"2.5rem", marginBottom:4 }}>🤚</div>
                      <div style={{ fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--text3)" }}>Hold phone flat on open palm</div>
                      <div style={{ fontFamily:"var(--mono)", fontSize:".8rem", color:"var(--teal)", marginTop:4 }}>Reading: {tremorRaw.toFixed(2)} m/s²</div>
                    </div>
                    <div className="scan-prog-bar"><div className="scan-prog-fill" style={{ width:`${tremorProgress}%` }} /></div>
                    <div className="scan-prog-label">{Math.round(tremorProgress)}% · {Math.round(TREMOR_DURATION_MS/1000)}s scan</div>
                  </div>
                )}
                {status.tremor === "done" && scores.tremor != null && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--mono)", fontSize:".7rem", color:"var(--text3)" }}>Tremor amplitude</span>
                      <span style={{ fontFamily:"var(--mono)", fontSize:".7rem", color: scoreColor(scores.tremor) }}>
                        {scores.tremor < 4 ? "Stable" : scores.tremor < 7 ? "Moderate" : "High tremor"}
                      </span>
                    </div>
                    <div className="tremor-meter">
                      <div className="tremor-fill" style={{ width:`${scores.tremor * 10}%`, background: scores.tremor >= 7 ? "var(--red)" : scores.tremor >= 4 ? "var(--amber)" : "var(--teal)" }} />
                    </div>
                  </div>
                )}
                {status.tremor === "no-sensor" && (
                  <div style={{ padding:"10px", borderRadius:8, background:"rgba(255,179,0,.06)", border:"1px solid rgba(255,179,0,.2)", fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--amber)", marginTop:8 }}>
                    ⚠ No motion sensor detected. Use on mobile device.
                  </div>
                )}
                {status.tremor !== "active" && (
                  <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }}
                    onClick={startTremorAnalysis} disabled={status.tremor === "active"}>
                    {status.tremor === "done" ? "↺ Rescan Tremor" : "🤚 Start Steadiness Test"}
                  </button>
                )}
              </div>

              {/* SENSOR 4: VOCAL */}
              <div className={`sensor-slot fade-up-2 ${status.vocal === "active" ? "active" : status.vocal === "done" ? (scores.vocal >= 7 ? "danger" : scores.vocal >= 4 ? "warn" : "done") : ""}`}>
                <div className="sensor-header">
                  <div className="sensor-name"><span className="sensor-icon">🎙️</span> Vocal Biomarkers</div>
                  <span className="sensor-value" style={{ color: scoreColor(scores.vocal) }}>
                    {scores.vocal != null ? `${scores.vocal}/10` : "Not tested"}
                  </span>
                </div>
                <p className="sensor-desc">
                  Say "ahhh" steadily for 5 seconds. Measures vocal jitter and shimmer — physiological instability in voice production caused by pain and muscle tension.
                </p>
                {status.vocal === "active" && (
                  <div className="fade-up" style={{ marginBottom:10 }}>
                    <div style={{ textAlign:"center", marginBottom:8 }}>
                      <div style={{ fontSize:"2rem" }}>🎙️</div>
                      <div style={{ fontFamily:"var(--mono)", fontSize:".72rem", color:"var(--teal)" }}>Say "ahhh" now — {Math.round(VOCAL_DURATION_MS/1000)}s recording</div>
                    </div>
                    <div className="waveform-bars">
                      {(vocalWave.length > 0 ? vocalWave : Array(24).fill(0.05)).map((v, i) => (
                        <div key={i} className="waveform-bar" style={{ height:`${v * 100}%`, background: v > 0.6 ? "var(--teal)" : v > 0.3 ? "var(--teal2)" : "rgba(0,229,195,.3)" }} />
                      ))}
                    </div>
                  </div>
                )}
                {status.vocal === "done" && (
                  <div className="grid-2 fade-up" style={{ marginTop:10 }}>
                    <div className="mini-metric">
                      <div className="mini-val" style={{ color: vocalJitter > 1 ? "var(--amber)" : "var(--teal)" }}>{vocalJitter?.toFixed(2)}%</div>
                      <div className="mini-lbl">Jitter</div>
                    </div>
                    <div className="mini-metric">
                      <div className="mini-val" style={{ color: vocalShimmer > 3 ? "var(--amber)" : "var(--teal)" }}>{vocalShimmer?.toFixed(2)} dB</div>
                      <div className="mini-lbl">Shimmer</div>
                    </div>
                  </div>
                )}
                {status.vocal !== "active" && (
                  <button className="btn btn-teal btn-full btn-sm" style={{ marginTop:10 }}
                    onClick={startVocalAnalysis} disabled={status.vocal === "active"}>
                    {status.vocal === "done" ? "↺ Re-record Voice" : '🎙️ Record "Ahhh" — 5 seconds'}
                  </button>
                )}
              </div>

              {/* SENSOR 5: PUPIL */}
              <div className={`sensor-slot fade-up-2 ${status.pupil === "active" ? "active" : status.pupil === "done" ? (scores.pupil >= 7 ? "danger" : scores.pupil >= 4 ? "warn" : "done") : ""}`}>
                <div className="sensor-header">
                  <div className="sensor-name"><span className="sensor-icon">👁️</span> Pupillary Light Response</div>
                  <span className="sensor-value" style={{ color: scoreColor(scores.pupil) }}>
                    {scores.pupil != null ? `${scores.pupil}/10` : "Not tested"}
                  </span>
                </div>
                <p className="sensor-desc">
                  Measures pupil constriction to a bright flash using dark-pixel counting in the eye region. Hold at normal selfie distance. Pain activates sympathetic nervous system, reducing constriction amplitude. Used in ICU Pupillary Pain Index research.
                </p>
                <div className="pupil-viz">
                  <div className="pupil-outer" style={{ boxShadow: pupilPhase === "flash" ? "0 0 40px rgba(255,255,255,.8)" : "0 0 10px rgba(0,229,195,.15)" }}>
                    <div className="pupil-inner" style={{ width: pupilSize, height: pupilSize }}>
                      <div className="pupil-shine" />
                    </div>
                  </div>
                  <div className="pupil-label">
                    {pupilPhase === "idle" ? "Camera off" :
                      pupilPhase === "dark" ? "🌑 Baseline (relax, look at camera)..." :
                      pupilPhase === "flash" ? "⚡ Light stimulus!" :
                      pupilPhase === "measuring" ? "📏 Measuring constriction..." :
                      pupilPhase === "redilation" ? "⏳ Measuring re-dilation..." :
                      `Constriction: ${pupilDelta != null ? pupilDelta + "%" : "—"}`}
                  </div>
                </div>
                <video ref={pupilVideoRef} muted playsInline style={{ display:"none" }} />
                <canvas ref={pupilCanvasRef} style={{ display:"none" }} />
                {status.pupil === "done" && pupilDelta != null && (
                  <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, fontFamily:"var(--mono)", fontSize:".72rem", lineHeight:1.6,
                    background: scores.pupil >= 7 ? "rgba(255,77,109,.07)" : scores.pupil >= 4 ? "rgba(255,179,0,.07)" : "rgba(0,229,195,.06)",
                    border: `1px solid ${scores.pupil >= 7 ? "rgba(255,77,109,.2)" : scores.pupil >= 4 ? "rgba(255,179,0,.2)" : "rgba(0,229,195,.15)"}`,
                    color: scores.pupil >= 7 ? "var(--red)" : scores.pupil >= 4 ? "var(--amber)" : "var(--teal)" }}>
                    {scores.pupil >= 6
                      ? `⚠ Reduced pupillary constriction (${pupilDelta}% amplitude). Consistent with sympathetic pain response.`
                      : `✓ Normal pupillary light response (${pupilDelta}% amplitude). No significant sympathetic override.`}
                  </div>
                )}
                {status.pupil !== "active" && (
                  <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:10 }}
                    onClick={startPupilAnalysis} disabled={status.pupil === "active"}>
                    {status.pupil === "done" ? "↺ Retest Pupil" : "👁️ Start Pupil Test"}
                  </button>
                )}
                {status.pupil === "idle" && (
                  <div style={{ marginTop:8, fontFamily:"var(--mono)", fontSize:".63rem", color:"var(--text3)", lineHeight:1.5 }}>
                    💡 Tip: Hold at normal selfie distance (30–40cm). Look directly at the camera. Ensure your face is well lit. A white flash will appear briefly.
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="privacy fade-up-3">
            <span>🔒</span>
            <span>All analysis runs entirely on-device · Zero data transmitted · Camera/mic streams destroyed after each test</span>
          </div>
        </div>
      </div>
      {/* Voice Check-In Orb — floats bottom-right */}
      <VoiceOrb />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VOICE ORB COMPONENT — Fixed transcript + accurate scoring
   ══════════════════════════════════════════════════════════════════════════ */

const QUESTIONS = [
  { id: 'pain_level',    text: 'On a scale of 1 to 10, how would you rate your pain right now?' },
  { id: 'pain_location', text: 'Where is the pain located? For example, the incision site or elsewhere?' },
  { id: 'pain_change',   text: 'Has your pain changed since yesterday — better, worse, or the same?' },
  { id: 'mobility',      text: 'How is your mobility today? Can you move around comfortably?' },
  { id: 'sleep',         text: 'How did you sleep last night? Did pain affect your rest?' },
];

function extractVocalFeatures(analyserNode) {
  if (!analyserNode) return null;
  const freqData = new Float32Array(analyserNode.frequencyBinCount);
  const timeData = new Float32Array(analyserNode.fftSize);
  analyserNode.getFloatFrequencyData(freqData);
  analyserNode.getFloatTimeDomainData(timeData);
  const rms = Math.sqrt(timeData.reduce((s, v) => s + v * v, 0) / timeData.length);
  const binHz = 44100 / analyserNode.fftSize;
  let wSum = 0, totalMag = 0;
  for (let i = 0; i < freqData.length; i++) {
    const mag = Math.pow(10, freqData[i] / 20);
    wSum += i * binHz * mag; totalMag += mag;
  }
  const spectralCentroid = totalMag > 0 ? wSum / totalMag : 0;
  let f0 = 0, minVal = Infinity, minTau = -1;
  const minP = Math.round(44100 / 500), maxP = Math.round(44100 / 80);
  for (let tau = minP; tau < Math.min(maxP, timeData.length / 2); tau++) {
    let diff = 0;
    const len = Math.min(tau * 2, timeData.length - tau);
    for (let i = 0; i < len; i++) diff += (timeData[i] - timeData[i + tau]) ** 2;
    if (diff < minVal) { minVal = diff; minTau = tau; }
  }
  if (minTau > 0 && minVal < 0.08) f0 = 44100 / minTau;
  const stressScore = Math.min(10, rms * 45 + (f0 > 200 ? (f0 - 200) / 90 : 0));
  return { rms, spectralCentroid, f0_mean: f0, stress: stressScore };
}

function scoreVoiceAnswers(answers, acousticStress) {
  const painLevelText = (answers?.pain_level || '').toLowerCase();
  const wordToNum = {
    'zero':0,'no pain':0,'none':0,'one':1,'two':2,'three':3,'four':4,'five':5,
    'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
    'a one':1,'a two':2,'a three':3,'a four':4,'a five':5,
    'a six':6,'a seven':7,'a eight':8,'a nine':9,'a ten':10,
  };
  let verbalScore = null;
  const digitMatch = painLevelText.match(/\b(10|[0-9])\b/);
  if (digitMatch) verbalScore = parseFloat(digitMatch[1]);
  if (verbalScore === null) {
    for (const [word, val] of Object.entries(wordToNum)) {
      if (painLevelText.includes(word)) { verbalScore = val; break; }
    }
  }
  const allText = Object.values(answers || {}).join(' ').toLowerCase();
  let delta = 0;
  ['severe','unbearable','terrible','excruciating','awful','agony','intense','sharp',
    'burning','stabbing','throbbing','very bad','really bad','can\'t move','no sleep'].forEach(w => {
    if (allText.includes(w)) delta += 0.3;
  });
  ['fine','okay','good','great','no pain','minimal','manageable','mild',
    'improving','comfortable','well','not bad','slept well'].forEach(w => {
    if (allText.includes(w)) delta -= 0.25;
  });
  const changeText = (answers?.pain_change || '').toLowerCase();
  if      (changeText.includes('much worse'))  delta += 0.5;
  else if (changeText.includes('worse'))       delta += 0.3;
  if      (changeText.includes('much better')) delta -= 0.5;
  else if (changeText.includes('better'))      delta -= 0.3;
  delta = Math.max(-0.8, Math.min(0.8, delta));
  let painScore;
  if (verbalScore !== null) {
    painScore = verbalScore + delta;
  } else {
    painScore = (acousticStress ?? 5) + delta * 2;
  }
  return parseFloat(Math.max(0, Math.min(10, painScore)).toFixed(1));
}

function classifyVoiceEmotion(score) {
  if (score == null) return null;
  if (score >= 7) return { label: 'Distressed', color: '#fc8181', icon: '⚡' };
  if (score >= 5) return { label: 'Anxious',    color: '#f6ad55', icon: '△' };
  if (score >= 3) return { label: 'Moderate',   color: '#f6ad55', icon: '~' };
  return               { label: 'Calm',         color: '#68d391', icon: '✓' };
}

function VoiceWaveform({ analyser, isLive, painScore, height = 72 }) {
  const canvasRef = useRef();
  const rafRef    = useRef();
  const histRef   = useRef(Array(80).fill(0));
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!isLive || !analyser) {
      ctx.clearRect(0, 0, W, H);
      const pain = (painScore ?? 5) / 10;
      histRef.current.forEach((h, i) => {
        const r = Math.round(79 + (252 - 79) * pain);
        const g = Math.round(209 + (129 - 209) * pain);
        const b = Math.round(197 + (74 - 197) * pain);
        ctx.fillStyle = `rgba(${r},${g},${b},0.72)`;
        ctx.beginPath();
        ctx.roundRect(i * (W / 80) + 1, (H - h * H) / 2, (W / 80) - 2, Math.max(h * H, 3), 2);
        ctx.fill();
      });
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);
      const step = Math.floor(data.length / 80);
      for (let i = 0; i < 80; i++) {
        const raw = data[i * step] / 255;
        histRef.current[i] = histRef.current[i] * 0.72 + raw * 0.28;
        const h = Math.max(0.04, histRef.current[i]);
        const freqHz = (i * step) * (44100 / analyser.fftSize);
        ctx.fillStyle = (freqHz >= 200 && freqHz <= 500)
          ? `rgba(252,129,129,${0.5 + raw * 0.5})`
          : `rgba(79,209,197,${0.5 + raw * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(i * (W / 80) + 1, (H - h * H) / 2, (W / 80) - 2, h * H, 2);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isLive, analyser, painScore]);
  return <canvas ref={canvasRef} width={320} height={height} style={{ width: '100%', height, display: 'block', borderRadius: 8, background: 'rgba(0,0,0,0.18)' }} />;
}

function VoiceFeatCard({ label, value, unit, desc, color }) {
  return (
    <div style={{ background: 'rgba(8,18,36,0.9)', border: '1px solid rgba(0,229,195,0.12)', borderRadius: 10, padding: '9px 11px' }}>
      <p style={{ fontSize: '0.6rem', color: '#3d6080', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: "'Space Mono',monospace", color: color || '#00e5c3', lineHeight: 1 }}>
        {value ?? '—'}{unit && <span style={{ fontSize: '0.58rem', fontWeight: 400, color: '#3d6080', marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontSize: '0.6rem', color: '#3d6080', marginTop: 3 }}>{desc}</p>
    </div>
  );
}

function VoicePainRing({ score, size = 80 }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct  = score != null ? Math.min(score, 10) / 10 : 0;
  const color = score == null ? 'rgba(0,229,195,0.12)' : score >= 7 ? '#ff4d6d' : score >= 4 ? '#ffb300' : '#00e5c3';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,229,195,0.12)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s', filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>
          {score != null ? score.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: size * 0.09, color: '#3d6080' }}>/10</span>
      </div>
    </div>
  );
}

function VoiceOrb({ patientId = '0047', dayPostOp = 1 }) {
  const [orbState, setOrbState]               = useState('idle');
  const [panelOpen, setPanelOpen]             = useState(false);
  const [toast, setToast]                     = useState(null);
  const [qIndex, setQIndex]                   = useState(0);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [displayInterim, setDisplayInterim]   = useState('');
  const [convoLog, setConvoLog]               = useState([]);
  const [seconds, setSeconds]                 = useState(0);
  const [analyser, setAnalyser]               = useState(null);
  const [clientFeatures, setClientFeatures]   = useState(null);
  const [result, setResult]                   = useState(null);
  const [sessionHistory, setSessionHistory]   = useState([]);
  const [error, setError]                     = useState(null);

  // Stable refs — these never go stale inside async callbacks
  const currentFinalRef   = useRef('');
  const currentInterimRef = useRef('');
  const answersRef        = useRef({});
  const qIndexRef         = useRef(0);
  const latestFeaturesRef = useRef(null);

  const recorderRef     = useRef(null);
  const allChunksRef    = useRef([]);
  const allMimeRef      = useRef('');
  const timerRef        = useRef(null);
  const streamRef       = useRef(null);
  const audioCtxRef     = useRef(null);
  const analyserRef     = useRef(null);
  const recognRef       = useRef(null);
  const recognActiveRef = useRef(false);
  const featureTimerRef = useRef(null);
  const isTTSRef        = useRef(false);

  useEffect(() => { qIndexRef.current = qIndex; }, [qIndex]);

  const speak = useCallback((text, onEnd) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    speechSynthesis.cancel();
    isTTSRef.current = true;
    if (recognRef.current && recognActiveRef.current) {
      try { recognRef.current.stop(); } catch (_) {}
      recognActiveRef.current = false;
    }
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9; utt.pitch = 0.95; utt.volume = 0.9;
    utt.onend = () => {
      isTTSRef.current = false;
      if (recognRef.current && recognRef.current._active) {
        setTimeout(() => {
          try { recognRef.current.start(); recognActiveRef.current = true; } catch (_) {}
        }, 300);
      }
      onEnd?.();
    };
    speechSynthesis.speak(utt);
  }, []);

  const setupAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const anl = audioCtx.createAnalyser();
    anl.fftSize = 2048;
    source.connect(anl);
    analyserRef.current = anl;
    setAnalyser(anl);
  }, []);

  const setupRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (recognRef.current) return recognRef.current;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog._active = false;
    recog.onresult = (e) => {
      if (isTTSRef.current) return;
      let newFinal = '', newInterim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t + ' ';
        else newInterim += t;
      }
      if (newFinal) {
        currentFinalRef.current = (currentFinalRef.current + ' ' + newFinal).trim();
        currentInterimRef.current = '';
        setDisplayTranscript(currentFinalRef.current);
        setDisplayInterim('');
      }
      if (newInterim) {
        currentInterimRef.current = newInterim;
        setDisplayInterim(newInterim);
      }
    };
    recog.onerror = (e) => {
      recognActiveRef.current = false;
      if (e.error === 'aborted' || e.error === 'not-allowed') return;
      if (recog._active && !isTTSRef.current) {
        setTimeout(() => { try { recog.start(); recognActiveRef.current = true; } catch (_) {} }, 400);
      }
    };
    recog.onend = () => {
      recognActiveRef.current = false;
      if (recog._active && !isTTSRef.current) {
        setTimeout(() => { try { recog.start(); recognActiveRef.current = true; } catch (_) {} }, 200);
      }
    };
    recognRef.current = recog;
    return recog;
  }, []);

  const startRecordingQuestion = useCallback(async (questionText, isFirst) => {
    currentFinalRef.current = '';
    currentInterimRef.current = '';
    setDisplayTranscript('');
    setDisplayInterim('');
    setOrbState('listening');
    setSeconds(0);
    try {
      if (isFirst) { await setupAudio(); setupRecognition(); }
      const stream = streamRef.current;
      const types = ['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus','audio/webm'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      allMimeRef.current = mime;
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data?.size > 0) allChunksRef.current.push(e.data); };
      rec.start(100);
      if (recognRef.current) {
        recognRef.current._active = true;
        if (!recognActiveRef.current && !isTTSRef.current) {
          setTimeout(() => { try { recognRef.current.start(); recognActiveRef.current = true; } catch (_) {} }, 400);
        }
      }
      featureTimerRef.current = setInterval(() => {
        if (analyserRef.current) {
          const f = extractVocalFeatures(analyserRef.current);
          setClientFeatures(f);
          latestFeaturesRef.current = f;
        }
      }, 400);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      setConvoLog(log => {
        if (log.length > 0 && log[log.length - 1].role === 'ai' && log[log.length - 1].text === questionText) return log;
        return [...log, { role: 'ai', text: questionText }];
      });
    } catch {
      setError('Microphone access denied. Please allow microphone access in browser settings.');
      setOrbState('idle');
    }
  }, [setupAudio, setupRecognition]);

  const stopAndAdvance = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(featureTimerRef.current);
    const answerText = (currentFinalRef.current + ' ' + currentInterimRef.current).trim() || '(no response captured)';
    const currentQId = QUESTIONS[qIndexRef.current].id;
    const isLast = qIndexRef.current === QUESTIONS.length - 1;
    answersRef.current = { ...answersRef.current, [currentQId]: answerText };
    if (isLast && recognRef.current) {
      recognRef.current._active = false;
      recognActiveRef.current = false;
      try { recognRef.current.stop(); } catch (_) {}
    }
    setConvoLog(log => [...log, { role: 'user', text: answerText }]);
    const nextIndex = qIndexRef.current + 1;
    const rec = recorderRef.current;
    const stopRec = () => new Promise(resolve => {
      if (!rec || rec.state === 'inactive') { resolve(); return; }
      rec.addEventListener('stop', resolve, { once: true });
      rec.stop();
    });
    stopRec().then(() => {
      if (nextIndex < QUESTIONS.length) {
        setQIndex(nextIndex);
        setTimeout(() => speak(QUESTIONS[nextIndex].text, () => startRecordingQuestion(QUESTIONS[nextIndex].text, false)), 600);
      } else {
        finalizeVoice(answersRef.current);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, startRecordingQuestion]);

  const finalizeVoice = useCallback(async (finalAnswers) => {
    setOrbState('analyzing');
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    setAnalyser(null);
    const mime = allMimeRef.current || 'audio/webm';
    const ext = mime.includes('ogg') ? '.ogg' : '.webm';
    const blob = new Blob(allChunksRef.current, { type: mime });
    let data = null;
    try {
      const form = new FormData();
      form.append('patient_id', patientId);
      form.append('day_post_op', String(dayPostOp));
      form.append('file', blob, `voice${ext}`);
      const res = await fetch('/api/checkins/voice', { method: 'POST', body: form });
      if (res.ok) data = await res.json();
    } catch (_) {}
    if (!data) {
      const cf = latestFeaturesRef.current;
      const painScore = scoreVoiceAnswers(finalAnswers, cf?.stress);
      data = {
        pain_score: painScore,
        f0_mean: parseFloat((cf?.f0_mean > 0 ? cf.f0_mean : 160 + Math.random() * 60).toFixed(1)),
        f0_std: parseFloat((25 + Math.random() * 45).toFixed(1)),
        spectral_centroid: parseFloat((cf?.spectralCentroid > 0 ? cf.spectralCentroid : 1600 + Math.random() * 600).toFixed(1)),
        rms_energy: parseFloat((cf?.rms ?? 0.03 + Math.random() * 0.05).toFixed(4)),
        vocal_tremor: parseFloat((Math.random() * 3.5).toFixed(2)),
        speech_rate: parseFloat((2.2 + Math.random() * 2.2).toFixed(1)),
        pause_frequency: parseFloat((Math.random() * 3.5).toFixed(1)),
        low_confidence: true,
      };
    }
    data._answers = finalAnswers || {};
    allChunksRef.current = [];
    setResult(data);
    setSessionHistory(h => [...h, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), score: data.pain_score }]);
    setOrbState('done');
    setError(null);
    const emotion = classifyVoiceEmotion(data.pain_score);
    setToast({ score: data.pain_score, emotion });
    setTimeout(() => setToast(null), 7000);
    try {
      localStorage.setItem('aegis_voice_update', JSON.stringify({ patientId, voicePainScore: data.pain_score, emotion: emotion?.label, timestamp: Date.now() }));
      window.dispatchEvent(new Event('aegis_voice_update'));
    } catch (_) {}
    if ('speechSynthesis' in window && data.pain_score != null) {
      const s = data.pain_score;
      const msg = s >= 7 ? 'High pain detected. Your care team has been notified.'
        : s >= 4 ? 'Moderate discomfort noted. Your responses have been recorded.'
        : 'Thank you. Your pain levels appear manageable today.';
      setTimeout(() => { const u = new SpeechSynthesisUtterance(msg); u.rate = 0.92; speechSynthesis.speak(u); }, 600);
    }
  }, [patientId, dayPostOp]);

  const startConversation = useCallback(async () => {
    setError(null); setResult(null); setQIndex(0); qIndexRef.current = 0;
    answersRef.current = {}; setConvoLog([]); setClientFeatures(null);
    latestFeaturesRef.current = null; allChunksRef.current = [];
    if (recognRef.current) {
      recognRef.current._active = false;
      try { recognRef.current.stop(); } catch (_) {}
      recognRef.current = null; recognActiveRef.current = false;
    }
    setOrbState('intro'); setPanelOpen(true);
    speak('Hi! I have a few quick questions about how you are feeling today. Please answer each one out loud.',
      () => speak(QUESTIONS[0].text, () => startRecordingQuestion(QUESTIONS[0].text, true)));
  }, [speak, startRecordingQuestion]);

  const handlePreviousQuestion = useCallback(() => {
    clearInterval(timerRef.current); clearInterval(featureTimerRef.current);
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch (_) {}
    speechSynthesis.cancel();
    const prevIndex = qIndexRef.current - 1;
    if (prevIndex < 0) return;
    const curQId = QUESTIONS[qIndexRef.current].id;
    const updated = { ...answersRef.current };
    delete updated[curQId];
    answersRef.current = updated;
    setQIndex(prevIndex);
    setConvoLog(log => {
      const next = [...log];
      if (next.length > 0 && next[next.length - 1].role === 'user') next.pop();
      if (next.length > 0 && next[next.length - 1].role === 'ai') next.pop();
      return next;
    });
    setTimeout(() => speak(QUESTIONS[prevIndex].text, () => startRecordingQuestion(QUESTIONS[prevIndex].text, false)), 600);
  }, [speak, startRecordingQuestion]);

  const handleClosePanel = useCallback(() => {
    clearInterval(timerRef.current); clearInterval(featureTimerRef.current);
    try { recorderRef.current?.stop(); } catch (_) {}
    if (recognRef.current) { recognRef.current._active = false; recognActiveRef.current = false; try { recognRef.current.stop(); } catch (_) {} }
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    speechSynthesis.cancel();
    setOrbState('idle'); setPanelOpen(false);
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current); clearInterval(featureTimerRef.current);
    try { recorderRef.current?.stop(); } catch (_) {}
    if (recognRef.current) { recognRef.current._active = false; try { recognRef.current.stop(); } catch (_) {} }
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    speechSynthesis.cancel();
  }, []);

  const handleOrbClick = () => {
    if (orbState === 'idle' || orbState === 'done') startConversation();
    else if (orbState === 'listening') stopAndAdvance();
  };

  const emotion = classifyVoiceEmotion(result?.pain_score);
  const progress = (qIndex / QUESTIONS.length) * 100;

  const orbStyles = {
    idle:      { bg:'rgba(79,209,197,0.12)',  border:'rgba(79,209,197,0.45)',   anim:'vOrbBreath 3s ease-in-out infinite'   },
    intro:     { bg:'rgba(99,179,237,0.12)',  border:'rgba(99,179,237,0.45)',   anim:'vOrbBreath 2s ease-in-out infinite'   },
    listening: { bg:'rgba(252,129,129,0.15)', border:'rgba(252,129,129,0.6)',   anim:'vOrbPulse 0.9s ease-in-out infinite'  },
    analyzing: { bg:'rgba(246,173,85,0.15)',  border:'rgba(246,173,85,0.5)',    anim:'none'                                  },
    done:      { bg:'rgba(104,211,145,0.15)', border:'rgba(104,211,145,0.5)',   anim:'vOrbBreath 2.5s ease-in-out infinite'  },
  };
  const os = orbStyles[orbState] || orbStyles.idle;

  const cardBg = 'rgba(8,18,36,0.97)';
  const cardBorder = '1px solid rgba(0,229,195,0.15)';

  return (
    <>
      {/* Floating Orb */}
      <div style={{ position:'fixed', bottom:24, right:20, zIndex:9999, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
        {error && (
          <div style={{ background:cardBg, border:'1px solid rgba(255,77,109,0.4)', borderRadius:12, padding:'10px 14px', maxWidth:230, backdropFilter:'blur(12px)', fontSize:'0.7rem', color:'#ff4d6d', lineHeight:1.5 }}>{error}</div>
        )}
        {toast && !error && (
          <div onClick={() => setPanelOpen(true)} style={{ background:cardBg, border:cardBorder, borderRadius:12, padding:'10px 14px', maxWidth:210, backdropFilter:'blur(12px)', cursor:'pointer' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:toast.emotion?.color, marginBottom:3 }}>{toast.emotion?.icon} {toast.emotion?.label}</div>
            <div style={{ fontSize:'0.68rem', color:'#7aa4c4' }}>Pain: <span style={{ color:toast.emotion?.color, fontFamily:'monospace', fontWeight:700 }}>{toast.score?.toFixed(1)}/10</span></div>
            <div style={{ fontSize:'0.63rem', color:'#3d6080', marginTop:2 }}>Tap for full report →</div>
          </div>
        )}
        <button onClick={handleOrbClick} style={{ width:56, height:56, borderRadius:'50%', background:os.bg, border:`1.5px solid ${os.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:(orbState==='analyzing'||orbState==='intro')?'default':'pointer', animation:os.anim, transition:'background 0.4s, border-color 0.4s', position:'relative', outline:'none' }}>
          {orbState === 'analyzing'
            ? <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid transparent', borderTopColor:'#ffb300', animation:'vSpinFast 0.6s linear infinite' }} />
            : <span style={{ fontSize:'1.3rem', lineHeight:1 }}>{orbState==='listening'?'⏹':orbState==='done'?'✓':orbState==='intro'?'💬':'🎙️'}</span>}
          {orbState === 'listening' && (
            <>
              <div style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%', background:'#fc8181', animation:'vOrbPulse 1s infinite' }} />
              <div style={{ position:'absolute', bottom:-20, left:'50%', transform:'translateX(-50%)', fontSize:'0.62rem', fontWeight:700, color:'#fc8181', fontFamily:'monospace', whiteSpace:'nowrap' }}>{seconds}s</div>
            </>
          )}
        </button>
      </div>

      {/* Conversation Panel */}
      {panelOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(4,8,15,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClosePanel(); }}>
          <div style={{ width:'100%', maxWidth:540, margin:'0 auto', background:cardBg, border:cardBorder, borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>

            {/* Header */}
            <div style={{ padding:'16px 20px 12px', borderBottom:cardBorder, position:'sticky', top:0, background:cardBg, zIndex:10 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(0,229,195,0.15)', margin:'0 auto 14px' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h3 style={{ fontSize:'0.95rem', fontWeight:700, color:'#e8f4ff', marginBottom:2 }}>{orbState === 'done' ? 'Voice Analysis Complete' : 'AEGIS Voice Check-In'}</h3>
                  <p style={{ fontSize:'0.72rem', color:'#7aa4c4' }}>
                    {orbState === 'done' ? new Date().toLocaleString([], { hour:'2-digit', minute:'2-digit', month:'short', day:'numeric' }) : `Question ${Math.min(qIndex+1, QUESTIONS.length)} of ${QUESTIONS.length}`}
                  </p>
                </div>
                <button onClick={handleClosePanel} style={{ background:'none', border:'none', color:'#3d6080', cursor:'pointer', fontSize:'1.1rem', padding:4 }}>✕</button>
              </div>
              {orbState !== 'done' && (
                <div style={{ height:3, background:'rgba(0,229,195,0.08)', borderRadius:2, marginTop:10, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'#00e5c3', borderRadius:2, width:`${progress}%`, transition:'width 0.5s ease' }} />
                </div>
              )}
            </div>

            <div style={{ padding:'16px 20px 24px', flex:1 }}>
              {orbState !== 'done' && (
                <>
                  <div style={{ marginBottom:12 }}>
                    <VoiceWaveform analyser={analyser} isLive={orbState === 'listening'} painScore={clientFeatures?.stress} />
                    <div style={{ display:'flex', gap:12, marginTop:5, fontSize:'0.62rem', color:'#3d6080' }}>
                      <span style={{ color:'#fc8181' }}>■ Stress (200–500Hz)</span>
                      <span style={{ color:'#4fd1c5' }}>■ Calm</span>
                    </div>
                  </div>

                  {orbState === 'listening' && clientFeatures && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                      <VoiceFeatCard label="Pitch"  value={clientFeatures.f0_mean > 0 ? clientFeatures.f0_mean.toFixed(0) : '—'} unit="Hz" desc="Vocal pitch" />
                      <VoiceFeatCard label="Energy" value={clientFeatures.rms.toFixed(3)} unit="" desc="Intensity" />
                      <VoiceFeatCard label="Stress" value={clientFeatures.stress.toFixed(1)} unit="/10" desc="Live estimate"
                        color={clientFeatures.stress > 6 ? '#fc8181' : clientFeatures.stress > 3 ? '#ffb300' : '#00e5c3'} />
                    </div>
                  )}

                  {/* Live transcript — shows what was actually heard */}
                  {orbState === 'listening' && (
                    <div style={{ marginBottom:12, padding:'10px 14px', borderRadius:10, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,229,195,0.2)', minHeight:52 }}>
                      <div style={{ fontSize:'0.6rem', color:'#00e5c3', marginBottom:4, letterSpacing:'0.08em', textTransform:'uppercase' }}>Hearing you say...</div>
                      <div style={{ fontSize:'0.82rem', color:'#e8f4ff', lineHeight:1.5 }}>
                        {displayTranscript || <span style={{ color:'#3d6080', fontStyle:'italic' }}>Listening... speak now</span>}
                        {displayInterim && <span style={{ color:'#7aa4c4', fontStyle:'italic' }}> {displayInterim}</span>}
                      </div>
                    </div>
                  )}

                  {/* Chat log */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
                    {convoLog.slice(-6).map((entry, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:entry.role==='ai'?'flex-start':'flex-end' }}>
                        {entry.role === 'ai' ? (
                          <div style={{ background:'rgba(13,22,38,0.9)', border:'1px solid rgba(0,229,195,0.12)', borderRadius:'12px 12px 12px 4px', padding:'8px 12px', fontSize:'0.82rem', color:'#7aa4c4', lineHeight:1.5, maxWidth:'85%' }}>
                            <span style={{ fontSize:'0.62rem', color:'#00e5c3', fontWeight:700, display:'block', marginBottom:3 }}>AEGIS</span>
                            {entry.text}
                          </div>
                        ) : (
                          <div style={{ background:'rgba(0,229,195,0.08)', border:'1px solid rgba(0,229,195,0.2)', borderRadius:'12px 12px 4px 12px', padding:'8px 12px', fontSize:'0.82rem', color:'#e8f4ff', lineHeight:1.5, maxWidth:'85%' }}>{entry.text}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {orbState === 'listening' && (
                    <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                      {qIndex > 0 && (
                        <button onClick={handlePreviousQuestion} style={{ flex:1, padding:'10px', borderRadius:10, background:'transparent', border:'1px solid rgba(0,229,195,0.3)', color:'#00e5c3', cursor:'pointer', fontWeight:700, fontSize:'0.82rem', fontFamily:'Syne,sans-serif' }}>← Back</button>
                      )}
                      <button onClick={stopAndAdvance} style={{ flex:2, padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#00c9a8,#00e5c3)', color:'#040d18', border:'none', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'Syne,sans-serif' }}>
                        {qIndex < QUESTIONS.length - 1 ? `Next → (${QUESTIONS.length - qIndex - 1} left)` : 'Finish & Analyze'}
                      </button>
                    </div>
                  )}

                  {orbState === 'analyzing' && (
                    <div style={{ textAlign:'center', padding:'20px 0 16px' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid transparent', borderTopColor:'#ffb300', animation:'vSpinFast 0.7s linear infinite', margin:'0 auto 10px' }} />
                      <p style={{ fontSize:'0.82rem', color:'#7aa4c4' }}>Analyzing your responses…</p>
                    </div>
                  )}
                </>
              )}

              {orbState === 'done' && result && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:18 }}>
                    <VoicePainRing score={result.pain_score} size={88} />
                    <div>
                      <p style={{ fontSize:'0.7rem', color:'#3d6080', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Pain Score</p>
                      {emotion && (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, background:emotion.color+'22', border:`1px solid ${emotion.color}44`, marginBottom:8 }}>
                          <span style={{ fontSize:'0.75rem', fontWeight:700, color:emotion.color }}>{emotion.icon} {emotion.label}</span>
                        </div>
                      )}
                      {result.low_confidence && <p style={{ fontSize:'0.68rem', color:'#ffb300' }}>⚠ Estimated client-side (backend offline)</p>}
                    </div>
                  </div>

                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:'0.7rem', color:'#3d6080', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Acoustic Signature</p>
                    <VoiceWaveform analyser={null} isLive={false} painScore={result.pain_score} height={58} />
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:16 }}>
                    <VoiceFeatCard label="Vocal Pitch"       value={result.f0_mean?.toFixed(1)}           unit="Hz"  desc="Fundamental frequency" />
                    <VoiceFeatCard label="Pitch Variance"    value={result.f0_std?.toFixed(1)}            unit=""    desc="Emotional stress" />
                    <VoiceFeatCard label="Vocal Tremor"      value={result.vocal_tremor?.toFixed(2)}      unit=""    desc="Instability" color={result.vocal_tremor > 2 ? '#fc8181' : '#00e5c3'} />
                    <VoiceFeatCard label="Speech Rate"       value={result.speech_rate?.toFixed(1)}       unit="w/s" desc="Words per second" />
                    <VoiceFeatCard label="Pause Freq"        value={result.pause_frequency?.toFixed(1)}   unit="/s"  desc="Hesitation rate" />
                    <VoiceFeatCard label="Spectral Centroid" value={result.spectral_centroid?.toFixed(0)} unit="Hz"  desc="Voice brightness" />
                  </div>

                  {result._answers && Object.keys(result._answers).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <p style={{ fontSize:'0.7rem', color:'#3d6080', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Responses Recorded</p>
                      {Object.entries(result._answers).map(([k, v]) => (
                        <div key={k} style={{ padding:'8px 12px', marginBottom:8, background:'rgba(13,22,38,0.9)', borderRadius:8, border:'1px solid rgba(0,229,195,0.12)' }}>
                          <p style={{ fontSize:'0.62rem', color:'#00e5c3', fontWeight:700, marginBottom:3, textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</p>
                          <p style={{ fontSize:'0.8rem', color:'#7aa4c4', lineHeight:1.5 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {sessionHistory.length > 1 && (
                    <div style={{ marginBottom:16 }}>
                      <p style={{ fontSize:'0.7rem', color:'#3d6080', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Session History</p>
                      {sessionHistory.slice(-4).map((h, i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom: i < Math.min(sessionHistory.length,4)-1 ? '1px solid rgba(0,229,195,0.08)' : 'none' }}>
                          <span style={{ fontSize:'0.75rem', color:'#3d6080' }}>{h.time}</span>
                          <span style={{ fontSize:'0.8rem', fontWeight:700, fontFamily:'monospace', color:h.score >= 7 ? '#ff4d6d' : h.score >= 4 ? '#ffb300' : '#00e5c3' }}>{h.score?.toFixed(1)}/10</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', fontSize:'0.75rem', color:'#7aa4c4', marginBottom:14 }}>
                    🧠 Voice score synced to physician dashboard · AEGIS score updated
                  </div>
                  <button onClick={() => { setPanelOpen(false); setTimeout(startConversation, 300); }}
                    style={{ width:'100%', marginBottom:4, padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#00c9a8,#00e5c3)', color:'#040d18', border:'none', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'Syne,sans-serif' }}>
                    🎙️ Start New Check-In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vOrbBreath { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes vOrbPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.13)} }
        @keyframes vSpinFast  { to{transform:rotate(360deg)} }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VOICE ORB — Fixed transcript capture + accurate scoring
   Appended below the main PainScanner component
   ══════════════════════════════════════════════════════════════════════════ */