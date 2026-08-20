import { getDb, cleanPhone } from '../server/lib/db.js';
import { requireVolunteer } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// Add a walk-in registration (not from the form). Optionally auto-check-in.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const session = await requireVolunteer(req, res);
    if (!session) return;
    const b = req.body || {};
    const phone = cleanPhone(b.phone);
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Missing name' });

    const db = await getDb();
    const method = String(b.method || '').toLowerCase();
    const paid = method === 'cash' || method === 'gpay' ? 'yes' : '';
    const autoCheckin = b.autoCheckin === true;

    const doc = {
      name,
      phone,
      ward: String(b.ward || '').trim(),
      attending: 'yes',
      reason: '',
      paid,
      paidMethod: paid ? method : '',
      paidAt: paid ? new Date() : null,
      paidBy: paid ? String(b.volunteer || '').trim() : '',
      checkedIn: autoCheckin,
      checkedInAt: autoCheckin ? new Date() : null,
      checkedInBy: autoCheckin ? String(b.volunteer || '').trim() : '',
      walkIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('registrations').insertOne(doc);

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
