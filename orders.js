// api/orders.js
// GET  /api/orders  → list orders (admin, with filters)
// POST /api/orders  → create a new order

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET')  return await getOrders(req, res);
    if (req.method === 'POST') return await createOrder(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[orders]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/orders ────────────────────────────────────────
async function getOrders(req, res) {
  const {
    page   = 1,
    limit  = 20,
    status,
    payment_status,
    customer_id,
    search,
    sort   = 'created_at',
    order  = 'desc',
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('orders')
    .select(
      `id, order_number, status, payment_status, total, created_at,
       customer_id, customers(first_name, last_name, email)`,
      { count: 'exact' }
    )
    .range(offset, offset + Number(limit) - 1)
    .order(sort, { ascending: order === 'asc' });

  if (status)         query = query.eq('status', status);
  if (payment_status) query = query.eq('payment_status', payment_status);
  if (customer_id)    query = query.eq('customer_id', customer_id);
  if (search)         query = query.ilike('order_number', `%${search}%`);

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

// ── POST /api/orders ───────────────────────────────────────
async function createOrder(req, res) {
  const body = req.body;

  // Validate required fields
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(422).json({ error: 'Order must contain at least one item' });
  }

  const requiredShipping = ['shipping_first_name', 'shipping_last_name', 'shipping_street', 'shipping_city', 'shipping_postal_code', 'shipping_country'];
  for (const field of requiredShipping) {
    if (!body[field]) return res.status(422).json({ error: `Missing required field: ${field}` });
  }

  // Validate & fetch product data for each item
  const enrichedItems = [];
  let subtotal = 0;

  for (const item of body.items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) < 1) {
      return res.status(422).json({ error: 'Each item requires product_id and quantity >= 1' });
    }

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, name_it, sku, price, sale_price, stock, main_image')
      .eq('id', item.product_id)
      .eq('is_active', true)
      .single();

    if (pErr || !product) {
      return res.status(422).json({ error: `Product not found: ${item.product_id}` });
    }

    if (product.stock < item.quantity) {
      return res.status(422).json({ error: `Insufficient stock for: ${product.name_it}` });
    }

    const unitPrice  = product.sale_price ?? product.price;
    const totalPrice = unitPrice * Number(item.quantity);
    subtotal        += totalPrice;

    enrichedItems.push({
      product_id:   product.id,
      product_name: product.name_it,
      product_sku:  product.sku,
      unit_price:   unitPrice,
      quantity:     Number(item.quantity),
      total_price:  totalPrice,
      image_url:    product.main_image,
    });
  }

  // Validate coupon if provided
  let discountAmount = 0;
  let couponId       = null;

  if (body.coupon_code) {
    const { data: coupon, error: cErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', body.coupon_code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (cErr || !coupon) {
      return res.status(422).json({ error: 'Invalid or expired coupon code' });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(422).json({ error: 'Coupon has expired' });
    }

    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return res.status(422).json({ error: 'Coupon usage limit reached' });
    }

    if (subtotal < coupon.minimum_order) {
      return res.status(422).json({
        error: `Minimum order for this coupon is €${coupon.minimum_order}`,
      });
    }

    discountAmount = coupon.discount_type === 'percentage'
      ? (subtotal * coupon.discount_value) / 100
      : coupon.discount_value;

    couponId = coupon.id;
  }

  // Retrieve shipping cost from settings
  const { data: shippingSettings } = await supabase
    .from('settings')
    .select('value')
    .in('key', ['shipping_base_cost', 'shipping_free_above']);

  const settingsMap = {};
  for (const s of shippingSettings || []) settingsMap[s.key] = s.value;

  const freeAbove   = Number(settingsMap['shipping_free_above'] || 50);
  const baseCost    = Number(settingsMap['shipping_base_cost']   || 5.90);
  const shippingCost = subtotal >= freeAbove ? 0 : baseCost;

  // Tax (22% VAT — applied on subtotal after discount)
  const taxRate      = 0.22;
  const taxableAmount = subtotal - discountAmount + shippingCost;
  const taxAmount    = parseFloat((taxableAmount * taxRate / (1 + taxRate)).toFixed(2));
  const total        = parseFloat((subtotal - discountAmount + shippingCost).toFixed(2));

  // Generate human-readable order number
  const orderNumber = `ORO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Insert order in a transaction-like fashion
  const { data: newOrder, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number:        orderNumber,
      customer_id:         body.customer_id   || null,
      coupon_id:           couponId,
      subtotal,
      discount_amount:     discountAmount,
      shipping_cost:       shippingCost,
      tax_amount:          taxAmount,
      total,
      payment_method:      body.payment_method || null,
      shipping_first_name: body.shipping_first_name,
      shipping_last_name:  body.shipping_last_name,
      shipping_street:     body.shipping_street,
      shipping_city:       body.shipping_city,
      shipping_state:      body.shipping_state       || null,
      shipping_postal_code:body.shipping_postal_code,
      shipping_country:    body.shipping_country,
      shipping_phone:      body.shipping_phone       || null,
      notes:               body.notes                || null,
    })
    .select()
    .single();

  if (orderErr) return res.status(400).json({ error: orderErr.message });

  // Insert order items
  const itemsPayload = enrichedItems.map((item) => ({
    ...item,
    order_id: newOrder.id,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
  if (itemsErr) return res.status(400).json({ error: itemsErr.message });

  // Decrement stock for each product
  for (const item of enrichedItems) {
    await supabase.rpc('decrement_stock', {
      p_product_id: item.product_id,
      p_quantity:   item.quantity,
    }).catch(() => {}); // non-critical — handle separately if needed
  }

  // Increment coupon used_count
  if (couponId) {
    await supabase
      .from('coupons')
      .update({ used_count: supabase.rpc('increment', { row_id: couponId }) })
      .eq('id', couponId)
      .catch(() => {});
  }

  return res.status(201).json({ data: newOrder });
}
