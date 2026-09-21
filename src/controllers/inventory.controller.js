const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/* ---------------- RAW MATERIALS ---------------- */
exports.listRawMaterials = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM raw_materials ORDER BY name');
  res.json({ success: true, data: rows });
});

/* ---------------- FINISHED PRODUCTS ---------------- */
exports.listFinishedProducts = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT *, (quantity_on_hand - reserved_quantity) AS available_quantity
     FROM finished_products ORDER BY grade`
  );
  res.json({ success: true, data: rows });
});

/* ---------------- STOCK TRANSACTIONS ---------------- */
// POST /api/inventory/transactions
// body: { item_type: 'raw_material'|'finished_product', item_id, transaction_type: 'stock_in'|'stock_out'|'transfer'|'damage'|'waste', quantity, reference_note }
exports.createStockTransaction = asyncHandler(async (req, res) => {
  const { item_type, item_id, transaction_type, quantity, reference_note } = req.body;

  if (!['raw_material', 'finished_product'].includes(item_type)) {
    return res.status(400).json({ success: false, message: 'item_type must be raw_material or finished_product' });
  }
  if (!['stock_in', 'stock_out', 'transfer', 'damage', 'waste'].includes(transaction_type)) {
    return res.status(400).json({ success: false, message: 'Invalid transaction_type' });
  }
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'A positive quantity is required' });
  }

  const table = item_type === 'raw_material' ? 'raw_materials' : 'finished_products';
  const qtyCol = 'quantity_on_hand';
  const delta = ['stock_in'].includes(transaction_type) ? quantity : -quantity;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE ${table} SET ${qtyCol} = ${qtyCol} + $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [delta, item_id]
    );
    if (updateRes.rows.length === 0) {
      throw Object.assign(new Error('Item not found'), { statusCode: 404 });
    }

    const txnRes = await client.query(
      `INSERT INTO stock_transactions (item_type, item_id, transaction_type, quantity, reference_note, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [item_type, item_id, transaction_type, quantity, reference_note, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { item: updateRes.rows[0], transaction: txnRes.rows[0] } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

exports.listTransactions = asyncHandler(async (req, res) => {
  const { item_type, item_id } = req.query;
  const conditions = [];
  const params = [];
  if (item_type) { params.push(item_type); conditions.push(`item_type = $${params.length}`); }
  if (item_id) { params.push(item_id); conditions.push(`item_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT * FROM stock_transactions ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
});

/* ---------------- LOW STOCK ALERTS ---------------- */
exports.lowStockAlerts = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, quantity_on_hand, reorder_level, unit
     FROM raw_materials WHERE quantity_on_hand <= reorder_level ORDER BY quantity_on_hand ASC`
  );
  res.json({ success: true, data: rows });
});
