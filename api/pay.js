import { getDb, cleanPhone } from './lib/db.js';

// Mark a person as paid, recording the method (cash / gpay) and who/when.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const b = req.body || {};
    const phone = cleanPhone(b.phone);
    const method = String(b.method || '').toLowerCase();
    if (!phone) return res.status(400).json({ success: false, error: 'Missing phone' });
    if (method !== 'cash' && method !== 'gpay') {
      return res.status(400).json({ success: false, error: 'Invalid method' });
    }

    const db = await getDb();
    const existing = await db.collection('registrations').findOne({ phone });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    await db.collection('registrations').updateOne(
      { phone },
      {
        $set: {
          paid: 'yes',
          paidMethod: method,
          paidAt: new Date(),
          paidBy: String(b.volunteer || '').trim(),
        },
      }
    );

    res.status(200).json({ success: true, paid: 'yes', paidMethod: method });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
