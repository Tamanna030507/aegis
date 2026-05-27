// Use relative paths — Vite proxies /api/* to http://localhost:8000
// This avoids CORS issues regardless of which port the frontend runs on.
const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

export const api = {
  // Patients
  getPatient: (id) => request(`/api/patients/${id}`),

  // Check-ins
  submitCheckin: (payload) => request('/api/checkins/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  submitKeystroke: (payload) => request('/api/checkins/keystroke', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  submitWoundImage: async (patientId, dayPostOp, file) => {
    const form = new FormData();
    form.append('patient_id', patientId);
    form.append('day_post_op', dayPostOp);
    form.append('file', file);
    const res = await fetch('/api/checkins/wound', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Wound upload failed: ${res.status}`);
    return res.json();
  },

  submitVoice: async (patientId, dayPostOp, audioBlob) => {
    const form = new FormData();
    form.append('patient_id', patientId);
    form.append('day_post_op', dayPostOp);
    form.append('file', audioBlob, 'voice.webm');
    const res = await fetch('/api/checkins/voice', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Voice upload failed: ${res.status}`);
    return res.json();
  },

  // Risk
  getRisk: (patientId) => request(`/api/risk/${patientId}`),
  getCascade: (patientId) => request(`/api/risk/${patientId}/cascade`),
  getRiskHistory: (patientId) => request(`/api/risk/${patientId}/history`),

  // Passport
  generatePassport: (patientId) => request(`/api/passport/generate/${patientId}`, { method: 'POST' }),
  scanPassport: (hash) => request(`/api/passport/scan/${hash}`),

  // Latest checkin
  getLatestCheckin: (patientId) => request(`/api/checkins/latest/${patientId}`),
};
