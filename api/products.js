// api/products.js
// GET  /api/products  → paginated product list with filters
// POST /api/products  → create a new product (admin)

const supabase        = require('../lib/supabase');
const { handleCors }  = require('../lib/cors');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      return await getProducts(req, res);
    }
    if (req.method === 'POST') {
      return await createProduct(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[products]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/products ──────────────────────────────────────
async function getProducts(req, res) {
  const {
    page       = 1,
    limit      = 20,
    category,
    featured,
    best_seller,
    search,
    lang       = 'it',      // language hint (en | it | ar)
    sort       = 'created_at',
    order      = 'desc',
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('products')
    .select(
      `id, name_en, name_it, name_ar, slug, price, sale_price,
       stock, featured, best_seller, is_active, main_image, gallery,
       seo_title, seo_description, category_id,
       categories(id, name_en, name_it, name_ar)`,
      { count: 'exact' }
    )
    .eq('is_active', true)
    .range(offset, offset + Number(limit) - 1)
    .order(sort, { ascending: order === 'asc' });

  if (category)    query = query.eq('category_id', category);
  if (featured)    query = query.eq('featured',    featured === 'true');
  if (best_seller) query = query.eq('best_seller', best_seller === 'true');
  if (search) {
    // Full-text search across all language name fields
    query = query.or(
      `name_en.ilike.%${search}%,name_it.ilike.%${search}%,name_ar.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({
    data,
    meta: {
      total: count,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(count / Number(limit)),
    },
  });
}

// ── POST /api/products ─────────────────────────────────────
async function createProduct(req, res) {
  const body = req.body;

  // Validation
  const required = ['name_en', 'name_it', 'name_ar', 'slug', 'price'];
  for (const field of required) {
    if (!body[field]) {
      return res.status(422).json({ error: `Missing required field: ${field}` });
    }
  }

  if (isNaN(Number(body.price)) || Number(body.price) < 0) {
    return res.status(422).json({ error: 'price must be a non-negative number' });
  }

  const payload = {
    name_en:         body.name_en,
    name_it:         body.name_it,
    name_ar:         body.name_ar,
    slug:            body.slug.toLowerCase().trim(),
    description_en:  body.description_en  || null,
    description_it:  body.description_it  || null,
    description_ar:  body.description_ar  || null,
    price:           Number(body.price),
    sale_price:      body.sale_price ? Number(body.sale_price) : null,
    stock:           Number(body.stock) || 0,
    weight_grams:    body.weight_grams ? Number(body.weight_grams) : null,
    sku:             body.sku            || null,
    category_id:     body.category_id   || null,
    featured:        Boolean(body.featured),
    best_seller:     Boolean(body.best_seller),
    is_active:       body.is_active !== undefined ? Boolean(body.is_active) : true,
    main_image:      body.main_image     || null,
    gallery:         Array.isArray(body.gallery) ? body.gallery : [],
    seo_title:       body.seo_title      || null,
    seo_description: body.seo_description|| null,
    meta_keywords:   Array.isArray(body.meta_keywords) ? body.meta_keywords : [],
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ data });
}
