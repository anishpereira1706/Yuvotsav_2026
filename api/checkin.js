import { getDb, cleanPhone } from './lib/db.js';
import { applyCors, isPreflight, sendPreflight } from './lib/cors.js';

// Mark a person as checked in. Guarded against double check-in.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const b = req.body || {};
    const phone = cleanPhone(b.phone);
    if (!phone) return res.status(400).json({ success: false, error: 'Missing phone' });

    const db = await getDb();
    const existing = await db.collection('registrations').findOne({ phone });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
    if (existing.checkedIn) {
      return res.status(200).json({ success: true, already: true, checkedIn: true });
    }

    await db.collection('registrations').updateOne(
      { phone },
      { $set: { checkedIn: true, checkedInAt: new Date(), checkedInBy: String(b.volunteer || '').trim() } }
    );

    res.status(200).json({ success: true, checkedIn: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
