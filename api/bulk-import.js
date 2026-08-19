import { getDb, cleanPhone, isYes } from './lib/db.js';

// Bulk import: accept an array of rows and upsert all of them by phone in ONE
// operation. Used by the Apps Script one-time backfill to avoid per-call failures.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const b = req.body || {};
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return res.status(400).json({ success: false, error: 'No rows' });

    const db = await getDb();
    const ops = rows.map((r) => {
      const phone = cleanPhone(r.phone);
      const attending = isYes(r.attending) ? 'yes' : 'no';
      return {
        updateOne: {
          filter: { phone },
          update: {
            $set: {
              name: String(r.name || '').trim(),
              ward: String(r.ward || '').trim(),
              attending,
              reason: String(r.reason || '').trim(),
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
          upsert: true,
        },
      };
    });

    const result = await db.collection('registrations').bulkWrite(ops, { ordered: false });

    res.status(200).json({
      success: true,
      matched: result.matchedCount,
      upserted: result.upsertedCount,
      total: ops.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}