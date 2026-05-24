// api/coupons.js
// GET  /api/coupons           → list all coupons (admin)
// POST /api/coupons           → create a coupon (admin)
// POST /api/coupons?action=validate → validate a coupon code (public)

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  try {
    if (req.method === 'GET')  return await getCoupons(req, res);

    if (req.method === 'POST') {
      // Distinguish between creating a coupon vs validating one
      if (action === 'validate') return await validateCoupon(req, res);
      return await createCoupon(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[coupons]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/coupons ───────────────────────────────────────
async function getCoupons(req, res) {
  const { active_only = 'false' } = req.query;

  let query = supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (active_only === 'true') query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ data });
}

// ── POST /api/coupons ──────────────────────────────────────
async function createCoupon(req, res) {
  const body = req.body;

  const required = ['code', 'discount_type', 'discount_value'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === '') {
      return res.status(422).json({ error: `Missing required field: ${field}` });
    }
  }

  if (!['percentage', 'fixed'].includes(body.discount_type)) {
    return res.status(422).json({ error: 'discount_type must be "percentage" or "fixed"' });
  }

  if (Number(body.discount_value) <= 0) {
    return res.status(422).json({ error: 'discount_value must be greater than 0' });
  }

  if (body.discount_type === 'percentage' && Number(body.discount_value) > 100) {
    return res.status(422).json({ error: 'Percentage discount cannot exceed 100' });
  }

  const payload = {
    code:           body.code.toUpperCase().trim(),
    description:    body.description    || null,
    discount_type:  body.discount_type,
    discount_value: Number(body.discount_value),
    minimum_order:  Number(body.minimum_order)  || 0,
    usage_limit:    body.usage_limit !== undefined ? Number(body.usage_limit) : null,
    is_active:      body.is_active !== undefined ? Boolean(body.is_active) : true,
    expires_at:     body.expires_at || null,
  };

  const { data, error } = await supabase
    .from('coupons')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Coupon code already exists' });
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ data });
}

// ── POST /api/coupons?action=validate ─────────────────────
async function validateCoupon(req, res) {
  const { code, order_total } = req.body;

  if (!code) return res.status(422).json({ error: 'code is required' });

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !coupon) {
    return res.status(404).json({ valid: false, error: 'Coupon not found or inactive' });
  }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(200).json({ valid: false, error: 'Coupon has expired' });
  }

  // Check usage limit
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return res.status(200).json({ valid: false, error: 'Coupon usage limit reached' });
  }

  // Check minimum order
  const total = Number(order_total) || 0;
  if (total < coupon.minimum_order) {
    return res.status(200).json({
      valid: false,
      error: `Minimum order amount is €${coupon.minimum_order}`,
    });
  }

  // Calculate discount
  const discountAmount = coupon.discount_type === 'percentage'
    ? parseFloat(((total * coupon.discount_value) / 100).toFixed(2))
    : parseFloat(Math.min(coupon.discount_value, total).toFixed(2));

  return res.status(200).json({
    valid: true,
    coupon: {
      id:             coupon.id,
      code:           coupon.code,
      discount_type:  coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: discountAmount,
    },
  });
}
