import { getDb, cleanPhone, isYes } from './lib/db.js';

// Webhook called by Apps Script onFormSubmit when a new form response arrives.
// Each submission becomes its own document (duplicates are kept, like the raw sheet).
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
    const attending = isYes(b.attending) ? 'yes' : 'no';

    await db.collection('registrations').insertOne({
      name: String(b.name || '').trim(),
      phone,
      ward: String(b.ward || '').trim(),
      attending,
      reason: String(b.reason || '').trim(),
      paid: '',
      paidMethod: '',
      paidAt: null,
      paidBy: '',
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: '',
      walkIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
