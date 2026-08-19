import { getDb, cleanPhone, isYes } from './lib/db.js';

// Webhook called by Apps Script onFormSubmit when a new form response arrives.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const b = req.body || {};
    const phone = cleanPhone(b.phone);
    if (!phone && !b.name) {
      return res.status(400).json({ success: false, error: 'Missing phone/name' });
    }

    const db = await getDb();
    const attending = isYes(b.attending) ? 'yes' : (String(b.attending || '').trim() ? 'no' : 'no');

    await db.collection('registrations').updateOne(
      { phone },
      {
        $set: {
          name: String(b.name || '').trim(),
          ward: String(b.ward || '').trim(),
          attending,
          reason: String(b.reason || '').trim(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          phone,
          paid: '',
          paidMethod: '',
          paidAt: null,
          paidBy: '',
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: '',
          walkIn: false,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
