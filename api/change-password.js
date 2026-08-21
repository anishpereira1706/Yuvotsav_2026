import { getDb } from '../server/lib/db.js';
import { requireVolunteer, isSuperAdmin } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// POST /api/change-password { oldPassword, newPassword }
// Super admin only — changes own password.
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
    const oldPassword = String(b.oldPassword || '').trim();
    const newPassword = String(b.newPassword || '').trim();

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both old and new password required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
    }

    const db = await getDb();
    const col = db.collection('volunteers');
    const vol = await col.findOne({ name: session.name });

    if (!vol || vol.password !== oldPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    await col.updateOne({ name: session.name }, { $set: { password: newPassword, updatedAt: new Date() } });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
