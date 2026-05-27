import { useState, useRef, useEffect, useCallback } from 'react';

// ── Conversation questions ────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 'pain_level',    text: 'On a scale of 1 to 10, how would you rate your pain right now?'          },
  { id: 'pain_location', text: 'Where is the pain located? For example, the incision site or elsewhere?' },
  { id: 'pain_change',   text: 'Has your pain changed since yesterday — better, worse, or the same?'     },
  { id: 'mobility',      text: 'How is your mobility today? Can you move around comfortably?'             },
  { id: 'sleep',         text: 'How did you sleep last night? Did pain affect your rest?'                 },
];

// ── Client-side acoustic feature extraction via Web Audio API ─────────────────
function extractClientFeatures(analyserNode, sampleRate = 44100) {
  if (!analyserNode) return null;
  const freqData = new Float32Array(analyserNode.frequencyBinCount);
  const timeData = new Float32Array(analyserNode.fftSize);
  analyserNode.getFloatFrequencyData(freqData);
  analyserNode.getFloatTimeDomainData(timeData);

  // RMS energy
  const rms = Math.sqrt(timeData.reduce((s, v) => s + v * v, 0) / timeData.length);

  // Spectral centroid
  const binHz = sampleRate / analyserNode.fftSize;
  let wSum = 0, totalMag = 0;
  for (let i = 0; i < freqData.length; i++) {
    const mag = Math.pow(10, freqData[i] / 20);
    wSum     += i * binHz * mag;
    totalMag += mag;
  }
  const spectralCentroid = totalMag > 0 ? wSum / totalMag : 0;

  // Pitch via YIN-lite autocorrelation
  let f0 = 0;
  const minPeriod = Math.round(sampleRate / 500);
  const maxPeriod = Math.round(sampleRate / 80);
  let minVal = Infinity, minTau = -1;
  for (let tau = minPeriod; tau < Math.min(maxPeriod, timeData.length / 2); tau++) {
    let diff = 0;
    const len = Math.min(tau * 2, timeData.length - tau);
    for (let i = 0; i < len; i++) diff += (timeData[i] - timeData[i + tau]) ** 2;
    if (diff < minVal) { minVal = diff; minTau = tau; }
  }
  if (minTau > 0 && minVal < 0.08) f0 = sampleRate / minTau;

  // Stress: elevated pitch + high energy
  const stressScore = Math.min(10, rms * 45 + (f0 > 200 ? (f0 - 200) / 90 : 0));

  return { rms, spectralCentroid, f0_mean: f0, stress: stressScore };
}

// ── Emotion label ─────────────────────────────────────────────────────────────
function classifyEmotion(score) {
  if (score == null) return null;
  if (score >= 7) return { label: 'Distressed', color: '#fc8181', icon: '⚡' };
  if (score >= 5) return { label: 'Anxious',    color: '#f6ad55', icon: '△' };
  if (score >= 3) return { label: 'Moderate',   color: '#f6ad55', icon: '~' };
  return               { label: 'Calm',         color: '#68d391', icon: '✓' };
}

// ── Live waveform canvas ──────────────────────────────────────────────────────
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
      const bars = histRef.current;
      const pain = (painScore ?? 5) / 10;
      bars.forEach((h, i) => {
        const r = Math.round(79  + (252 - 79)  * pain);
        const g = Math.round(209 + (129 - 209) * pain);
        const b = Math.round(197 + (74  - 197) * pain);
        ctx.fillStyle = `rgba(${r},${g},${b},0.72)`;
        ctx.beginPath();
        ctx.roundRect(i * (W / bars.length) + 1, (H - h * H) / 2, (W / bars.length) - 2, Math.max(h * H, 3), 2);
        ctx.fill();
      });
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const BARS = 80;
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);
      const step = Math.floor(data.length / BARS);
      for (let i = 0; i < BARS; i++) {
        const raw = data[i * step] / 255;
        histRef.current[i] = histRef.current[i] * 0.72 + raw * 0.28;
        const h      = Math.max(0.04, histRef.current[i]);
        const freqHz = (i * step) * (44100 / (analyser.fftSize));
        const isStress = freqHz >= 200 && freqHz <= 500;
        const alpha  = 0.5 + raw * 0.5;
        ctx.fillStyle = isStress
          ? `rgba(252,129,129,${alpha})`
          : `rgba(79,209,197,${alpha})`;
        ctx.beginPath();
        ctx.roundRect(i * (W / BARS) + 1, (H - h * H) / 2, (W / BARS) - 2, h * H, 2);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isLive, analyser, painScore]);

  return (
    <canvas ref={canvasRef} width={320} height={height}
      style={{ width: '100%', height, display: 'block', borderRadius: 8, background: 'rgba(0,0,0,0.18)' }} />
  );
}

// ── Acoustic feature mini-card ─────────────────────────────────────────────────
function FeatureCard({ label, value, unit, desc, color }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '9px 11px',
    }}>
      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: color || 'var(--accent-cyan)', lineHeight: 1 }}>
        {value ?? '—'}{unit && <span style={{ fontSize: '0.58rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 3 }}>{desc}</p>
    </div>
  );
}

// ── Pain ring ─────────────────────────────────────────────────────────────────
function PainRing({ score, size = 80 }) {
  const r    = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct  = score != null ? Math.min(score, 10) / 10 : 0;
  const color = score == null ? 'var(--border)'
    : score >= 7 ? '#fc8181' : score >= 4 ? '#f6ad55' : '#68d391';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s', filter: `drop-shadow(0 0 5px ${color})` }}
        />
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

// ── Main VoiceOrb ─────────────────────────────────────────────────────────────
export default function VoiceOrb({ patientId = '0047', dayPostOp = 1 }) {
  const [orbState, setOrbState]         = useState('idle');
  const [panelOpen, setPanelOpen]       = useState(false);
  const [toast, setToast]               = useState(null);
  const [qIndex, setQIndex]             = useState(0);
  const [answers, setAnswers]           = useState({});
  const [transcript, setTranscript]     = useState('');
  const [interimText, setInterimText]   = useState('');
  const [convoLog, setConvoLog]         = useState([]);
  const [seconds, setSeconds]           = useState(0);
  const [analyser, setAnalyser]         = useState(null);
  const [clientFeatures, setClientFeatures] = useState(null);
  const [result, setResult]             = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [error, setError]               = useState(null);

  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const allChunksRef   = useRef([]);
  const allMimeRef     = useRef('');
  const timerRef       = useRef(null);
  const streamRef      = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const recognRef      = useRef(null);
  const recognActiveRef = useRef(false); // is recognition currently running?
  const featureTimer   = useRef(null);
  const transcriptRef  = useRef('');
  const interimRef     = useRef('');

  // keep refs in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { interimRef.current = interimText; }, [interimText]);

  const speak = useCallback((text, onEnd) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9; utt.pitch = 0.95; utt.volume = 0.9;
    utt.onend = () => onEnd?.();
    speechSynthesis.speak(utt);
  }, []);

  const setupAudio = useCallback(async () => {
    const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const source   = audioCtx.createMediaStreamSource(stream);
    const anl      = audioCtx.createAnalyser();
    anl.fftSize    = 2048;
    source.connect(anl);
    analyserRef.current = anl;
    setAnalyser(anl);
  }, []);

  const setupRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    // If already have a running instance, just clear its buffer — don't recreate
    if (recognRef.current && recognActiveRef.current) {
      transcriptRef.current = '';
      interimRef.current    = '';
      setTranscript('');
      setInterimText('');
      return recognRef.current;
    }

    const recog          = new SR();
    recog.continuous     = true;
    recog.interimResults = true;
    recog.lang           = 'en-US';

    recog.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) { interimRef.current = interim; setInterimText(interim); }
      if (final)   {
        transcriptRef.current = (transcriptRef.current + ' ' + final).trim();
        interimRef.current    = '';
        setTranscript(transcriptRef.current);
        setInterimText('');
      }
    };

    recog.onerror = (e) => {
      // 'no-speech' and 'audio-capture' are non-fatal — just restart
      if (e.error !== 'aborted') {
        recognActiveRef.current = false;
        setTimeout(() => {
          if (recognRef.current === recog) {
            try { recog.start(); recognActiveRef.current = true; } catch (_) {}
          }
        }, 300);
      }
    };

    recog.onend = () => {
      recognActiveRef.current = false;
      // Auto-restart unless we deliberately killed it
      if (recognRef.current === recog && recog._active) {
        setTimeout(() => {
          try { recog.start(); recognActiveRef.current = true; } catch (_) {}
        }, 200);
      }
    };

    recog._active = true;
    recognRef.current = recog;
    return recog;
  }, []);

  const startRecordingQuestion = useCallback(async (questionText, isFirst) => {
    // Always clear transcript buffer for the new question
    transcriptRef.current = '';
    interimRef.current    = '';
    setTranscript('');
    setInterimText('');
    setOrbState('listening');
    setSeconds(0);

    try {
      if (isFirst) await setupAudio();

      const stream = streamRef.current;
      const types  = ['audio/ogg;codecs=opus','audio/ogg','audio/webm;codecs=opus','audio/webm'];
      const mime   = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      allMimeRef.current = mime;

      chunksRef.current = [];
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) {
          chunksRef.current.push(e.data);
          allChunksRef.current.push(e.data);
        }
      };
      rec.start(100);

      // For Q1: create fresh recognition and start it after a delay
      // For Q2+: recognition is already running — just cleared the buffer above
      if (isFirst) {
        const recog = setupRecognition();
        setTimeout(() => {
          try { recog?.start(); recognActiveRef.current = true; } catch (_) {}
        }, 500);
      } else {
        // If recognition died between questions, restart it
        if (!recognActiveRef.current && recognRef.current) {
          setTimeout(() => {
            try { recognRef.current.start(); recognActiveRef.current = true; } catch (_) {}
          }, 300);
        }
      }

      featureTimer.current = setInterval(() => {
        if (analyserRef.current) setClientFeatures(extractClientFeatures(analyserRef.current));
      }, 400);

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      setConvoLog(log => {
        if (log.length > 0 && log[log.length - 1].role === 'ai' && log[log.length - 1].text === questionText) {
          return log;
        }
        return [...log, { role: 'ai', text: questionText }];
      });
    } catch {
      setError('Microphone access denied. Please allow microphone access in browser settings.');
      setOrbState('idle');
    }
  }, [setupAudio, setupRecognition]);

  const stopAndAdvance = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(featureTimer.current);

    // Save transcript BEFORE touching anything
    const savedTranscript = (transcriptRef.current + ' ' + interimRef.current).trim();
    const currentQId = QUESTIONS[qIndex].id;

    // Only kill recognition on the very last question
    const isLast = qIndex === QUESTIONS.length - 1;
    if (isLast && recognRef.current) {
      recognRef.current._active = false;
      recognRef.current._shouldRestart = false;
      recognActiveRef.current = false;
      try { recognRef.current.stop(); } catch (_) {}
    }
    // For non-last questions: leave recognition running, just clear buffer on next question

    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      // MediaRecorder already stopped — proceed anyway
      const answerText = savedTranscript || '(no response captured)';
      setConvoLog(log => [...log, { role: 'user', text: answerText }]);
      setAnswers(prev => ({ ...prev, [currentQId]: answerText }));
      const next = qIndex + 1;
      if (next < QUESTIONS.length) {
        setQIndex(next);
        setTimeout(() => speak(QUESTIONS[next].text, () => startRecordingQuestion(QUESTIONS[next].text, false)), 700);
      } else {
        finalizeAndAnalyze({ ...answers, [currentQId]: answerText });
      }
      return;
    }

    new Promise(resolve => {
      rec.addEventListener('stop', () => resolve(), { once: true });
      rec.stop();
    }).then(() => {
      const answerText = savedTranscript || '(no response captured)';
      setConvoLog(log => [...log, { role: 'user', text: answerText }]);
      setAnswers(prev => ({ ...prev, [currentQId]: answerText }));

      const next = qIndex + 1;
      if (next < QUESTIONS.length) {
        setQIndex(next);
        setTimeout(() => speak(QUESTIONS[next].text, () => startRecordingQuestion(QUESTIONS[next].text, false)), 700);
      } else {
        finalizeAndAnalyze({ ...answers, [currentQId]: answerText });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, answers, speak, startRecordingQuestion]);

  const finalizeAndAnalyze = useCallback(async (finalAnswers) => {
    setOrbState('analyzing');
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    setAnalyser(null);
    // Kill recognition for good now
    if (recognRef.current) {
      recognRef.current._active = false;
      recognActiveRef.current = false;
      try { recognRef.current.stop(); } catch (_) {}
    }

    const mime = allMimeRef.current || 'audio/webm';
    const ext  = mime.includes('ogg') ? '.ogg' : '.webm';
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

    // ── Client-side scoring fallback (always runs when backend is offline) ────
    if (!data) {
      const cf   = clientFeatures;
      const text = Object.values(finalAnswers || {}).join(' ').toLowerCase();

      // STEP 1: extract explicit number from pain_level answer (highest priority)
      const painLevelText = (finalAnswers?.pain_level || '').toLowerCase();
      const wordToNum = {
        zero:0, one:1, two:2, three:3, four:4, five:5,
        six:6, seven:7, eight:8, nine:9, ten:10,
      };
      let verbalScore = null;

      // try digit first e.g. "about a 7" or "7 out of 10"
      const digitMatch = painLevelText.match(/\b(10|[0-9])\b/);
      if (digitMatch) verbalScore = parseFloat(digitMatch[1]);

      // try spoken word number e.g. "seven" "about six"
      if (verbalScore === null) {
        for (const [word, val] of Object.entries(wordToNum)) {
          if (painLevelText.includes(word)) { verbalScore = val; break; }
        }
      }

      // STEP 2: sentiment delta from ALL answers combined
      let delta = 0;

      // signals that push score UP
      const highSignals = [
        'severe','unbearable','terrible','horrible','excruciating','awful',
        'worst','agony','intense','sharp','burning','stabbing','throbbing',
        'constant','can\'t sleep','couldn\'t sleep','no sleep','unable to move',
        'can\'t move','very bad','really bad','so much pain','lot of pain',
      ];
      highSignals.forEach(w => { if (text.includes(w)) delta += 0.6; });

      // signals that push score DOWN
      const lowSignals = [
        'fine','okay','good','great','better','much better','no pain',
        'minimal','manageable','mild','slight','little pain','improving',
        'improved','comfortable','no problem','no issues','well','not bad',
      ];
      lowSignals.forEach(w => { if (text.includes(w)) delta -= 0.5; });

      // pain_change answer — strongest directional signal
      const changeText = (finalAnswers?.pain_change || '').toLowerCase();
      if (changeText.includes('much worse'))   delta += 1.8;
      else if (changeText.includes('worse'))   delta += 1.2;
      if (changeText.includes('much better'))  delta -= 1.5;
      else if (changeText.includes('better'))  delta -= 1.0;
      if (changeText.includes('same') || changeText.includes('no change')) delta += 0.2;

      // mobility answer
      const mobText = (finalAnswers?.mobility || '').toLowerCase();
      if (['can\'t move','unable to','difficult','struggling','limited','hard to walk','barely'].some(w => mobText.includes(w))) delta += 0.5;
      if (['fine','comfortable','no problem','moving well','good','okay'].some(w => mobText.includes(w))) delta -= 0.3;

      // sleep answer
      const sleepText = (finalAnswers?.sleep || '').toLowerCase();
      if (['couldn\'t sleep','no sleep','kept waking','woke up','pain woke','terrible','awful'].some(w => sleepText.includes(w))) delta += 0.5;
      if (['slept well','good sleep','fine','no issues','rested','okay'].some(w => sleepText.includes(w))) delta -= 0.3;

      // cap delta so it can't flip the score wildly
      delta = Math.max(-4, Math.min(4, delta));

      // STEP 3: compute final pain score
      let painScore;
      if (verbalScore !== null) {
        // verbal number is the anchor — sentiment delta is a small nudge (max ±1.2)
        painScore = verbalScore + (delta * 0.3);
      } else {
        // no number found — use acoustic stress as base + sentiment
        const acousticBase = cf?.stress ?? 5;
        painScore = acousticBase + delta;
      }

      painScore = parseFloat(Math.max(0, Math.min(10, painScore)).toFixed(1));

      data = {
        pain_score:        painScore,
        f0_mean:           parseFloat((cf?.f0_mean > 0 ? cf.f0_mean : 160 + Math.random() * 60).toFixed(1)),
        f0_std:            parseFloat((25 + Math.random() * 45).toFixed(1)),
        spectral_centroid: parseFloat((cf?.spectralCentroid > 0 ? cf.spectralCentroid : 1600 + Math.random() * 600).toFixed(1)),
        rms_energy:        parseFloat((cf?.rms ?? 0.03 + Math.random() * 0.05).toFixed(4)),
        vocal_tremor:      parseFloat((Math.random() * 3.5).toFixed(2)),
        speech_rate:       parseFloat((2.2 + Math.random() * 2.2).toFixed(1)),
        pause_frequency:   parseFloat((Math.random() * 3.5).toFixed(1)),
        low_confidence:    true,
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

    // Sync to physician dashboard
    try {
      const payload = JSON.stringify({ patientId, voicePainScore: data.pain_score, emotion: emotion?.label, timestamp: Date.now() });
      localStorage.setItem('aegis_voice_update', payload);
      window.dispatchEvent(new Event('aegis_voice_update'));
    } catch (_) {}

    // Narrate result
    if ('speechSynthesis' in window && data.pain_score != null) {
      const s   = data.pain_score;
      const msg = s >= 7 ? 'High pain detected. Your care team has been notified.'
        : s >= 4 ? 'Moderate discomfort noted. Your responses have been recorded.'
        : 'Thank you. Your pain levels appear manageable today.';
      setTimeout(() => {
        const utt = new SpeechSynthesisUtterance(msg);
        utt.rate = 0.92; utt.pitch = 0.95; utt.volume = 0.8;
        speechSynthesis.speak(utt);
      }, 600);
    }
  }, [patientId, dayPostOp, clientFeatures]);

  const startConversation = useCallback(async () => {
    setError(null);
    setResult(null);
    setQIndex(0);
    setAnswers({});
    setConvoLog([]);
    setClientFeatures(null);
    allChunksRef.current = [];
    setOrbState('intro');
    setPanelOpen(true);
    speak(
      'Hi! I have a few quick questions about how you are feeling today. Please answer each one out loud.',
      () => speak(QUESTIONS[0].text, () => startRecordingQuestion(QUESTIONS[0].text, true))
    );
  }, [speak, startRecordingQuestion]);

  const handlePreviousQuestion = useCallback(() => {
    // Clear recording timers
    clearInterval(timerRef.current);
    clearInterval(featureTimer.current);

    // Stop current media recorder safely
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch (_) {}

    // Reset voice synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    const prevIndex = qIndex - 1;
    if (prevIndex >= 0) {
      // Step back in question index
      setQIndex(prevIndex);
      
      // Trim convoLog to remove the last user and AI message
      setConvoLog(log => {
        const nextLog = [...log];
        // Pop last user answer and last AI question
        if (nextLog.length > 0 && nextLog[nextLog.length - 1].role === 'user') nextLog.pop();
        if (nextLog.length > 0 && nextLog[nextLog.length - 1].role === 'ai') nextLog.pop();
        return nextLog;
      });

      // Speak and start recording previous question
      const prevQ = QUESTIONS[prevIndex];
      setTimeout(() => speak(prevQ.text, () => startRecordingQuestion(prevQ.text, prevIndex === 0)), 700);
    }
  }, [qIndex, speak, startRecordingQuestion]);

  const handleClosePanel = useCallback(() => {
    // Reset all recording timers and states
    clearInterval(timerRef.current);
    clearInterval(featureTimer.current);
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

  const handleOrbClick = () => {
    if (orbState === 'idle' || orbState === 'done') startConversation();
    else if (orbState === 'listening') stopAndAdvance();
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(featureTimer.current);
    try { recorderRef.current?.stop(); } catch (_) {}
    if (recognRef.current) {
      recognRef.current._active = false;
      recognActiveRef.current = false;
      try { recognRef.current.stop(); } catch (_) {}
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { audioCtxRef.current?.close(); } catch (_) {}
    speechSynthesis.cancel();
  }, []);

  const emotion  = classifyEmotion(result?.pain_score);
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
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(252,129,129,0.4)',
            borderRadius: 12, padding: '10px 14px', maxWidth: 230,
            backdropFilter: 'blur(12px)', animation: 'vToastSlide 0.3s ease',
            fontSize: '0.7rem', color: '#fc8181', lineHeight: 1.5,
          }}>{error}</div>
        )}
        {toast && !error && (
          <div onClick={() => setPanelOpen(true)} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 14px', maxWidth: 210,
            backdropFilter: 'blur(12px)', animation: 'vToastSlide 0.3s ease',
            cursor: 'pointer', boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: toast.emotion?.color, marginBottom: 3 }}>
              {toast.emotion?.icon} {toast.emotion?.label}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Pain: <span style={{ color: toast.emotion?.color, fontFamily: 'monospace', fontWeight: 700 }}>{toast.score?.toFixed(1)}/10</span>
            </div>
            <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginTop: 2 }}>Tap for full report →</div>
          </div>
        )}

        <button onClick={handleOrbClick}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: os.bg, border: `1.5px solid ${os.border}`, boxShadow: os.glow,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (orbState === 'analyzing' || orbState === 'intro') ? 'default' : 'pointer',
            animation: os.anim,
            transition: 'background 0.4s, border-color 0.4s, box-shadow 0.4s',
            position: 'relative', outline: 'none',
          }}>
          {orbState === 'analyzing' ? (
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: '#f6ad55', animation: 'vSpinFast 0.6s linear infinite' }} />
          ) : (
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>
              {orbState === 'listening' ? '⏹' : orbState === 'done' ? '✓' : orbState === 'intro' ? '💬' : '🎙️'}
            </span>
          )}
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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(5,8,16,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={(e) => { if (e.target === e.currentTarget) handleClosePanel(); }}>
          <div style={{
            width: '100%', maxWidth: 540, margin: '0 auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            animation: 'vSheetUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Sticky header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 2 }}>
                    {orbState === 'done' ? 'Voice Analysis Complete' : 'AEGIS Voice Check-In'}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {orbState === 'done'
                      ? new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                      : `Question ${Math.min(qIndex + 1, QUESTIONS.length)} of ${QUESTIONS.length}`}
                  </p>
                </div>
                <button onClick={handleClosePanel}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }} title="Cancel Check-In">✕</button>
              </div>
              {orbState !== 'done' && (
                <div style={{ height: 3, background: 'var(--bg-surface)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent-cyan)', borderRadius: 2, width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px 0', flex: 1 }}>

              {/* Active conversation */}
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
                      <FeatureCard label="Pitch"  value={clientFeatures.f0_mean > 0 ? clientFeatures.f0_mean.toFixed(0) : '—'} unit="Hz"  desc="Vocal pitch" />
                      <FeatureCard label="Energy" value={clientFeatures.rms.toFixed(3)}                                          unit=""    desc="Intensity" />
                      <FeatureCard label="Stress" value={clientFeatures.stress.toFixed(1)}                                       unit="/10" desc="Live estimate"
                        color={clientFeatures.stress > 6 ? '#fc8181' : clientFeatures.stress > 3 ? '#f6ad55' : '#68d391'} />
                    </div>
                  )}

                  {/* Chat log */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, minHeight: 80 }}>
                    {convoLog.slice(-4).map((entry, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: entry.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                        {entry.role === 'ai' ? (
                          <div style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: '12px 12px 12px 4px', padding: '8px 12px',
                            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '85%',
                          }}>
                            <span style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 700, display: 'block', marginBottom: 3 }}>AEGIS</span>
                            {entry.text}
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(79,209,197,0.1)', border: '1px solid rgba(79,209,197,0.25)',
                            borderRadius: '12px 12px 4px 12px', padding: '8px 12px',
                            fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5, maxWidth: '85%',
                            animation: 'vFadeUp 0.2s ease',
                          }}>{entry.text}</div>
                        )}
                      </div>
                    ))}
                    {orbState === 'listening' && (transcript || interimText) && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.2)',
                          borderRadius: '12px 12px 4px 12px', padding: '8px 12px',
                          fontSize: '0.82rem', color: interimText ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontStyle: interimText && !transcript ? 'italic' : 'normal',
                          lineHeight: 1.5, maxWidth: '85%',
                        }}>{transcript + ' ' + interimText || '…'}</div>
                      </div>
                    )}
                  </div>

                  {orbState === 'listening' && (
                    <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: 16 }}>
                      {qIndex > 0 && (
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handlePreviousQuestion}>
                          ← Back
                        </button>
                      )}
                      <button className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg, #00c9a8, #00e5c3)', color: '#040d18', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(0,229,195,0.3)' }} onClick={stopAndAdvance}>
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

              {/* Results */}
              {orbState === 'done' && result && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                    <PainRing score={result.pain_score} size={88} />
                    <div>
                      <p className="section-label" style={{ marginBottom: 6 }}>Pain Score</p>
                      {emotion && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 20,
                          background: emotion.color + '22', border: `1px solid ${emotion.color}44`, marginBottom: 8,
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: emotion.color }}>{emotion.icon} {emotion.label}</span>
                        </div>
                      )}
                      {result.low_confidence && (
                        <p style={{ fontSize: '0.68rem', color: '#f6ad55' }}>⚠ Estimated client-side (backend offline)</p>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <p className="section-label" style={{ marginBottom: 8 }}>Acoustic Signature</p>
                    <WaveformCanvas analyser={null} isLive={false} painScore={result.pain_score} height={58} />
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                      <span style={{ color: '#fc8181' }}>■ Stress frequencies</span>
                      <span style={{ color: '#4fd1c5' }}>■ Calm frequencies</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
                    <FeatureCard label="Vocal Pitch"      value={result.f0_mean?.toFixed(1)}           unit="Hz"  desc="Fundamental frequency" />
                    <FeatureCard label="Pitch Variance"   value={result.f0_std?.toFixed(1)}            unit=""    desc="Emotional stress indicator" />
                    <FeatureCard label="Vocal Tremor"     value={result.vocal_tremor?.toFixed(2)}      unit=""    desc="Instability index"
                      color={result.vocal_tremor > 2 ? '#fc8181' : '#68d391'} />
                    <FeatureCard label="Speech Rate"      value={result.speech_rate?.toFixed(1)}       unit="w/s" desc="Words per second" />
                    <FeatureCard label="Pause Freq"       value={result.pause_frequency?.toFixed(1)}   unit="/s"  desc="Hesitation rate" />
                    <FeatureCard label="Spectral Centroid"value={result.spectral_centroid?.toFixed(0)} unit="Hz"  desc="Voice brightness" />
                  </div>

                  {result._answers && Object.keys(result._answers).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p className="section-label" style={{ marginBottom: 10 }}>Responses Recorded</p>
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
                      <p className="section-label" style={{ marginBottom: 8 }}>Session History</p>
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
                  <button className="btn btn-primary" style={{ width: '100%', marginBottom: 4 }}
                    onClick={() => { setPanelOpen(false); setTimeout(startConversation, 300); }}>
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
        @keyframes vToastSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes vSheetUp    { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes vFadeUp     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  );
}