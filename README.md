# BrickMaster ERP — Backend API

Node.js + Express + PostgreSQL REST API for the Brick Kiln ERP system
(Finance, Inventory, Workers, Production, Sales, Documents, Reports, Admin).

## Stack
- **Runtime:** Node.js 18+, Express 4
- **Database:** PostgreSQL (raw `pg` driver, parameterized SQL — no ORM)
- **Auth:** JWT access + refresh tokens, role-based access control (RBAC)
- **Files:** Multer disk storage locally (swap for S3 / Cloud Storage in production)
- **Exports:** ExcelJS (xlsx), CSV, PDFKit available for PDF generation

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your PostgreSQL credentials and JWT secrets

# 3. Create the database, then run the schema
createdb brickmaster_erp
npm run migrate          # runs database/schema.sql

# 4. Seed a default Super Admin + starter inventory rows
npm run seed
# login: admin@brickmaster.local / ChangeMe123!  -> change this immediately

# 5. Start the API
npm run dev               # nodemon, development
npm start                 # production
```

API listens on `http://localhost:5000`. Health check: `GET /health`.

## Project structure

```
src/
  config/db.js          PostgreSQL connection pool
  middleware/            auth (JWT), roleCheck (RBAC), errorHandler
  utils/                  jwt helpers, asyncHandler
  controllers/            business logic per module (raw SQL queries)
  routes/                 Express routers per module, mounted under /api
  app.js                  Express app: security, rate limiting, routes
  server.js               entry point
database/
  schema.sql              full PostgreSQL schema (all modules)
  seed.js                  starter data
```

## Authentication

All endpoints except `POST /api/auth/login` and `POST /api/auth/refresh`
require `Authorization: Bearer <accessToken>`.

```
POST /api/auth/login       { email, password } -> { accessToken, refreshToken, user }
POST /api/auth/refresh     { refreshToken }     -> { accessToken }
GET  /api/auth/me          -> current user
POST /api/auth/register    (super_admin/admin only) -> create a new user
```

## Roles

`super_admin`, `admin`, `finance_manager`, `inventory_manager`,
`production_manager`, `hr_manager`, `viewer`.

`super_admin` always has access to every route. Each module restricts
write operations (`POST`/`PUT`/`PATCH`/`DELETE`) to its relevant manager
role via `requireRole()`; reads (`GET`) are open to any authenticated user
— tighten this per-route if `viewer` should not see certain data.

## API overview

| Module | Base path | Notes |
|---|---|---|
| Finance | `/api/finance` | `/income`, `/expenses`, `/loans`, `/loans/:id/payments`, `/reports/profit-loss` |
| Inventory | `/api/inventory` | `/raw-materials`, `/finished-products`, `/transactions`, `/alerts/low-stock` |
| Workers | `/api/workers` | profiles + source-kiln tracking, `/attendance/bulk`, `/:id/advances` |
| Production | `/api/production` | `/batches` (auto-credits finished-goods inventory on creation), `/efficiency` |
| Sales | `/api/sales` | `/customers`, `/invoices` (auto-reserves stock), `/invoices/:id/payments` |
| Documents | `/api/documents` | `/upload` (multipart, field `file`), linked to any entity by type+id |
| Reports | `/api/reports` | `/dashboard-summary`, `/export/:type?format=xlsx\|csv` |
| Notifications | `/api/notifications` | per-user alerts |
| Users/Admin | `/api/users` | admin-only: list users, roles, audit log |

## Things left as extension points

- **OCR** on uploaded documents — wire up Tesseract.js or a cloud Vision API
  inside `documents.controller.js` (`upload`), then write the result into
  `documents.ocr_text`.
- **Notifications delivery** — rows are written to the `notifications` table;
  hook up email (e.g. Nodemailer) and SMS (e.g. Twilio) senders where alerts
  are generated (low stock, loan due, salary due).
- **Cloud file storage** — `documents.routes.js` uses local disk via Multer;
  swap the `multer.diskStorage` for an S3/GCS multer storage engine for
  production, and update `file_url` accordingly.
- **Audit logging** — the `audit_logs` table exists; write to it from
  controllers on sensitive actions (loan edits, user changes, etc.).
- **Invoice PDF/QR code** — PDFKit is installed; generate PDFs and a QR
  code (e.g. with the `qrcode` package) in `sales.controller.js` and store
  the file via the documents/upload flow.
