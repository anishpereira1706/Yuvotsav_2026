import { getDb, cleanPhone, idOrPhone } from './lib/db.js';
import { requireVolunteer } from './lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from './lib/cors.js';

// Admin-only: clear a check-in (e.g. marked the wrong person).
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const session = await requireVolunteer(req, res, { admin: true });
    if (!session) return;
    const b = req.body || {};
    const phone = cleanPhone(b.phone);
    if (!b.id && !phone) return res.status(400).json({ success: false, error: 'Missing id or phone' });
    const filter = idOrPhone(b.id, phone);

    const db = await getDb();
    const result = await db.collection('registrations').updateOne(
      filter,
      {
        $set: {
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: '',
        },
      }
    );

    if (!result.matchedCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}