import { getDb, cleanPhone, isYes } from './lib/db.js';
import { requireWebhookKey } from './lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from './lib/cors.js';

// Bulk import: insert every row as its own document (duplicates are kept).
// Used by the Apps Script one-time backfill so all responses appear in the tracker.
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
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return res.status(400).json({ success: false, error: 'No rows' });

    const db = await getDb();
    const docs = rows.map((r) => ({
      name: String(r.name || '').trim(),
      phone: cleanPhone(r.phone),
      ward: String(r.ward || '').trim(),
      attending: isYes(r.attending) ? 'yes' : 'no',
      reason: String(r.reason || '').trim(),
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
    }));

    const result = await db.collection('registrations').insertMany(docs, { ordered: false });

    res.status(200).json({
      success: true,
      inserted: result.insertedCount,
      total: docs.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}