import CONFIG from './config';

const BASE = CONFIG.API_BASE;

async function request(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

export function fetchData() {
  return fetch(BASE + '/api/data?cache=' + Date.now()).then((r) => r.json());
}

export function login(name, password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) });
}

export function volunteers() {
  return fetch(BASE + '/api/volunteers?cache=' + Date.now()).then((r) => r.json());
}

export function addVolunteer(payload) {
  return request('/api/volunteers', { method: 'POST', body: JSON.stringify(payload) });
}

export function checkin(phone, volunteer) {
  return request('/api/checkin', { method: 'POST', body: JSON.stringify({ phone, volunteer }) });
}

export function pay(phone, method, volunteer) {
  return request('/api/pay', { method: 'POST', body: JSON.stringify({ phone, method, volunteer }) });
}

export function walkin(payload) {
  return request('/api/walkin', { method: 'POST', body: JSON.stringify(payload) });
}

export function undoCheckin(payload) {
  return request('/api/undo-checkin', { method: 'POST', body: JSON.stringify(payload) });
}