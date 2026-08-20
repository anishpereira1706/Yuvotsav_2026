import { getDb } from '../server/lib/db.js';
import { requireAppKey } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

// GET /api/sync-back — returns every registration shaped for the Desk Data
// sheet (Sheet 2). Consumed by the Apps Script pullAll() to mirror MongoDB
// check-in / payment status back into Google Sheets.
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'GET only' });
  }
  if (!requireAppKey(req, res)) return;
  try {
    const db = await getDb();
    const docs = await db.collection('registrations').find({}).toArray();

    const rows = docs.map((r) => {
      const paid = r.paid === 'yes';
      const attending = r.attending === 'yes';
      const checkedIn = r.checkedIn === true;
      return {
        name: String(r.name || '').trim(),
        phone: String(r.phone || '').trim(),
        ward: String(r.ward || '').trim(),
        attending: attending ? 'yes' : r.attending === 'no' ? 'no' : '',
        reason: String(r.reason || '').trim(),
        checkedIn: checkedIn,
        checkedInAt: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : null,
        paid: paid ? 'yes' : '',
        paidMethod: String(r.paidMethod || '').trim(),
        paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
        walkIn: r.walkIn === true,
      };
    });

    res.status(200).json({ success: true, total: rows.length, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}