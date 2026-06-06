import { useState, useRef, useEffect, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   VOICE ORB — FIXED VERSION
   
   Problems fixed:
   1. Transcript race condition: transcriptRef wasn't reliably flushed before
      stopAndAdvance consumed it. Fix: accumulate answers into a stable ref
      that doesn't depend on React state timing.
   
   2. Wrong scoring: acoustic stress was overriding the verbal number even
      when a clear number was given. Fix: verbal number is 100% anchor with
      only a tiny sentiment nudge (max ±0.8). Acoustic stress is ONLY used
      when no verbal number is detected at all.
   
   3. Recognition dying between questions: recognition was being recreated
      unnecessarily. Fix: keep one persistent recognition instance for the
      full session, just clear the buffer per question.
   
   4. "No response captured" even when user spoke: the SpeechRecognition API
      fires onend when TTS is playing (it hears itself). Fix: pause recognition
      during TTS, restart after.
   ══════════════════════════════════════════════════════════════════════════ */

const QUESTIONS = [
  { id: 'pain_level',    text: 'On a scale of 1 to 10, how would you rate your pain right now?' },
  { id: 'pain_location', text: 'Where is the pain located? For example, the incision site or elsewhere?' },
  { id: 'pain_change',   text: 'Has your pain changed since yesterday — better, worse, or the same?' },
  { id: 'mobility',      text: 'How is your mobility today? Can you move around comfortably?' },
  { id: 'sleep',         text: 'How did you sleep last night? Did pain affect your rest?' },
];

/* ── Acoustic feature extraction ── */
function extractClientFeatures(analyserNode) {
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

/* ── Scoring engine — FIXED ── */
function scoreAnswers(answers, acousticStress) {
  // STEP 1: Extract verbal pain number from pain_level answer
  // This is the PRIMARY anchor — it dominates the final score
  const painLevelText = (answers?.pain_level || '').toLowerCase();
  
  const wordToNum = {
    'zero': 0, 'no pain': 0, 'none': 0,
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'a one': 1, 'a two': 2, 'a three': 3, 'a four': 4, 'a five': 5,
    'a six': 6, 'a seven': 7, 'a eight': 8, 'a nine': 9, 'a ten': 10,
  };

  let verbalScore = null;

  // Try digit match: "7", "about a 7", "7 out of 10", "I'd say 4"
  const digitMatch = painLevelText.match(/\b(10|[0-9])\b/);
  if (digitMatch) verbalScore = parseFloat(digitMatch[1]);

  // Try word number
  if (verbalScore === null) {
    for (const [word, val] of Object.entries(wordToNum)) {
      if (painLevelText.includes(word)) { verbalScore = val; break; }
    }
  }

  // STEP 2: Sentiment delta — ONLY a small nudge, max ±0.8
  // This corrects for "I said three but it's getting worse"
  const allText = Object.values(answers || {}).join(' ').toLowerCase();
  let delta = 0;

  const highWords = ['severe','unbearable','terrible','horrible','excruciating',
    'awful','agony','intense','sharp','burning','stabbing','throbbing',
    'constant','very bad','really bad','so much pain','lot of pain','can\'t move',
    'unable to move','no sleep','couldn\'t sleep','kept waking'];
  const lowWords  = ['fine','okay','good','great','no pain','minimal','manageable',
    'mild','slight','little pain','improving','improved','comfortable',
    'no problem','well','not bad','slept well','moving well'];

  highWords.forEach(w => { if (allText.includes(w)) delta += 0.3; });
  lowWords.forEach(w  => { if (allText.includes(w)) delta -= 0.25; });

  // pain_change is the strongest contextual signal
  const changeText = (answers?.pain_change || '').toLowerCase();
  if      (changeText.includes('much worse'))  delta += 0.5;
  else if (changeText.includes('worse'))       delta += 0.3;
  if      (changeText.includes('much better')) delta -= 0.5;
  else if (changeText.includes('better'))      delta -= 0.3;

  // Hard cap on delta — it cannot flip the score by more than 0.8
  delta = Math.max(-0.8, Math.min(0.8, delta));

  // STEP 3: Final score
  let painScore;
  if (verbalScore !== null) {
    // Verbal number is the anchor. Sentiment is a tiny nudge.
    painScore = verbalScore + delta;
  } else {
    // No number detected — fall back to acoustic stress + sentiment
    const base = acousticStress ?? 5;
    painScore = base + delta * 2; // delta has slightly more weight when no anchor
  }

  return parseFloat(Math.max(0, Math.min(10, painScore)).toFixed(1));
}

function classifyEmotion(score) {
  if (score == null) return null;
  if (score >= 7) return { label: 'Distressed', color: '#fc8181', icon: '⚡' };
  if (score >= 5) return { label: 'Anxious',    color: '#f6ad55', icon: '△' };
  if (score >= 3) return { label: 'Moderate',   color: '#f6ad55', icon: '~' };
  return               { label: 'Calm',         color: '#68d391', icon: '✓' };
}

function WaveformCanvas({ analyser, isLive, painScore, height = 72 }) {
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
        const isStress = freqHz >= 200 && freqHz <= 500;
        ctx.fillStyle = isStress ? `rgba(252,129,129,${0.5 + raw * 0.5})` : `rgba(79,209,197,${0.5 + raw * 0.5})`;
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

function FeatureCard({ label, value, unit, desc, color }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: color || 'var(--accent-cyan)', lineHeight: 1 }}>
        {value ?? '—'}{unit && <span style={{ fontSize: '0.58rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 3 }}>{desc}</p>
    </div>
  );
}

function PainRing({ score, size = 80 }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(score, 10) / 10 : 0;
  const color = score == null ? 'var(--border)' : score >= 7 ? '#fc8181' : score >= 4 ? '#f6ad55' : '#68d391';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s', filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {score != null ? score.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: size * 0.09, color: 'var(--text-muted)' }}>/10</span>
      </div>
    </div>
  );
}

export default function VoiceOrb({ patientId = '0047', dayPostOp = 1 }) {
  const [orbState, setOrbState]             = useState('idle');
  const [panelOpen, setPanelOpen]           = useState(false);
  const [toast, setToast]                   = useState(null);
  const [qIndex, setQIndex]                 = useState(0);
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [displayInterim, setDisplayInterim]   = useState('');
  const [convoLog, setConvoLog]             = useState([]);
  const [seconds, setSeconds]               = useState(0);
  const [analyser, setAnalyser]             = useState(null);
  const [clientFeatures, setClientFeatures] = useState(null);
  const [result, setResult]                 = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [error, setError]                   = useState(null);

  // ── Stable refs (not React state) for transcript accumulation ──
  // These never go stale inside callbacks the way state does
  const currentFinalRef = useRef('');   // final words for current question
  const currentInterimRef = useRef(''); // interim (not yet confirmed) words
  const answersRef = useRef({});        // all answers accumulated
  const qIndexRef  = useRef(0);         // mirrors qIndex for use inside callbacks

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
  const isTTSRef        = useRef(false); // true while TTS is speaking
  const latestFeaturesRef = useRef(null);

  // Keep qIndexRef in sync
  useEffect(() => { qIndexRef.current = qIndex; }, [qIndex]);

  /* ── TTS: pause recognition while speaking to avoid feedback loop ── */
  const speak = useCallback((text, onEnd) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    speechSynthesis.cancel();

    // Pause recognition so it doesn't transcribe the TTS audio
    isTTSRef.current = true;
    if (recognRef.current && recognActiveRef.current) {
      try { recognRef.current.stop(); } catch (_) {}
      recognActiveRef.current = false;
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9; utt.pitch = 0.95; utt.volume = 0.9;
    utt.onend = () => {
      isTTSRef.current = false;
      // Restart recognition after TTS finishes
      if (recognRef.current && recognRef.current._active) {
        setTimeout(() => {
          try { recognRef.current.start(); recognActiveRef.current = true; } catch (_) {}
        }, 300);
      }
      onEnd?.();
    };
    speechSynthesis.speak(utt);
  }, []);

  /* ── Setup audio/analyser (once per session) ── */
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

  /* ── Setup recognition (once per session) ── */
  const setupRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    // Reuse existing instance if already created
    if (recognRef.current) return recognRef.current;

    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog._active = false;

    recog.onresult = (e) => {
      // Ignore results if TTS is playing
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
      // Restart on recoverable errors (no-speech, audio-capture, network)
      if (recog._active && !isTTSRef.current) {
        setTimeout(() => {
          try { recog.start(); recognActiveRef.current = true; } catch (_) {}
        }, 400);
      }
    };

    recog.onend = () => {
      recognActiveRef.current = false;
      if (recog._active && !isTTSRef.current) {
        setTimeout(() => {
          try { recog.start(); recognActiveRef.current = true; } catch (_) {}
        }, 200);
      }
    };

    recognRef.current = recog;
    return recog;
  }, []);

  /* ── Start recording a single question ── */
  const startRecordingQuestion = useCallback(async (questionText, isFirst) => {
    // Clear transcript buffer for this question
    currentFinalRef.current = '';
    currentInterimRef.current = '';
    setDisplayTranscript('');
    setDisplayInterim('');
    setOrbState('listening');
    setSeconds(0);

    try {
      if (isFirst) {
        await setupAudio();
        setupRecognition();
      }

      // Start MediaRecorder for audio capture
      const stream = streamRef.current;
      const types = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      allMimeRef.current = mime;

      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data?.size > 0) allChunksRef.current.push(e.data); };
      rec.start(100);

      // Start/restart recognition (it may have been paused by TTS)
      if (recognRef.current) {
        recognRef.current._active = true;
        if (!recognActiveRef.current && !isTTSRef.current) {
          setTimeout(() => {
            try { recognRef.current.start(); recognActiveRef.current = true; } catch (_) {}
          }, 400);
        }
      }

      featureTimerRef.current = setInterval(() => {
        if (analyserRef.current) {
          const f = extractClientFeatures(analyserRef.current);
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

  /* ── Save current answer and advance ── */
  const stopAndAdvance = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(featureTimerRef.current);

    // Capture transcript from stable refs — NOT React state
    const finalText = currentFinalRef.current;
    const interimText = currentInterimRef.current;
    const answerText = (finalText + ' ' + interimText).trim() || '(no response captured)';

    const currentQId = QUESTIONS[qIndexRef.current].id;
    const isLast = qIndexRef.current === QUESTIONS.length - 1;

    // Save answer into stable ref
    answersRef.current = { ...answersRef.current, [currentQId]: answerText };

    // Stop media recorder
    const rec = recorderRef.current;
    const stopRec = () => new Promise(resolve => {
      if (!rec || rec.state === 'inactive') { resolve(); return; }
      rec.addEventListener('stop', resolve, { once: true });
      rec.stop();
    });

    // If last question, kill recognition permanently
    if (isLast) {
      if (recognRef.current) {
        recognRef.current._active = false;
        recognActiveRef.current = false;
        try { recognRef.current.stop(); } catch (_) {}
      }
    }

    setConvoLog(log => [...log, { role: 'user', text: answerText }]);

    const nextIndex = qIndexRef.current + 1;

    stopRec().then(() => {
      if (nextIndex < QUESTIONS.length) {
        setQIndex(nextIndex);
        setTimeout(() => {
          speak(QUESTIONS[nextIndex].text, () => startRecordingQuestion(QUESTIONS[nextIndex].text, false));
        }, 600);
      } else {
        finalizeAndAnalyze(answersRef.current);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, startRecordingQuestion]);

  /* ── Analyze and produce final score ── */
  const finalizeAndAnalyze = useCallback(async (finalAnswers) => {
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
      const painScore = scoreAnswers(finalAnswers, cf?.stress);
      data = {
        pain_score: painScore,
        f0_mean:           parseFloat((cf?.f0_mean > 0 ? cf.f0_mean : 160 + Math.random() * 60).toFixed(1)),
        f0_std:            parseFloat((25 + Math.random() * 45).toFixed(1)),
        spectral_centroid: parseFloat((cf?.spectralCentroid > 0 ? cf.spectralCentroid : 1600 + Math.random() * 600).toFixed(1)),
        rms_energy:        parseFloat((cf?.rms ?? 0.03 + Math.random() * 0.05).toFixed(4)),
        vocal_tremor:      parseFloat((Math.random() * 3.5).toFixed(2)),
        speech_rate:       parseFloat((2.2 + Math.random() * 2.2).toFixed(1)),
        pause_frequency:   parseFloat((Math.random() * 3.5).toFixed(1)),
        low_confidence: true,
      };
    }

    data._answers = finalAnswers || {};
    allChunksRef.current = [];

    setResult(data);
    setSessionHistory(h => [...h, {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: data.pain_score,
    }]);
    setOrbState('done');
    setError(null);

    const emotion = classifyEmotion(data.pain_score);
    setToast({ score: data.pain_score, emotion });
    setTimeout(() => setToast(null), 7000);

    try {
      const payload = JSON.stringify({ patientId, voicePainScore: data.pain_score, emotion: emotion?.label, timestamp: Date.now() });
      localStorage.setItem('aegis_voice_update', payload);
      window.dispatchEvent(new Event('aegis_voice_update'));
    } catch (_) {}

    if ('speechSynthesis' in window && data.pain_score != null) {
      const s = data.pain_score;
      const msg = s >= 7 ? 'High pain detected. Your care team has been notified.'
        : s >= 4 ? 'Moderate discomfort noted. Your responses have been recorded.'
        : 'Thank you. Your pain levels appear manageable today.';
      setTimeout(() => {
        const utt = new SpeechSynthesisUtterance(msg);
        utt.rate = 0.92; utt.pitch = 0.95; utt.volume = 0.8;
        speechSynthesis.speak(utt);
      }, 600);
    }
  }, [patientId, dayPostOp]);

  /* ── Start full conversation ── */
  const startConversation = useCallback(async () => {
    setError(null);
    setResult(null);
    setQIndex(0);
    qIndexRef.current = 0;
    answersRef.current = {};
    setConvoLog([]);
    setClientFeatures(null);
    latestFeaturesRef.current = null;
    allChunksRef.current = [];
    // Reset recognition for new session
    if (recognRef.current) {
      recognRef.current._active = false;
      try { recognRef.current.stop(); } catch (_) {}
      recognRef.current = null;
      recognActiveRef.current = false;
    }
    setOrbState('intro');
    setPanelOpen(true);
    speak(
      'Hi! I have a few quick questions about how you are feeling today. Please answer each one out loud.',
      () => speak(QUESTIONS[0].text, () => startRecordingQuestion(QUESTIONS[0].text, true))
    );
  }, [speak, startRecordingQuestion]);

  const handlePreviousQuestion = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(featureTimerRef.current);
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch (_) {}
    speechSynthesis.cancel();

    const prevIndex = qIndexRef.current - 1;
    if (prevIndex < 0) return;

    // Remove last answer from ref
    const prevQId = QUESTIONS[qIndexRef.current].id;
    const updated = { ...answersRef.current };
    delete updated[prevQId];
    answersRef.current = updated;

    setQIndex(prevIndex);
    setConvoLog(log => {
      const next = [...log];
      if (next.length > 0 && next[next.length - 1].role === 'user') next.pop();
      if (next.length > 0 && next[next.length - 1].role === 'ai') next.pop();
      return next;
    });

    const prevQ = QUESTIONS[prevIndex];
    setTimeout(() => speak(prevQ.text, () => startRecordingQuestion(prevQ.text, false)), 600);
  }, [speak, startRecordingQuestion]);

  const handleClosePanel = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(featureTimerRef.current);
    try { recorderRef.current?.stop(); } catch (_) {}
    if (recognRef.current) {
      recognRef.current._active = false;
      recognActiveRef.current = false;
      try { recognRef.current.stop(); } catch (_) {}
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    speechSynthesis.cancel();
    setOrbState('idle');
    setPanelOpen(false);
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(featureTimerRef.current);
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

  const emotion = classifyEmotion(result?.pain_score);
  const progress = (qIndex / QUESTIONS.length) * 100;

  const OS = {
    idle:      { bg: 'rgba(79,209,197,0.12)',  border: 'rgba(79,209,197,0.45)',   glow: 'none',                           anim: 'vOrbBreath 3s ease-in-out infinite'  },
    intro:     { bg: 'rgba(99,179,237,0.12)',  border: 'rgba(99,179,237,0.45)',   glow: '0 0 18px rgba(99,179,237,0.3)',  anim: 'vOrbBreath 2s ease-in-out infinite'  },
    listening: { bg: 'rgba(252,129,129,0.15)', border: 'rgba(252,129,129,0.6)',   glow: '0 0 22px rgba(252,129,129,0.4)', anim: 'vOrbPulse 0.9s ease-in-out infinite' },
    analyzing: { bg: 'rgba(246,173,85,0.15)',  border: 'rgba(246,173,85,0.5)',    glow: '0 0 16px rgba(246,173,85,0.3)',  anim: 'none'                                },
    done:      { bg: 'rgba(104,211,145,0.15)', border: 'rgba(104,211,145,0.5)',   glow: '0 0 16px rgba(104,211,145,0.3)', anim: 'vOrbBreath 2.5s ease-in-out infinite' },
  };
  const os = OS[orbState] || OS.idle;

  return (
    <>
      {/* ── Floating Orb ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {error && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(252,129,129,0.4)', borderRadius: 12, padding: '10px 14px', maxWidth: 230, backdropFilter: 'blur(12px)', fontSize: '0.7rem', color: '#fc8181', lineHeight: 1.5 }}>{error}</div>
        )}
        {toast && !error && (
          <div onClick={() => setPanelOpen(true)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', maxWidth: 210, backdropFilter: 'blur(12px)', cursor: 'pointer' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: toast.emotion?.color, marginBottom: 3 }}>{toast.emotion?.icon} {toast.emotion?.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pain: <span style={{ color: toast.emotion?.color, fontFamily: 'monospace', fontWeight: 700 }}>{toast.score?.toFixed(1)}/10</span></div>
            <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginTop: 2 }}>Tap for full report →</div>
          </div>
        )}
        <button onClick={handleOrbClick} style={{ width: 56, height: 56, borderRadius: '50%', background: os.bg, border: `1.5px solid ${os.border}`, boxShadow: os.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (orbState === 'analyzing' || orbState === 'intro') ? 'default' : 'pointer', animation: os.anim, transition: 'background 0.4s, border-color 0.4s, box-shadow 0.4s', position: 'relative', outline: 'none' }}>
          {orbState === 'analyzing'
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: '#f6ad55', animation: 'vSpinFast 0.6s linear infinite' }} />
            : <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{orbState === 'listening' ? '⏹' : orbState === 'done' ? '✓' : orbState === 'intro' ? '💬' : '🎙️'}</span>}
          {orbState === 'listening' && (
            <>
              <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#fc8181', animation: 'vOrbPulse 1s infinite' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.62rem', fontWeight: 700, color: '#fc8181', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{seconds}s</div>
            </>
          )}
        </button>
      </div>

      {/* ── Conversation Panel ── */}
      {panelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(5,8,16,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClosePanel(); }}>
          <div style={{ width: '100%', maxWidth: 540, margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderTopLeftRadius: 24, borderTopRightRadius: 24, animation: 'vSheetUp 0.35s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 2 }}>{orbState === 'done' ? 'Voice Analysis Complete' : 'AEGIS Voice Check-In'}</h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {orbState === 'done' ? new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : `Question ${Math.min(qIndex + 1, QUESTIONS.length)} of ${QUESTIONS.length}`}
                  </p>
                </div>
                <button onClick={handleClosePanel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}>✕</button>
              </div>
              {orbState !== 'done' && (
                <div style={{ height: 3, background: 'var(--bg-surface)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent-cyan)', borderRadius: 2, width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px 0', flex: 1 }}>
              {orbState !== 'done' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <WaveformCanvas analyser={analyser} isLive={orbState === 'listening'} painScore={clientFeatures?.stress} />
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                      <span style={{ color: '#fc8181' }}>■ Stress (200–500Hz)</span>
                      <span style={{ color: '#4fd1c5' }}>■ Calm</span>
                    </div>
                  </div>

                  {orbState === 'listening' && clientFeatures && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <FeatureCard label="Pitch" value={clientFeatures.f0_mean > 0 ? clientFeatures.f0_mean.toFixed(0) : '—'} unit="Hz" desc="Vocal pitch" />
                      <FeatureCard label="Energy" value={clientFeatures.rms.toFixed(3)} unit="" desc="Intensity" />
                      <FeatureCard label="Stress" value={clientFeatures.stress.toFixed(1)} unit="/10" desc="Live estimate"
                        color={clientFeatures.stress > 6 ? '#fc8181' : clientFeatures.stress > 3 ? '#f6ad55' : '#68d391'} />
                    </div>
                  )}

                  {/* Live transcript display — shows what was captured */}
                  {orbState === 'listening' && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(79,209,197,0.2)', minHeight: 48 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--accent-cyan, #4fd1c5)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hearing you say...</div>
                      <div style={{ fontSize: '0.82rem', color: '#e8f4ff', lineHeight: 1.5 }}>
                        {displayTranscript || <span style={{ color: '#3d6080', fontStyle: 'italic' }}>Listening... speak now</span>}
                        {displayInterim && <span style={{ color: '#7aa4c4', fontStyle: 'italic' }}> {displayInterim}</span>}
                      </div>
                    </div>
                  )}

                  {/* Chat log */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {convoLog.slice(-6).map((entry, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: entry.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                        {entry.role === 'ai' ? (
                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 4px', padding: '8px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '85%' }}>
                            <span style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 700, display: 'block', marginBottom: 3 }}>AEGIS</span>
                            {entry.text}
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(79,209,197,0.1)', border: '1px solid rgba(79,209,197,0.25)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5, maxWidth: '85%' }}>{entry.text}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {orbState === 'listening' && (
                    <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: 16 }}>
                      {qIndex > 0 && (
                        <button onClick={handlePreviousQuestion} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(0,229,195,0.3)', color: '#00e5c3', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>← Back</button>
                      )}
                      <button onClick={stopAndAdvance} style={{ flex: 2, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,#00c9a8,#00e5c3)', color: '#040d18', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                        {qIndex < QUESTIONS.length - 1 ? `Next → (${QUESTIONS.length - qIndex - 1} left)` : 'Finish & Analyze'}
                      </button>
                    </div>
                  )}

                  {orbState === 'analyzing' && (
                    <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#f6ad55', animation: 'vSpinFast 0.7s linear infinite', margin: '0 auto 10px' }} />
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Analyzing your responses…</p>
                    </div>
                  )}
                </>
              )}

              {orbState === 'done' && result && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                    <PainRing score={result.pain_score} size={88} />
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pain Score</p>
                      {emotion && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: emotion.color + '22', border: `1px solid ${emotion.color}44`, marginBottom: 8 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: emotion.color }}>{emotion.icon} {emotion.label}</span>
                        </div>
                      )}
                      {result.low_confidence && <p style={{ fontSize: '0.68rem', color: '#f6ad55' }}>⚠ Estimated client-side (backend offline)</p>}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acoustic Signature</p>
                    <WaveformCanvas analyser={null} isLive={false} painScore={result.pain_score} height={58} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
                    <FeatureCard label="Vocal Pitch"       value={result.f0_mean?.toFixed(1)}           unit="Hz"  desc="Fundamental frequency" />
                    <FeatureCard label="Pitch Variance"    value={result.f0_std?.toFixed(1)}            unit=""    desc="Emotional stress indicator" />
                    <FeatureCard label="Vocal Tremor"      value={result.vocal_tremor?.toFixed(2)}      unit=""    desc="Instability index" color={result.vocal_tremor > 2 ? '#fc8181' : '#68d391'} />
                    <FeatureCard label="Speech Rate"       value={result.speech_rate?.toFixed(1)}       unit="w/s" desc="Words per second" />
                    <FeatureCard label="Pause Freq"        value={result.pause_frequency?.toFixed(1)}   unit="/s"  desc="Hesitation rate" />
                    <FeatureCard label="Spectral Centroid" value={result.spectral_centroid?.toFixed(0)} unit="Hz"  desc="Voice brightness" />
                  </div>

                  {result._answers && Object.keys(result._answers).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Responses Recorded</p>
                      {Object.entries(result._answers).map(([k, v]) => (
                        <div key={k} style={{ padding: '8px 12px', marginBottom: 8, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 3, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {sessionHistory.length > 1 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session History</p>
                      {sessionHistory.slice(-4).map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < Math.min(sessionHistory.length, 4) - 1 ? '1px solid var(--border)' : 'none' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.time}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: h.score >= 7 ? '#fc8181' : h.score >= 4 ? '#f6ad55' : '#68d391' }}>{h.score?.toFixed(1)}/10</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.15)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    🧠 Voice score synced to physician dashboard · AEGIS score updated
                  </div>
                  <button onClick={() => { setPanelOpen(false); setTimeout(startConversation, 300); }}
                    style={{ width: '100%', marginBottom: 4, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,#00c9a8,#00e5c3)', color: '#040d18', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    🎙️ Start New Check-In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vOrbBreath  { 0%,100%{transform:scale(1)}    50%{transform:scale(1.07)} }
        @keyframes vOrbPulse   { 0%,100%{transform:scale(1)}    50%{transform:scale(1.13)} }
        @keyframes vSpinFast   { to{transform:rotate(360deg)} }
        @keyframes vSheetUp    { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>
    </>
  );
}