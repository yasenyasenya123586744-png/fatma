// api/upload.js
// POST /api/upload  → upload image to Cloudinary
// Accepts: multipart/form-data OR base64 JSON body

const cloudinary     = require('cloudinary').v2;
const { handleCors } = require('../lib/cors');
const { Readable }   = require('stream');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Vercel serverless: disable body parsing to handle raw streams
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, folder = 'loro-del-nilo', public_id } = req.body;

    if (!file) {
      return res.status(422).json({ error: 'Missing file field (base64 data URI)' });
    }

    // Validate it looks like a data URI or base64
    if (!file.startsWith('data:image/') && !file.startsWith('data:application/')) {
      return res.status(422).json({ error: 'file must be a valid base64 data URI' });
    }

    // Upload to Cloudinary
    const uploadOptions = {
      folder,
      resource_type:   'image',
      quality:         'auto:best',
      fetch_format:    'auto',
      transformation:  [{ width: 2000, crop: 'limit' }],
    };

    if (public_id) uploadOptions.public_id = public_id;

    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return res.status(200).json({
      data: {
        public_id:   result.public_id,
        url:         result.secure_url,
        width:       result.width,
        height:      result.height,
        format:      result.format,
        bytes:       result.bytes,
        folder:      result.folder,
      },
    });
  } catch (err) {
    console.error('[upload]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
};
