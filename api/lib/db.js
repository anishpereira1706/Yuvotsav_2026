import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'yuvotsav2026';

let cached = null;

export async function getDb() {
  if (!cached) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    cached = await client.connect();
  }
  return cached.db(dbName);
}

export function cleanPhone(v) {
  return String(v == null ? '' : v).replace(/[^\d+]/g, '');
}

export function isYes(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === 'attending' ||
         s === 'will attend' || s.indexOf('yes') === 0;
}

export function buildStats(rows) {
  const stats = { total: rows.length, attending: 0, notAttending: 0, unknown: 0, wards: {} };
  rows.forEach((r) => {
    const a = r.attending;
    if (a === 'yes') stats.attending++;
    else if (a === 'no') stats.notAttending++;
    else stats.unknown++;

    if (r.ward) {
      if (!stats.wards[r.ward]) stats.wards[r.ward] = { total: 0, attending: 0 };
      stats.wards[r.ward].total++;
      if (a === 'yes') stats.wards[r.ward].attending++;
    }
  });
  return stats;
}

export async function getWards(db) {
  try {
    const cfg = await db.collection('config').findOne({ key: 'wards' });
    if (cfg && Array.isArray(cfg.value) && cfg.value.length) return cfg.value;
  } catch (e) {}
  return [];
}
