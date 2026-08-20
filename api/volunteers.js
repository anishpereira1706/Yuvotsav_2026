import { getDb } from '../server/lib/db.js';
import { requireVolunteer, isSuperAdmin, SUPER_ADMIN } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// GET  /api/volunteers  -> list volunteers (name, role, active)
// POST /api/volunteers  -> admin creates a volunteer (role: volunteer | admin)
// POST /api/volunteers  -> { action: 'update', name, role?, active? } (admin)
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);

  if (req.method === 'GET') {
    try {
      const db = await getDb();
      const volunteers = await db
        .collection('volunteers')
        .find({}, { projection: { name: 1, role: 1, active: 1, _id: 0 } })
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
      const db = await getDb();
      const col = db.collection('volunteers');

      if (b.action === 'update') {
        const target = String(b.name || '').trim();
        if (!target) return res.status(400).json({ success: false, error: 'Missing name' });
        const vol = await col.findOne({ name: target });
        if (!vol) return res.status(404).json({ success: false, error: 'Volunteer not found' });

        const set = {};
        if (b.role !== undefined) {
          if (!isSuperAdmin(session.name)) {
            return res.status(403).json({ success: false, error: 'Only the super admin can change roles' });
          }
          if (target === SUPER_ADMIN) {
            return res.status(403).json({ success: false, error: 'Cannot change the super admin role' });
          }
          set.role = b.role === 'admin' ? 'admin' : 'volunteer';
        }
        if (b.active !== undefined) {
          if (target === SUPER_ADMIN) {
            return res.status(403).json({ success: false, error: 'Cannot deactivate the super admin' });
          }
          set.active = !!b.active;
        }
        if (!Object.keys(set).length) {
          return res.status(400).json({ success: false, error: 'Nothing to update' });
        }
        await col.updateOne({ name: target }, { $set: { ...set, updatedAt: new Date() } });
        return res.status(200).json({ success: true });
      }

      const name = String(b.name || '').trim();
      const password = String(b.password || '').trim() || 'yuvotsav2026';
      const role = b.role === 'admin' ? 'admin' : 'volunteer';

      if (!name) return res.status(400).json({ success: false, error: 'Missing volunteer name' });

      const existing = await col.findOne({ name });
      if (existing) return res.status(409).json({ success: false, error: 'Volunteer already exists' });

      await col.insertOne({
        name,
        password,
        role,
        active: true,
        createdAt: new Date(),
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}