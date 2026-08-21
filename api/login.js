import { getDb } from '../server/lib/db.js';
import { createSession } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// Verify a volunteer's password against the volunteers collection (server-side)
// and issue a session token for desk mutations.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const b = req.body || {};

    // Tracker gate: shared password (TRACKER_PASSWORD env or default), no session.
    if (b.tracker === true) {
      const expected = process.env.TRACKER_PASSWORD || 'yuvotsav2026';
      if (String(b.password || '') !== expected) {
        await new Promise((r) => setTimeout(r, 400));
        return res.status(401).json({ success: false, error: 'Wrong password' });
      }
      return res.status(200).json({ success: true });
    }

    const name = String(b.name || '').trim();
    const password = String(b.password || '');

    const db = await getDb();
    const vol = await db.collection('volunteers').findOne({ name });

    if (!vol || vol.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid name or password' });
    }
    if (vol.active === false) {
      return res.status(403).json({ success: false, error: 'Account deactivated' });
    }

    const token = await createSession(vol.name, vol.role || 'volunteer');

    res.status(200).json({ success: true, name: vol.name, role: vol.role || 'volunteer', token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
