const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/documents/upload  (multipart/form-data, field name "file")
// Uses req.file from multer middleware (configured in routes)
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const { category, linked_entity_type, linked_entity_id } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'image';

  const { rows } = await db.query(
    `INSERT INTO documents (file_name, file_url, file_type, category, linked_entity_type, linked_entity_id, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.file.originalname, fileUrl, fileType, category, linked_entity_type, linked_entity_id || null, req.user.id]
  );

  // NOTE: plug an OCR service (e.g. Tesseract.js or a cloud Vision API) here and
  // update documents.ocr_text asynchronously once text has been extracted.

  res.status(201).json({ success: true, data: rows[0] });
});

exports.list = asyncHandler(async (req, res) => {
  const { category, linked_entity_type, linked_entity_id, search } = req.query;
  const conditions = [];
  const params = [];
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (linked_entity_type) { params.push(linked_entity_type); conditions.push(`linked_entity_type = $${params.length}`); }
  if (linked_entity_id) { params.push(linked_entity_id); conditions.push(`linked_entity_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(file_name ILIKE $${params.length} OR ocr_text ILIKE $${params.length})`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(`SELECT * FROM documents ${where} ORDER BY created_at DESC`, params);
  res.json({ success: true, data: rows });
});

exports.remove = asyncHandler(async (req, res) => {
  const { rows } = await db.query('DELETE FROM documents WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, message: 'Document deleted' });
});
