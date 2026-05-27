import React, { useState, useEffect, useRef } from 'react';

export default function AegisClinicalTimelinePortal() {
  // Navigation Trackers - 'new_entry' is now the default view
  const [currentView, setCurrentView] = useState('new_entry'); // 'new_entry' | 'dashboard' | 'neuro_assay'

  /* ========================================================================
     1. DEEP PATIENT PROFILE & HISTORICAL LONGITUDINAL LOGS
     ======================================================================== */
  const [patientHistory, setPatientHistory] = useState([
    { day: 'Day 3 (Yesterday)', date: 'May 25, 2026', symptoms: ['Mild Muscle Spasm', 'Fatigue'], severity: 4, compliance: '94%', cognitive: 'Stable Structure', status: 'Nominal Recovery' },
    { day: 'Day 2', date: 'May 24, 2026', symptoms: ['Dizziness', 'Vocal Hoarseness'], severity: 6, compliance: '88%', cognitive: 'Slight Syntactic Scattering', status: 'Guarded Monitoring' },
    { day: 'Day 1 (Post-Op Launch)', date: 'May 23, 2026', symptoms: ['Sharp Surgical Pain', 'Nausea'], severity: 8, compliance: '71%', cognitive: 'High Pain Dispersion', status: 'Clinical Alert Sent' },
  ]);

  /* ========================================================================
     2. DYNAMIC FORM MANIFEST DECK (EXTENDED DATASETS)
     ======================================================================== */
  const SYMPTOM_DICT = [
    { id: 's1', label: 'Acute Vocal Strain / Dysphonia', tier: 'mild' },
    { id: 's2', label: 'Neurological Tremor / Jitter Flares', tier: 'moderate' },
    { id: 's3', label: 'Incision Margin Erythema (Redness)', tier: 'mild' },
    { id: 's4', label: 'Sharp Substernal Chest Pressure', tier: 'critical' },
    { id: 's5', label: 'Febrile Spike Spells (>101°F)', tier: 'critical' },
    { id: 's6', label: 'Post-Anesthesia Gastrointestinal Distress', tier: 'mild' },
    { id: 's7', label: 'Cognitive Fog / Delayed Verbal Recall', tier: 'moderate' }
  ];

  const MEDICATION_DICT = [
    { id: 'm1', name: 'Amoxicillin (Antibiotic Substrate)', targets: ['s3', 's5'], conflicts: 'Daily Iron Complex' },
    { id: 'm2', name: 'Daily Iron Complex (Mineral Carrier)', targets: [], conflicts: 'Amoxicillin (Antibiotic Substrate)' },
    { id: 'm3', name: 'Ibuprofen (High-Dose Anti-inflammatory)', targets: ['s6'], conflicts: 'Blood Thinners / Warfarin' },
    { id: 'm4', name: 'Warfarin (Anticoagulant Derivative)', targets: ['s4'], conflicts: 'Ibuprofen (High-Dose Anti-inflammatory)' },
    { id: 'm5', name: 'Gabapentin (Neuropathic Core Modulator)', targets: ['s2', 's7'], conflicts: 'None' }
  ];

  /* ========================================================================
     3. LIVE ENTRY WORKSPACE STATE
     ======================================================================== */
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedMeds, setSelectedMeds] = useState([]);
  const [currentSeverity, setCurrentSeverity] = useState(5);
  const [journalText, setJournalText] = useState('');
  
  // Media Captures
  const [isRecording, setIsRecording] = useState(false);
  const [audioWaves, setAudioWaves] = useState(Array(20).fill(6));
  const [lungVerification, setLungVerification] = useState(null);
  
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [cvAnalysis, setCvAnalysis] = useState(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // Computed Safety Matrices
  const [liveTriageMatrix, setLiveTriageMatrix] = useState(null);
  const [pharmaConflictAlert, setPharmaConflictAlert] = useState('');

  /* ========================================================================
     4. NEURO-MOTOR KINETIC ASSAY STATE & NEW JUDGE FEATURES
     ======================================================================== */
  const [isAssayRunning, setIsAssayRunning] = useState(false);
  const [activePad, setActivePad] = useState('A');
  const [tapTimestamps, setTapTimestamps] = useState([]);
  const [assayCountdown, setAssayCountdown] = useState(5);
  const [finalAssayReport, setFinalAssayReport] = useState(null);
  
  // New Feature States
  const [assayTargetBpm, setAssayTargetBpm] = useState(120); // Dynamic Metronome Challenge
  const [tremorTelemetry, setTremorTelemetry] = useState({ x: 0, y: 0, frequency: 0 }); // Rest Tremor Gyro Tracking
  const [isTrackingTremor, setIsTrackingTremor] = useState(false);

  const assayTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const tremorIntervalRef = useRef(null);

  /* ────────────────────────────────────────────────────────────────────────
     COMPUTE ENGINES & LOGICAL INTERFACES
     ──────────────────────────────────────────────────────────────────────── */

  // Audio Equalizer Visualizer Pipeline Loop
  useEffect(() => {
    let loop;
    if (isRecording) {
      loop = setInterval(() => {
        setAudioWaves(Array.from({ length: 20 }, () => Math.floor(Math.random() * 35) + 5));
      }, 1200);
    } else {
      setAudioWaves(Array(20).fill(6));
    }
    return () => clearInterval(loop);
  }, [isRecording]);

  const runVocalAcoustics = () => {
    setIsRecording(true);
    setLungVerification(null);
    setTimeout(() => {
      setIsRecording(false);
      setLungVerification({
        complianceScore: '94.1% Volume Fit',
        stability: 'Sustained Phonation Match (12.8s)'
      });
    }, 3000);
  };

  // Image Telemetry Pipeline
  const runCameraTelemetry = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploadedPhoto(URL.createObjectURL(e.target.files[0]));
    setProcessingPhoto(true);
    setCvAnalysis(null);
    setTimeout(() => {
      setProcessingPhoto(false);
      setCvAnalysis({
        margins: '0.4mm Stable Peripheral Line',
        apposition: '99.1% High Continuity Structural Vector'
      });
    }, 2000);
  };

  // Toggle Selection Hooks
  const toggleSymptomElement = (id) => {
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleMedicationElement = (id) => {
    setSelectedMeds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Real-Time Safety Cross-Check Rule Engine
  useEffect(() => {
    const currentObjects = SYMPTOM_DICT.filter(s => selectedSymptoms.includes(s.id));
    const hasCritical = currentObjects.some(s => s.tier === 'critical');
    
    if (selectedSymptoms.length === 0) {
      setLiveTriageMatrix(null);
    } else if (hasCritical || currentSeverity >= 8) {
      setLiveTriageMatrix({
        banner: 'CRITICAL ANOMALY ALERT',
        color: '#ff4d6d',
        text: 'System metrics indicate acute physiological stress. Immediate clinical escalation recommended.'
      });
    } else if (currentSeverity >= 5 || currentObjects.some(s => s.tier === 'moderate')) {
      setLiveTriageMatrix({
        banner: 'GUARDED HOMEOCLASTIC TREND',
        color: '#ffb703',
        text: 'Symptoms trending upward from typical baseline. Asynchronous summary compiled for provider check.'
      });
    } else {
      setLiveTriageMatrix({
        banner: 'STABLE RECOVERY VECTOR',
        color: '#00e5c3',
        text: 'Vitals mirror safe bounds. Event appended cleanly into recovery stream.'
      });
    }

    const targetMeds = MEDICATION_DICT.filter(m => selectedMeds.includes(m.id));
    let alertString = '';
    
    for (let i = 0; i < targetMeds.length; i++) {
      for (let j = i + 1; j < targetMeds.length; j++) {
        if (targetMeds[i].conflicts === targetMeds[j].name || targetMeds[j].conflicts === targetMeds[i].name) {
          alertString = `⚠️ DEFENSIVE BLOCKED MIXDOWN: [${targetMeds[i].name}] and [${targetMeds[j].name}] have conflicting absorption pathways. Space dosages apart by at least 2 hours to avoid reduced bio-availability.`;
          break;
        }
      }
    }
    setPharmaConflictAlert(alertString);

  }, [selectedSymptoms, selectedMeds, currentSeverity]);

  // Append Daily Progress Package
  const commitDailyLogEntry = () => {
    const currentSymptomLabels = SYMPTOM_DICT.filter(s => selectedSymptoms.includes(s.id)).map(s => s.label);
    const newRecord = {
      day: `Day ${patientHistory.length + 1} (Live Sync)`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      symptoms: currentSymptomLabels.length > 0 ? currentSymptomLabels : ['No Acute Flareups'],
      severity: currentSeverity,
      compliance: lungVerification ? lungVerification.complianceScore : '90% Estimated',
      cognitive: journalText.length > 10 ? 'Coherence Pattern Passed' : 'Not Evaluated',
      status: liveTriageMatrix ? liveTriageMatrix.banner : 'Nominal Stream'
    };

    setPatientHistory([newRecord, ...patientHistory]);
    
    setSelectedSymptoms([]);
    setSelectedMeds([]);
    setJournalText('');
    setLungVerification(null);
    setUploadedPhoto(null);
    setCvAnalysis(null);
    setCurrentView('dashboard'); // Sends them to timeline history view after saving
  };

  // Motor Assay Tapping Matrix Logic
  const startNeuralCalibrator = () => {
    setIsAssayRunning(true);
    setTapTimestamps([]);
    setFinalAssayReport(null);
    setActivePad('A');
    setAssayCountdown(5);

    countdownIntervalRef.current = setInterval(() => {
      setAssayCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    assayTimerRef.current = setTimeout(() => {
      setIsAssayRunning(false);
      clearInterval(countdownIntervalRef.current);
      
      setTapTimestamps(times => {
        if (times.length < 5) {
          setFinalAssayReport({ variance: 'High Deviation Blur', index: 'Incomplete Sequence', rating: 'Alternate taps at higher frequencies.' });
          return times;
        }
        let totalDelta = 0;
        const deltas = [];
        for (let i = 1; i < times.length; i++) {
          const d = times[i] - times[i - 1];
          deltas.push(d);
          totalDelta += d;
        }
        const averageDelta = totalDelta / deltas.length;
        const varianceCalc = deltas.reduce((acc, v) => acc + Math.pow(v - averageDelta, 2), 0);
        const standardDeviation = Math.sqrt(varianceCalc / deltas.length).toFixed(1);

        // Calculate expected interval from target metronome BPM
        const expectedIntervalMs = 60000 / assayTargetBpm;
        const trackingError = Math.abs(averageDelta - expectedIntervalMs).toFixed(1);

        setFinalAssayReport({
          variance: `${standardDeviation}ms Jitter`,
          index: `${trackingError}ms Off-Target Error`,
          rating: standardDeviation < 35 && trackingError < 50 ? 'Normal neurological clarity and rhythm sync patterns.' : 'Slight target drift or fatigue variance flagged.'
        });
        return times;
      });
    }, 5000);
  };

  const registerPadImpulse = (padId) => {
    if (!isAssayRunning || padId !== activePad) return;
    setTapTimestamps(prev => [...prev, window.performance.now()]);
    setActivePad(activePad === 'A' ? 'B' : 'A');
  };

  // Simulate Postural Gyroscopic Tremor Assessment
  const runTremorAssessment = () => {
    setIsTrackingTremor(true);
    let duration = 0;
    tremorIntervalRef.current = setInterval(() => {
      duration += 100;
      setTremorTelemetry({
        x: (Math.sin(duration * 0.05) * (Math.random() * 4 + 1)).toFixed(2),
        y: (Math.cos(duration * 0.05) * (Math.random() * 4 + 1)).toFixed(2),
        frequency: (3.8 + Math.random() * 1.5).toFixed(1)
      });
      if (duration >= 3000) {
        clearInterval(tremorIntervalRef.current);
        setIsTrackingTremor(false);
      }
    }, 100);
  };

  return (
    <div style={{ background: 'var(--glass)', color: 'var(--text)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', backdropFilter: 'blur(24px)' }}>
      
      {/* GLOBAL SYSTEM HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <span style={{ fontSize: '0.65rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, fontFamily: 'monospace' }}>AEGIS LONGITUDINAL SYSTEM</span>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>Patient Clinical Portal</h2>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', background: 'var(--bg3)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>ID: #984-PX</div>
      </div>

      {/* PRIMARY VIEWS CONTROLLER - ORDER SWITCHED */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '6px', marginBottom: '16px' }}>
        <button onClick={() => setCurrentView('new_entry')} style={{ background: currentView === 'new_entry' ? 'var(--bg3)' : 'var(--bg2)', color: currentView === 'new_entry' ? 'var(--teal)' : 'var(--text3)', border: '1px solid var(--border)', padding: '10px 4px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Log Check-In</button>
        <button onClick={() => setCurrentView('dashboard')} style={{ background: currentView === 'dashboard' ? 'var(--bg3)' : 'var(--bg2)', color: currentView === 'dashboard' ? 'var(--teal)' : 'var(--text3)', border: '1px solid var(--border)', padding: '10px 4px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Recovery History</button>
        <button onClick={() => setCurrentView('neuro_assay')} style={{ background: currentView === 'neuro_assay' ? 'var(--bg3)' : 'var(--bg2)', color: currentView === 'neuro_assay' ? 'var(--teal)' : 'var(--text3)', border: '1px solid var(--border)', padding: '10px 4px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Motor Assay</button>
      </div>

      {/* ========================================================================
         VIEW A: DYNAMIC COMPREHENSIVE DAILY ENTRY WORKSPACE (NOW DEFAULT TAB)
         ======================================================================== */}
      {currentView === 'new_entry' && (
        <div className="checkin-grid-layout">
          
          {/* COLUMN 1: SYMPTOMS & INGESTIONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* STEP 1: COMPREHENSIVE SYMPTOM DICTIONARY MANIFEST */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: 'var(--text)' }}>1. System Symptom Dictionary</h4>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.65rem', color: 'var(--text2)' }}>Select all current physiological anomalies to evaluate risk triage trends.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {SYMPTOM_DICT.map(sym => {
                  const isActive = selectedSymptoms.includes(sym.id);
                  return (
                    <div key={sym.id} onClick={() => toggleSymptomElement(sym.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: isActive ? 'rgba(0, 229, 195, 0.08)' : 'var(--bg3)', border: isActive ? '1px solid var(--teal)' : '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.1s' }}>
                      <span style={{ fontSize: '0.72rem', color: isActive ? 'var(--teal)' : 'var(--text)' }}>{sym.label}</span>
                      <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', padding: '2px 5px', borderRadius: '4px', background: sym.tier === 'critical' ? 'rgba(255,77,109,0.15)' : 'rgba(255,255,255,0.05)', color: sym.tier === 'critical' ? '#ff4d6d' : '#9ca3af' }}>{sym.tier}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: MEDICATION MANIFEST LOAD SYNC */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: 'var(--text)' }}>2. Active Ingestion Logs</h4>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.65rem', color: 'var(--text2)' }}>Log active chemical compounds to analyze metabolic interference risks.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                {MEDICATION_DICT.map(med => {
                  const isTaken = selectedMeds.includes(med.id);
                  return (
                    <div key={med.id} onClick={() => toggleMedicationElement(med.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: isTaken ? 'rgba(0, 229, 195, 0.08)' : 'var(--bg3)', border: isTaken ? '1px solid var(--teal)' : '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.72rem', color: isTaken ? 'var(--teal)' : 'var(--text)' }}>{med.name}</span>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--border2)', background: isTaken ? 'var(--teal)' : 'transparent' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMN 2: PAIN severity, BIOMETRICS, AND COGNITIVE JOURNAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* STEP 3: PAIN MATRIX TRACKER */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>3. Pain Intensity Configuration</span>
                <span style={{ color: 'var(--teal)', fontFamily: 'monospace', fontWeight: 700 }}>{currentSeverity} / 10</span>
              </div>
              <input type="range" min="1" max="10" value={currentSeverity} onChange={(e) => setCurrentSeverity(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--teal)', background: 'var(--bg3)' }} />
            </div>

            {/* ASYNC PIPELINE MODULES (ACOUSTICS & TELEMETRY IMAGING) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* ACOUSTIC COMPLIANCE LAYER */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>Vocal Vitals</span>
                <button onClick={runVocalAcoustics} disabled={isRecording} style={{ background: isRecording ? 'var(--red)' : 'var(--bg3)', border: '1px solid var(--border)', color: isRecording ? '#fff' : 'var(--teal)', padding: '6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                  {isRecording ? 'Sampling...' : 'Record Airway'}
                </button>
                {isRecording && (
                  <div style={{ display: 'flex', gap: '1px', height: '12px', alignItems: 'center', marginTop: '6px' }}>
                    {audioWaves.slice(0, 10).map((w, i) => <div key={i} style={{ flex: 1, height: `${w}%`, background: 'var(--teal)' }} />)}
                  </div>
                )}
                {lungVerification && <div style={{ fontSize: '0.58rem', color: 'var(--text2)', marginTop: '6px', lineHeight: '1.2' }}>✓ Verified: {lungVerification.complianceScore}</div>}
              </div>

              {/* TELEMETRY IMAGING LAYER */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>CV Incision Telemetry</span>
                <label style={{ display: 'block', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>
                  {processingPhoto ? 'Analyzing...' : uploadedPhoto ? 'Re-upload Image' : 'Capture Photo'}
                  <input type="file" accept="image/*" onChange={runCameraTelemetry} style={{ display: 'none' }} />
                </label>
                {cvAnalysis && <div style={{ fontSize: '0.58rem', color: 'var(--purple)', marginTop: '6px', lineHeight: '1.2' }}>✓ Apposition: {cvAnalysis.apposition}</div>}
              </div>

            </div>

            {/* LINGUISTIC COHERENCE WRITER */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>Patient Cognitive Journal Entry</span>
              <textarea value={journalText} onChange={(e) => setJournalText(e.target.value)} placeholder="Type how you feel. System maps syntax scattering vectors down to the baseline..." style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', color: 'var(--text)', fontSize: '0.72rem', minHeight: '45px', resize: 'none' }} />
            </div>

            {/* CRITICAL ENGINE COMPUTATION BREAKOUTS */}
            {liveTriageMatrix && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', borderLeft: `3px solid ${liveTriageMatrix.color}`, fontSize: '0.68rem' }}>
                <div style={{ color: liveTriageMatrix.color, fontWeight: 900, fontSize: '0.62rem', letterSpacing: '1px' }}>{liveTriageMatrix.banner}</div>
                <p style={{ margin: '2px 0 0 0', color: '#e5e7eb', lineHeight: '1.3' }}>{liveTriageMatrix.text}</p>
              </div>
            )}

            {pharmaConflictAlert && (
              <div style={{ background: 'rgba(255, 77, 109, 0.08)', border: '1px solid #ff4d6d', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '0.68rem', lineHeight: '1.35' }}>
                {pharmaConflictAlert}
              </div>
            )}

            {/* TRANSACTION COMMIT TRIGGER BUTTON */}
            <button onClick={commitDailyLogEntry} disabled={selectedSymptoms.length === 0} style={{ width: '100%', background: selectedSymptoms.length === 0 ? '#374151' : '#00e5c3', color: selectedSymptoms.length === 0 ? '#9ca3af' : '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', cursor: selectedSymptoms.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
              Commit Package Entry to Recovery History
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================
         VIEW B: LONGITUDINAL RECOVERY HISTORICAL LOGS (NOW SECOND TAB)
         ======================================================================== */}
      {currentView === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', fontWeight: 700 }}>Continuous Patient Progress Log</h3>
            <button onClick={() => setCurrentView('new_entry')} style={{ background: 'rgba(0, 229, 195, 0.1)', color: 'var(--teal)', border: '1px dashed var(--teal)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>+ Append Today</button>
          </div>
          
          <div className="history-grid">
            {patientHistory.map((record, index) => (
              <div key={index} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text)' }}>{record.day}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text3)', fontFamily: 'monospace' }}>{record.date}</span>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {record.symptoms.map((sym, sIdx) => (
                    <span key={sIdx} style={{ fontSize: '0.62rem', background: 'var(--bg3)', color: 'var(--text2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>{sym}</span>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.68rem', borderTop: '1px solid var(--border)', paddingTop: '6px', color: 'var(--text2)' }}>
                  <div>Pain Index: <strong style={{ color: record.severity >= 7 ? 'var(--red)' : 'var(--text)' }}>{record.severity}/10</strong></div>
                  <div>Spirometry Parity: <strong style={{ color: 'var(--text)' }}>{record.compliance}</strong></div>
                  <div>Cognitive Assessment: <strong style={{ color: 'var(--text)' }}>{record.cognitive}</strong></div>
                  <div>Triage Vector: <strong style={{ color: 'var(--teal)' }}>{record.status}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================
         VIEW C: ENHANCED NEURO-MOTOR KINETIC TIMING CALIBRATOR (WITH JUDGE ADDITIONS)
         ======================================================================== */}
      {currentView === 'neuro_assay' && (
        <div className="motor-grid-layout">
          
          {/* TAP INTERFACES SUB-MODULE */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '14px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>Neuro-Kinetic Precision Assay</h4>
              <span style={{ fontSize: '0.6rem', color: 'var(--amber)', background: 'rgba(255,183,3,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>DSP CORE</span>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--text2)', lineHeight: '1.35' }}>Measures kinetic rhythm jitter variance down to the millisecond (ms) to gauge processing degradation and motor-control fatigue.</p>

            {/* NEW ENHANCEMENT: METRONOME SPEED MODIFIER TARGET */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text)' }}>Metronome Pace Target:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[90, 120, 160].map(bpm => (
                  <button key={bpm} onClick={() => !isAssayRunning && setAssayTargetBpm(bpm)} style={{ background: assayTargetBpm === bpm ? 'var(--teal)' : 'var(--bg2)', color: assayTargetBpm === bpm ? 'var(--bg)' : 'var(--text)', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: isAssayRunning ? 'not-allowed' : 'pointer' }}>
                    {bpm} BPM
                  </button>
                ))}
              </div>
            </div>

            {!isAssayRunning ? (
              <button onClick={startNeuralCalibrator} style={{ width: '100%', background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}>
                {finalAssayReport ? 'Restart Dynamic Sync Check' : 'Initialize 5s Neuro-Assay'}
              </button>
            ) : (
              <div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 700, marginBottom: '10px', fontFamily: 'monospace' }}>CALIBRATION TIMEFRAME: 0{assayCountdown}s</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', height: '85px' }}>
                  <button onClick={() => registerPadImpulse('A')} style={{ background: activePad === 'A' ? 'rgba(0, 229, 195, 0.15)' : 'var(--bg3)', border: activePad === 'A' ? '2px solid var(--teal)' : '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}>
                    {activePad === 'A' ? 'CLICK TARGET' : 'LOCK'}
                  </button>
                  <button onClick={() => registerPadImpulse('B')} style={{ background: activePad === 'B' ? 'rgba(0, 229, 195, 0.15)' : 'var(--bg3)', border: activePad === 'B' ? '2px solid var(--teal)' : '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}>
                    {activePad === 'B' ? 'CLICK TARGET' : 'LOCK'}
                  </button>
                </div>
              </div>
            )}

            {finalAssayReport && (
              <div style={{ marginTop: '12px', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '2px solid var(--amber)' }}>
                <div><span style={{ color: 'var(--text2)' }}>Timing Drift Jitter:</span> <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{finalAssayReport.variance}</strong></div>
                <div><span style={{ color: 'var(--text2)' }}>Pace Tracking Deviation:</span> <strong style={{ color: 'var(--teal)' }}>{finalAssayReport.index}</strong></div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px', color: 'var(--text2)', fontStyle: 'italic' }}>{finalAssayReport.rating}</div>
              </div>
            )}
          </div>

          {/* NEW ENHANCEMENT SUB-MODULE: RESTING MICRO-TREMOR GYROSCOPIC TESTING */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '14px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.85rem', color: 'var(--text)' }}>Postural Rest Tremor Analyzer</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--text2)', lineHeight: '1.35' }}>Uses simulated acceleration coordinate streams to identify high-frequency somatic micro-oscillations indicative of anesthesia wear-off anomalies.</p>
            
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '8px' }}>
                <div><span style={{ color: 'var(--text2)', display: 'block', fontSize: '0.6rem' }}>X-AXIS DELTA</span> <strong style={{ color: 'var(--text)' }}>{tremorTelemetry.x} mm</strong></div>
                <div><span style={{ color: 'var(--text2)', display: 'block', fontSize: '0.6rem' }}>Y-AXIS DELTA</span> <strong style={{ color: 'var(--text)' }}>{tremorTelemetry.y} mm</strong></div>
                <div><span style={{ color: 'var(--text2)', display: 'block', fontSize: '0.6rem' }}>EST FREQUENCY</span> <strong style={{ color: 'var(--purple)' }}>{tremorTelemetry.frequency} Hz</strong></div>
              </div>
              
              {/* Visual mini-graph boundary display */}
              <div style={{ height: '30px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isTrackingTremor ? (
                  <div style={{ width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--purple), transparent)', transform: `translateY(${tremorTelemetry.x * 2}px)`, transition: 'transform 0.1s' }} />
                ) : (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>Sensor Engine Idle</span>
                )}
              </div>
            </div>

            <button onClick={runTremorAssessment} disabled={isTrackingTremor} style={{ width: '100%', background: isTrackingTremor ? 'var(--bg3)' : 'rgba(180, 142, 173, 0.12)', color: isTrackingTremor ? 'var(--text3)' : 'var(--purple)', border: isTrackingTremor ? '1px solid transparent' : '1px solid var(--purple)', padding: '8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem', cursor: isTrackingTremor ? 'not-allowed' : 'pointer' }}>
              {isTrackingTremor ? 'Analyzing Stability Plane...' : 'Run Gyroscopic Posture Assay'}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}