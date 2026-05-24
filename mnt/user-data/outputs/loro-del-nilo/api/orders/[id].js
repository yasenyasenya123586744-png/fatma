// api/orders/[id].js
// GET /api/orders/:id  → fetch order with items
// PUT /api/orders/:id  → update order status / tracking

const supabase       = require('../../lib/supabase');
const { handleCors } = require('../../lib/cors');

const VALID_STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'];
const VALID_PAYMENT  = ['unpaid','paid','partially_refunded','refunded'];

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'GET') return await getOrder(req, res, id);
    if (req.method === 'PUT') return await updateOrder(req, res, id);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[orders/id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/orders/:id ────────────────────────────────────
async function getOrder(req, res, id) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const field  = isUuid ? 'id' : 'order_number';

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers(id, first_name, last_name, email, phone),
      order_items(*)
    `)
    .eq(field, id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Order not found' });

  return res.status(200).json({ data });
}

// ── PUT /api/orders/:id ────────────────────────────────────
async function updateOrder(req, res, id) {
  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(422).json({ error: 'Request body is empty' });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return res.status(422).json({
      error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
    });
  }

  if (body.payment_status && !VALID_PAYMENT.includes(body.payment_status)) {
    return res.status(422).json({
      error: `Invalid payment_status. Allowed: ${VALID_PAYMENT.join(', ')}`,
    });
  }

  const allowed = [
    'status', 'payment_status', 'payment_intent_id', 'tracking_number',
    'admin_notes', 'shipped_at', 'delivered_at',
  ];

  const payload = {};
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  // Auto-set timestamps
  if (payload.status === 'shipped'   && !payload.shipped_at)   payload.shipped_at   = new Date().toISOString();
  if (payload.status === 'delivered' && !payload.delivered_at) payload.delivered_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: 'Order not found' });

  return res.status(200).json({ data });
}
