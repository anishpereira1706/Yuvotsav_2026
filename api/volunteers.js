import { getDb } from './lib/db.js';
import { requireVolunteer } from './lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from './lib/cors.js';

// GET  /api/volunteers  -> list volunteer names (no passwords)
// POST /api/volunteers  -> admin creates a volunteer (default password yuvotsav2026)
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);

  if (req.method === 'GET') {
    try {
      const db = await getDb();
      const volunteers = await db
        .collection('volunteers')
        .find({}, { projection: { name: 1, role: 1, _id: 0 } })
        .sort({ name: 1 })
        .toArray();
      return res.status(200).json({ success: true, volunteers });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const session = await requireVolunteer(req, res, { admin: true });
      if (!session) return;
      const b = req.body || {};
      const name = String(b.name || '').trim();
      const password = String(b.password || '').trim() || 'yuvotsav2026';

      if (!name) return res.status(400).json({ success: false, error: 'Missing volunteer name' });

      const db = await getDb();
      const existing = await db.collection('volunteers').findOne({ name });
      if (existing) return res.status(409).json({ success: false, error: 'Volunteer already exists' });

      await db.collection('volunteers').insertOne({
        name,
        password,
        role: 'volunteer',
        createdAt: new Date(),
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}