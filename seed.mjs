// One-time seed script: loads .env, seeds the wards + default volunteers.
// Usage: node seed.mjs
import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';

const env = readFileSync('.env', 'utf8');
const get = (k) => {
  const m = env.split('\n').find((l) => l.startsWith(k + '='));
  return m ? m.split('=').slice(1).join('=').trim() : null;
};
const uri = get('MONGODB_URI');
const dbName = get('MONGODB_DB') || 'yuvotsav2026';

const WARDS = [
  'Carmel', 'Christ King', 'Holy Cross', 'Immaculate Conception',
  'Infant Jesus', 'Infant Mary', 'MRPL', 'Nithyadar', 'Sacred Heart',
  'St Anthony', 'St Francis Xavier', 'St Joseph', 'St Jude',
  'St Lawrence', 'St Sebastian', 'Holy Family',
];

const VOLUNTEERS = [
  { name: 'Anish Pereira', password: 'yuvotsav2026', role: 'admin' },
];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const db = client.db(dbName);

  const wRes = await db.collection('config').updateOne(
    { key: 'wards' },
    { $set: { value: WARDS } },
    { upsert: true }
  );

  const vRes = await db.collection('volunteers').bulkWrite(
    VOLUNTEERS.map((v) => ({
      updateOne: { filter: { name: v.name }, update: { $set: v }, upsert: true },
    }))
  );

  console.log('Seeded db:', dbName);
  console.log('  wards config:', wRes.upsertedCount ? 'inserted' : 'updated');
  console.log('  volunteers upserted:', vRes.upsertedCount);
} catch (e) {
  console.error('Seed error:', e.message);
} finally {
  await client.close();
}
