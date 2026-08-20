import crypto from 'crypto';
import { getDb } from './db.js';

export function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

export async function createSession(name, role) {
  const db = await getDb();
  const token = makeToken();
  await db.collection('sessions').insertOne({ token, name, role, createdAt: new Date() });
  return token;
}

export async function getSession(req) {
  const headers = req.headers || {};
  let token = '';
  const auth = headers.authorization;
  if (auth && auth.indexOf('Bearer ') === 0) token = auth.slice(7);
  if (!token && req.body && req.body.token) token = String(req.body.token);
  if (!token) return null;
  const db = await getDb();
  return db.collection('sessions').findOne({ token });
}

export async function requireVolunteer(req, res, opts) {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ success: false, error: 'Not authorized' });
    return null;
  }
  if (opts && opts.admin && session.role !== 'admin') {
    res.status(401).json({ success: false, error: 'Admin only' });
    return null;
  }
  return session;
}

export function requireWebhookKey(req, res) {
  const key = req.headers['x-webhook-key'] || req.query.key || '';
  if (!process.env.WEBHOOK_KEY || key !== process.env.WEBHOOK_KEY) {
    res.status(401).json({ success: false, error: 'Invalid webhook key' });
    return false;
  }
  return true;
}

// The app sends this header on every request. Direct URL hits (browser
// navigation, curl) don't have it, so they're rejected.
const APP_KEY = 'yv26-desk-7f3k';

export function requireAppKey(req, res) {
  if ((req.headers['x-app-key'] || '') !== APP_KEY) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return false;
  }
  return true;
}