import { getDb, cleanPhone, isYes } from '../server/lib/db.js';
import { requireWebhookKey } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// Webhook called by Apps Script onFormSubmit when a new form response arrives.
// Each submission becomes its own document (duplicates are kept, like the raw sheet).
// Requires the WEBHOOK_KEY shared secret.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    if (!requireWebhookKey(req, res)) return;
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
