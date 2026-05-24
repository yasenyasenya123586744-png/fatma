// api/newsletter.js
// POST /api/newsletter  → subscribe to newsletter
// GET  /api/newsletter  → list subscribers (admin)

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

// Simple email regex
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'POST') return await subscribe(req, res);
    if (req.method === 'GET')  return await listSubscribers(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[newsletter]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/newsletter ───────────────────────────────────
async function subscribe(req, res) {
  const { email, first_name, language = 'it', source = 'website' } = req.body;

  if (!email) return res.status(422).json({ error: 'email is required' });
  if (!EMAIL_RE.test(email)) return res.status(422).json({ error: 'Invalid email address' });

  const validLangs = ['en', 'it', 'ar'];
  if (!validLangs.includes(language)) {
    return res.status(422).json({ error: `language must be one of: ${validLangs.join(', ')}` });
  }

  // Upsert: if already subscribed, re-activate
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      {
        email:         email.toLowerCase().trim(),
        first_name:    first_name || null,
        language,
        source,
        is_active:     true,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({
    data,
    message: 'Successfully subscribed!',
  });
}

// ── GET /api/newsletter ────────────────────────────────────
async function listSubscribers(req, res) {
  const { page = 1, limit = 50, active_only = 'true' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('newsletter_subscribers')
    .select('id, email, first_name, language, source, is_active, subscribed_at', { count: 'exact' })
    .range(offset, offset + Number(limit) - 1)
    .order('subscribed_at', { ascending: false });

  if (active_only === 'true') query = query.eq('is_active', true);

  const { data, error, count } = await query;
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({
    data,
    meta: { total: count, page: Number(page), limit: Number(limit) },
  });
}
