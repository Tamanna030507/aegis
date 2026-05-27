/**
 * useKeystroke — passive typing biomarker monitor.
 * Captures ONLY timing metadata (inter-key intervals, dwell times).
 * NO key content is ever stored or transmitted.
 * Flushes to API every 30 minutes.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { api } from '../services/api';

const FLUSH_INTERVAL_MS = 30 * 60 * 1000;
const MIN_EVENTS = 10;

export function useKeystroke(patientId, enabled = true) {
  const buffer     = useRef([]);
  const flushTimer = useRef(null);
  const [bufferSize, setBufferSize] = useState(0);  // useState so it triggers re-renders

  const flush = useCallback(async () => {
    if (!patientId || buffer.current.length < MIN_EVENTS) return;
    const events = [...buffer.current];
    buffer.current = [];
    setBufferSize(0);

    try {
      await api.submitKeystroke({
        patient_id:      patientId,
        window_start_ms: events[0]?.t || Date.now(),
        events,
        total_keystrokes: events.filter(e => e.type === 'down').length,
      });
    } catch (err) {
      console.error('[useKeystroke] Flush failed:', err);
    }
  }, [patientId]);

  const handleKeyDown = useCallback(() => {
    if (!enabled) return;
    buffer.current.push({ t: Date.now(), type: 'down' }); // NO e.key stored
    setBufferSize(s => s + 1);
  }, [enabled]);

  const handleKeyUp = useCallback(() => {
    if (!enabled) return;
    buffer.current.push({ t: Date.now(), type: 'up' }); // NO e.key stored
    // don't increment count — only count meaningful keydown strokes
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    flushTimer.current = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
      clearInterval(flushTimer.current);
      flush(); // flush remaining on unmount
    };
  }, [enabled, handleKeyDown, handleKeyUp, flush]);

  /**
   * Compute live pain index from current buffer (for real-time demo display).
   * Returns 0–10 or null if insufficient data.
   */
  const getLivePainIndex = useCallback(() => {
    const downs = buffer.current.filter(e => e.type === 'down').map(e => e.t).sort((a, b) => a - b);
    if (downs.length < 5) return null;

    const ikis = [];
    for (let i = 1; i < downs.length; i++) {
      const iki = downs[i] - downs[i - 1];
      if (iki > 0 && iki < 2000) ikis.push(iki);
    }
    if (ikis.length < 3) return null;

    const mean = ikis.reduce((a, b) => a + b, 0) / ikis.length;
    const painIki = Math.min(10, (mean - 200) / 60);
    return Math.max(0, Math.min(10, painIki)).toFixed(1);
  }, []);

  return { getLivePainIndex, flush, bufferSize };
}
