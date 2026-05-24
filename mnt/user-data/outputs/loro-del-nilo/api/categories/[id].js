// api/categories/[id].js
// PUT    /api/categories/:id  → update category
// DELETE /api/categories/:id  → delete category

const supabase       = require('../../lib/supabase');
const { handleCors } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'PUT')    return await updateCategory(req, res, id);
    if (req.method === 'DELETE') return await deleteCategory(req, res, id);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[categories/id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PUT /api/categories/:id ────────────────────────────────
async function updateCategory(req, res, id) {
  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(422).json({ error: 'Request body is empty' });
  }

  const allowed = ['name_en', 'name_it', 'name_ar', 'slug', 'image', 'sort_order', 'is_active'];
  const payload = {};
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  if (payload.slug) payload.slug = payload.slug.toLowerCase().trim();

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    return res.status(400).json({ error: error.message });
  }

  if (!data) return res.status(404).json({ error: 'Category not found' });

  return res.status(200).json({ data });
}

// ── DELETE /api/categories/:id ─────────────────────────────
async function deleteCategory(req, res, id) {
  // Check if any active products belong to this category
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('is_active', true);

  if (count > 0) {
    return res.status(409).json({
      error: `Cannot delete: ${count} active product(s) use this category`,
    });
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ message: 'Category deleted', id });
}
