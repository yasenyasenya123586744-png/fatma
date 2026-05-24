// lib/cors.js — Reusable CORS middleware for all API routes

/**
 * Sets CORS headers on the response object.
 * Call this at the top of every handler.
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24h preflight cache
}

/**
 * Handles OPTIONS preflight and sets CORS headers.
 * Returns true if the request was a preflight (caller should return early).
 */
function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { setCorsHeaders, handleCors };
