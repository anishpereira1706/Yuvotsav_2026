import CONFIG from './config';

const BASE = CONFIG.API_BASE;

export const APP_KEY = 'yv26-desk-7f3k';

function authHeaders() {
  const h = { 'x-app-key': APP_KEY };
  try {
    const u = JSON.parse(sessionStorage.getItem('yuvotsav_user'));
    if (u && u.token) h.authorization = 'Bearer ' + u.token;
  } catch (e) {}
  return h;
}

async function request(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json', ...authHeaders() },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

export function fetchData() {
  return fetch(BASE + '/api/data?cache=' + Date.now(), {
    headers: { 'x-app-key': APP_KEY },
  }).then((r) => r.json());
}

export function login(name, password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) });
}

export function trackLogin(password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ tracker: true, password }) });
}

export function volunteers() {
  return fetch(BASE + '/api/volunteers?cache=' + Date.now(), {
    headers: { 'x-app-key': APP_KEY },
  }).then((r) => r.json());
}

export function addVolunteer(payload) {
  return request('/api/volunteers', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateVolunteer(payload) {
  return request('/api/volunteers', { method: 'POST', body: JSON.stringify({ action: 'update', ...payload }) });
}

export function checkin(id, phone, volunteer) {
  return request('/api/checkin', { method: 'POST', body: JSON.stringify({ id, phone, volunteer }) });
}

export function pay(id, phone, method, volunteer) {
  return request('/api/pay', { method: 'POST', body: JSON.stringify({ id, phone, method, volunteer }) });
}

export function walkin(payload) {
  return request('/api/walkin', { method: 'POST', body: JSON.stringify(payload) });
}

export function undoCheckin(payload) {
  return request('/api/undo-checkin', { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteDuplicate(id) {
  return request('/api/duplicates', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
}

export function mergeDuplicates(keeperId, removeIds) {
  return request('/api/duplicates', { method: 'POST', body: JSON.stringify({ action: 'merge', keeperId, removeIds }) });
}

export function changePassword(name, newPassword) {
  return request('/api/change-password', { method: 'POST', body: JSON.stringify({ name, newPassword }) });
}