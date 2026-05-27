const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  getRiskQueue:    ()     => req('/api/risk/queue/all'),
  getPatient:      (id)   => req(`/api/patients/${id}`),
  getRisk:         (id)   => req(`/api/risk/${id}`),
  getCascade:      (id)   => req(`/api/risk/${id}/cascade`),
  getHistory:      (id)   => req(`/api/risk/${id}/history`),
  escalate:        (id)   => req(`/api/alerts/escalate/${id}`, { method: 'POST' }),
  generatePassport:(id)   => req(`/api/passport/generate/${id}`, { method: 'POST' }),
  scanPassport:    (hash) => req(`/api/passport/scan/${hash}`),
  fedStatus:       ()     => req('/api/alerts/federated/status'),
  fedTrigger:      (node) => req(`/api/alerts/federated/trigger?node=${node}`, { method: 'POST' }),
};
