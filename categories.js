// api/categories.js
// GET  /api/categories  → list all active categories
// POST /api/categories  → create a new category

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET')  return await getCategories(req, res);
    if (req.method === 'POST') return await createCategory(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[categories]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/categories ────────────────────────────────────
async function getCategories(req, res) {
  const { include_inactive } = req.query;

  let query = supabase
    .from('categories')
    .select('id, name_en, name_it, name_ar, slug, image, sort_order, is_active')
    .order('sort_order', { ascending: true });

  if (include_inactive !== 'true') {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ data });
}

// ── POST /api/categories ───────────────────────────────────
async function createCategory(req, res) {
  const body = req.body;

  const required = ['name_en', 'name_it', 'name_ar', 'slug'];
  for (const field of required) {
    if (!body[field]) {
      return res.status(422).json({ error: `Missing required field: ${field}` });
    }
  }

  const payload = {
    name_en:    body.name_en,
    name_it:    body.name_it,
    name_ar:    body.name_ar,
    slug:       body.slug.toLowerCase().trim(),
    image:      body.image      || null,
    sort_order: Number(body.sort_order) || 0,
    is_active:  body.is_active !== undefined ? Boolean(body.is_active) : true,
  };

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ data });
}
