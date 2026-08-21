import { getDb } from '../server/lib/db.js';
import { requireVolunteer, isSuperAdmin } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// POST /api/change-password { name, newPassword }
// Super admin only — resets any volunteer's password.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const session = await requireVolunteer(req, res);
    if (!session) return;
    if (!isSuperAdmin(session.name)) {
      return res.status(403).json({ success: false, error: 'Super admin only' });
    }

    const b = req.body || {};
    const target = String(b.name || '').trim();
    const newPassword = String(b.newPassword || '').trim();

    if (!target || !newPassword) {
      return res.status(400).json({ success: false, error: 'Name and new password required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
    }

    const db = await getDb();
    const col = db.collection('volunteers');
    const vol = await col.findOne({ name: target });
    if (!vol) {
      return res.status(404).json({ success: false, error: 'Volunteer not found' });
    }

    await col.updateOne({ name: target }, { $set: { password: newPassword, updatedAt: new Date() } });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
