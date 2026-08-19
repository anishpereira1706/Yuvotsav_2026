export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// True if this is a CORS preflight request that should be short-circuited.
export function isPreflight(req) {
  return req.method === 'OPTIONS';
}

export function sendPreflight(res) {
  applyCors(res);
  res.status(204).end();
}
