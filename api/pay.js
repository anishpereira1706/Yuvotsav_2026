import { getDb, cleanPhone, idOrPhone } from '../server/lib/db.js';
import { requireVolunteer } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// Mark a person as paid, recording the method (cash / gpay) and who/when.
// Matches the exact row when an id is provided (handles duplicate phones).
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
    const method = String(b.method || '').toLowerCase();
    if (!b.id && !phone) return res.status(400).json({ success: false, error: 'Missing id or phone' });
    if (method !== 'cash' && method !== 'gpay' && method !== 'pending') {
      return res.status(400).json({ success: false, error: 'Invalid method' });
    }
    const filter = idOrPhone(b.id, phone);

    const db = await getDb();
    const existing = await db.collection('registrations').findOne(filter);
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    const isPending = method === 'pending';
    await db.collection('registrations').updateOne(
      filter,
      isPending
        ? {
            $set: {
              paid: '',
              paidMethod: '',
              paidAt: null,
              paidBy: '',
            },
          }
        : {
            $set: {
              paid: 'yes',
              paidMethod: method,
              paidAt: new Date(),
              paidBy: String(b.volunteer || '').trim(),
            },
          }
    );

    res.status(200).json({ success: true, paid: isPending ? '' : 'yes', paidMethod: isPending ? '' : method });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
