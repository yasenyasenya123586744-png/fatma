// api/customers.js
// GET /api/customers  → paginated customer list with search

const supabase       = require('../lib/supabase');
const { handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') return await getCustomers(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[customers]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/customers ─────────────────────────────────────
async function getCustomers(req, res) {
  const {
    page    = 1,
    limit   = 20,
    search,
    sort    = 'created_at',
    order   = 'desc',
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('customers')
    .select(
      `id, email, first_name, last_name, phone, is_active, created_at`,
      { count: 'exact' }
    )
    .range(offset, offset + Number(limit) - 1)
    .order(sort, { ascending: order === 'asc' });

  if (search) {
    query = query.or(
      `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
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
