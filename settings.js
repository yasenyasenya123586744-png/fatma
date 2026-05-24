// api/settings.js
// GET /api/settings      → fetch all settings (or a specific key via ?key=)
// PUT /api/settings      → update one or more settings

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') return await getSettings(req, res);
    if (req.method === 'PUT') return await updateSettings(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[settings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/settings ──────────────────────────────────────
async function getSettings(req, res) {
  const { key } = req.query;

  let query = supabase
    .from('settings')
    .select('key, value, description');

  if (key) query = query.eq('key', key);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  // Return as flat key-value map for convenience
  const map = {};
  for (const row of data) map[row.key] = row.value;

  return res.status(200).json({ data: map });
}

// ── PUT /api/settings ──────────────────────────────────────
async function updateSettings(req, res) {
  const body = req.body;

  // body should be a flat { key: value, key2: value2 } object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(422).json({ error: 'Body must be a key-value object' });
  }

  const entries = Object.entries(body);
  if (entries.length === 0) {
    return res.status(422).json({ error: 'No settings provided' });
  }

  // Upsert each setting individually
  const results = [];
  for (const [key, value] of entries) {
    const { data, error } = await supabase
      .from('settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: `Failed to update "${key}": ${error.message}` });
    }
    results.push(data);
  }

  return res.status(200).json({ data: results, updated: results.length });
}
