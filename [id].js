// api/products/[id].js
// GET    /api/products/:id  → fetch single product (by id or slug)
// PUT    /api/products/:id  → update product
// DELETE /api/products/:id  → soft-delete (set is_active = false)

const supabase       = require('../../lib/supabase');
const { handleCors } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'GET')    return await getProduct(req, res, id);
    if (req.method === 'PUT')    return await updateProduct(req, res, id);
    if (req.method === 'DELETE') return await deleteProduct(req, res, id);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[products/id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/products/:id ──────────────────────────────────
async function getProduct(req, res, id) {
  // Support lookup by UUID or by slug
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const field  = isUuid ? 'id' : 'slug';

  const { data, error } = await supabase
    .from('products')
    .select(`*, categories(id, name_en, name_it, name_ar)`)
    .eq(field, id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Product not found' });
  }

  return res.status(200).json({ data });
}

// ── PUT /api/products/:id ──────────────────────────────────
async function updateProduct(req, res, id) {
  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(422).json({ error: 'Request body is empty' });
  }

  // Build update payload — only include provided fields
  const allowed = [
    'name_en','name_it','name_ar','slug','description_en','description_it',
    'description_ar','price','sale_price','stock','weight_grams','sku',
    'category_id','featured','best_seller','is_active','main_image',
    'gallery','seo_title','seo_description','meta_keywords',
  ];

  const payload = {};
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  if (payload.price !== undefined && (isNaN(Number(payload.price)) || Number(payload.price) < 0)) {
    return res.status(422).json({ error: 'price must be a non-negative number' });
  }

  if (payload.slug) payload.slug = payload.slug.toLowerCase().trim();

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    return res.status(400).json({ error: error.message });
  }

  if (!data) return res.status(404).json({ error: 'Product not found' });

  return res.status(200).json({ data });
}

// ── DELETE /api/products/:id ───────────────────────────────
async function deleteProduct(req, res, id) {
  // Soft delete — keeps data integrity with order_items references
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id)
    .select('id')
    .single();

  if (error || !data) return res.status(404).json({ error: 'Product not found' });

  return res.status(200).json({ message: 'Product deactivated', id });
}
