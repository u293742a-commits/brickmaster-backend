// Run with: npm run seed
// Creates a default Super Admin login and starter raw-material/finished-product rows.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seed() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const roleRes = await db.query(`SELECT id FROM roles WHERE name = 'super_admin'`);
  await db.query(
    `INSERT INTO users (full_name, email, password_hash, role_id)
     VALUES ('Super Admin', 'admin@brickmaster.local', $1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash, roleRes.rows[0].id]
  );

  const materials = [
    ['Clay', 'tons', 1240, 200],
    ['Coal', 'tons', 2.1, 5],
    ['Sand', 'tons', 340, 80],
    ['Water', 'liters', 18000, 5000],
    ['Diesel', 'liters', 410, 500],
  ];
  for (const [name, unit, qty, reorder] of materials) {
    await db.query(
      `INSERT INTO raw_materials (name, unit, quantity_on_hand, reorder_level)
       VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO NOTHING`,
      [name, unit, qty, reorder]
    );
  }

  const grades = [['A', 58200], ['B', 31400], ['C', 9900]];
  for (const [grade, qty] of grades) {
    await db.query(
      `INSERT INTO finished_products (grade, quantity_on_hand, location)
       VALUES ($1,$2,'Yard 1') ON CONFLICT (grade, location) DO NOTHING`,
      [grade, qty]
    );
  }

  console.log('Seed complete. Login with admin@brickmaster.local / ChangeMe123! (change this immediately).');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
