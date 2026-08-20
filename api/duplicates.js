import { ObjectId } from 'mongodb';
import { getDb } from './lib/db.js';
import { requireVolunteer } from './lib/auth.js';
import { applyCors, isPreflight, sendPreflight } from './lib/cors.js';

// Admin-only duplicate management.
//  POST { action: 'delete', id }
//  POST { action: 'merge', keeperId, removeIds }
export default async function handler(req, res) {
  if (isPreflight(req)) return sendPreflight(res);
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }
  try {
    const session = await requireVolunteer(req, res, { admin: true });
    if (!session) return;
    const b = req.body || {};
    const db = await getDb();
    const col = db.collection('registrations');

    if (b.action === 'delete') {
      const id = b.id;
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
      const result = await col.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true, deleted: result.deletedCount });
    }

    if (b.action === 'merge') {
      const keeperId = String(b.keeperId || '');
      const removeIds = Array.isArray(b.removeIds) ? b.removeIds.map(String).filter(Boolean) : [];
      if (!keeperId) return res.status(400).json({ success: false, error: 'Missing keeperId' });

      const allIds = [keeperId, ...removeIds].map((id) => new ObjectId(id));
      const docs = await col.find({ _id: { $in: allIds } }).toArray();
      const keeper = docs.find((d) => String(d._id) === keeperId);
      if (!keeper) return res.status(404).json({ success: false, error: 'Keeper not found' });

      await col.updateOne({ _id: keeper._id }, { $set: mergeStatuses(keeper, docs) });
      if (removeIds.length) {
        await col.deleteMany({ _id: { $in: removeIds.map((id) => new ObjectId(id)) } });
      }
      return res.status(200).json({ success: true, removed: removeIds.length });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Keep the keeper's identity but inherit check-in / payment state from all rows.
function mergeStatuses(keeper, docs) {
  const set = { updatedAt: new Date() };
  const anyChecked = docs.some((d) => d.checkedIn === true);
  const anyPaid = docs.some((d) => d.paid === 'yes');
  const first = (key) => {
    const hit = docs.find((d) => d[key]);
    return hit ? hit[key] : null;
  };
  set.checkedIn = anyChecked;
  set.checkedInAt = anyChecked ? first('checkedInAt') : null;
  set.checkedInBy = anyChecked ? first('checkedInBy') || '' : '';
  set.paid = anyPaid ? 'yes' : '';
  set.paidMethod = anyPaid ? first('paidMethod') || '' : '';
  set.paidAt = anyPaid ? first('paidAt') : null;
  set.paidBy = anyPaid ? first('paidBy') || '' : '';
  return set;
}