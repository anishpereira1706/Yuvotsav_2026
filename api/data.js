import { getDb, buildStats, getWards } from '../server/lib/db.js';
import { requireAppKey } from '../server/lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from '../server/lib/cors.js';

export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (!requireAppKey(req, res)) return;
  try {
    const db = await getDb();
    const regs = await db.collection('registrations').find({}).toArray();

    const rows = regs.map((r) => ({
      _id: String(r._id),
      name: r.name || '',
      phone: r.phone || '',
      ward: r.ward || '',
      attending: r.attending || 'no',
      reason: r.reason || '',
      paid: r.paid || '',
      paidMethod: r.paidMethod || '',
      checkedIn: !!r.checkedIn,
    }));

    const stats = buildStats(rows);
    const wards = await getWards(db);

    res.status(200).json({
      success: true,
      updatedAt: new Date().toISOString(),
      total: rows.length,
      stats,
      wards,
      rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
