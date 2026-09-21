-- ============================================================
-- BrickMaster ERP — PostgreSQL Schema
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- USERS & ROLES ----------
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(40) UNIQUE NOT NULL,           -- super_admin, admin, finance_manager, inventory_manager, production_manager, hr_manager, viewer
  description TEXT
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT REFERENCES roles(id) NOT NULL,
  phone VARCHAR(30),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- WORKERS ----------
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  cnic VARCHAR(20) UNIQUE,
  mobile_number VARCHAR(30),
  address TEXT,
  photo_url TEXT,
  joining_date DATE,
  monthly_salary NUMERIC(12,2),
  daily_wage NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'active',        -- active, leave, terminated
  -- source tracking
  source_kiln_name VARCHAR(150),
  contractor_name VARCHAR(150),
  contractor_contact VARCHAR(30),
  transfer_details TEXT,
  agreement_details TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE worker_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT,
  given_date DATE DEFAULT CURRENT_DATE,
  recovered_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',         -- active, cleared
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,                 -- present, absent, leave, half_day
  overtime_hours NUMERIC(4,1) DEFAULT 0,
  notes TEXT,
  marked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, work_date)
);

-- ---------- INVENTORY ----------
CREATE TABLE raw_materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,            -- Clay, Coal, Sand, Water, Fuel
  unit VARCHAR(20) NOT NULL,                   -- tons, liters, etc.
  quantity_on_hand NUMERIC(14,2) DEFAULT 0,
  reorder_level NUMERIC(14,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE finished_products (
  id SERIAL PRIMARY KEY,
  grade VARCHAR(10) NOT NULL,                  -- A, B, C
  quantity_on_hand BIGINT DEFAULT 0,
  reserved_quantity BIGINT DEFAULT 0,
  location VARCHAR(80),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(grade, location)
);

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_type VARCHAR(20) NOT NULL,              -- raw_material, finished_product
  item_id INT NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,       -- stock_in, stock_out, transfer, damage, waste
  quantity NUMERIC(14,2) NOT NULL,
  reference_note TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- PRODUCTION ----------
CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number VARCHAR(30) UNIQUE NOT NULL,
  production_date DATE NOT NULL,
  quantity_produced BIGINT NOT NULL,
  quality_grade VARCHAR(10) NOT NULL,
  supervisor_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'firing',         -- molding, drying, firing, complete
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- FINANCE ----------
CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(30) NOT NULL,                 -- customer_payment, cash_sale, bank_deposit
  customer_id UUID,                             -- FK added after customers table
  description TEXT,
  payment_method VARCHAR(20),                   -- cash, bank_transfer, cheque
  amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'paid',            -- paid, pending, overdue
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(30) NOT NULL,                -- fuel, labor, transportation, machinery, miscellaneous
  description TEXT,
  paid_to VARCHAR(150),
  amount NUMERIC(14,2) NOT NULL,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_name VARCHAR(150) NOT NULL,
  loan_type VARCHAR(20) NOT NULL,               -- given, received
  principal_amount NUMERIC(14,2) NOT NULL,
  returned_amount NUMERIC(14,2) DEFAULT 0,
  loan_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'active',          -- active, cleared, overdue
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE loan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- SALES / CUSTOMERS ----------
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(30),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE income ADD CONSTRAINT fk_income_customer FOREIGN KEY (customer_id) REFERENCES customers(id);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',         -- paid, pending, overdue
  qr_code_url TEXT,
  pdf_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  grade VARCHAR(10) NOT NULL,
  quantity BIGINT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL
);

-- ---------- DOCUMENTS ----------
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20),                        -- pdf, image
  category VARCHAR(40),                          -- bill, receipt, purchase_slip, loan_document, worker_document, inventory_document, agreement
  linked_entity_type VARCHAR(30),                -- worker, loan, invoice, expense, inventory
  linked_entity_id UUID,
  ocr_text TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(30) NOT NULL,                     -- low_stock, loan_due, salary_due, expense_alert, pending_payment
  title VARCHAR(200) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- AUDIT LOG ----------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,                  -- e.g. 'updated_loan', 'created_invoice'
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- INDEXES ----------
CREATE INDEX idx_attendance_worker_date ON attendance(worker_id, work_date);
CREATE INDEX idx_income_date ON income(income_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_production_date ON production_batches(production_date);
CREATE INDEX idx_stock_txn_item ON stock_transactions(item_type, item_id);
CREATE INDEX idx_documents_linked ON documents(linked_entity_type, linked_entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);

-- ---------- SEED ROLES ----------
INSERT INTO roles (name, description) VALUES
 ('super_admin','Full access to all modules'),
 ('admin','Administrative access, most modules'),
 ('finance_manager','Finance, loans, reports'),
 ('inventory_manager','Inventory and stock'),
 ('production_manager','Production batches and quality'),
 ('hr_manager','Workers, attendance, documents'),
 ('viewer','Read-only access');
