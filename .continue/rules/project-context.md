# UTH Smart Assets - Project Context

> Hospital Asset Management system ("UTH Smart Assets") for a hospital
> planning -> procurement -> finance -> accounting -> legal workflow + asset registry.
> Read this first before working on any feature. Keep it in sync with AGENTS.md.

## Tech Stack
- Framework: Next.js 16 (App Router) + React 19, output: 'export' (static) in production
- Language: TypeScript (app + most domain libs) and some JavaScript .mjs libs in lib/
- DB (LIVE): SQLite via Prisma ORM v6 -> prisma/dev.db (schema: prisma/schema.prisma)
- DB (DESIGN, not in use): prisma/phase2.prisma (MySQL, 15-step cycle) - NOT applied to any DB
- Backend service (separate): backend/ = Fastify + RSA-JWT (needs issuer/aud/key config; not on a DB)
- Styling: Tailwind CSS 4   -   Charts: Recharts v3   -   UI primitives: components/ui/ (Radix + CVA)
- Testing: node --test  (npm test -> node --test tests/*.test.mjs)
- Offline: scripts/prepare-offline.mjs (static export) + public/sw.js (Service Worker + IndexedDB)
- PM: npm

## Run / Verify
    npm run dev          # dev server (127.0.0.1:3001)
    npm run build        # next build --webpack + offline bundle
    npm start            # serve static export (scripts/serve.mjs)
    npm test             # node --test
    npx prisma generate  # after editing prisma/schema.prisma
- REAL SERVER (remote): DGX Spark at http://192.168.1.224:3001 - view results in a browser.
- WORKFLOW: edit -> git push -> (DGX) git pull -> dev server HMR reload -> check browser.
- NOTE: assets/users/dashboard read/write prisma/dev.db (SQLite). The 15-step cycle + most
  workspaces are DEMO state (in-memory / IndexedDB) and reset when leaving - that is by design
  for the prototype, NOT a bug.

## Key Files
| File | Role |
|------|------|
| app/page.tsx | Main page, AuthGate + tabs (dashboard/assets/procurement/reports/settings) |
| app/api/assets/route.ts | Asset list (GET: search+filter+pagination) + create (POST) |
| app/api/assets/[id]/route.ts | Asset single GET / PUT / DELETE |
| app/api/auth/route.ts | Login (POST, sets cookie) / session (GET) / logout (DELETE) |
| app/api/users/{route,[id]}/route.ts | User management (list/create/update/delete), RBAC |
| app/api/dashboard/route.ts | Dashboard KPIs + chart data |
| app/api/reports/assets-pdf/route.ts | PDF report (assets) |
| components/asset-catalog-workspace.tsx | Asset table UI + CRUD modal (CURRENT FOCUS) |
| components/executive-dashboard.tsx | Dashboard + charts (Recharts) |
| components/procurement-flow-workspace.tsx | 15-step cycle (DEMO) |
| components/{planning,lifecycle,master-data,user-management,system-log,regulatory}-*.tsx | workspaces |
| lib/prisma.ts | PrismaClient singleton (lazy init) |
| lib/auth.mjs / lib/users.mjs | session + user logic |
| lib/csv.mjs / lib/excel-import.ts | CSV/Excel import (client-side, no /api/csv route) |
| lib/pdf-report.ts / lib/pdf-server.ts | PDF generation |
| lib/procurement-flow.ts | 15-step cycle domain logic |
| lib/seed.ts | Seed test users + data |
| lib/utils.ts | cn() + formatCurrency() |
| prisma/schema.prisma | LIVE SQLite schema |
| prisma/phase2.prisma | Phase-2 MySQL design (not used by the app) |
| docs/ | 13 design docs - read the relevant one before changing a module |

## SCHEMA (prisma/schema.prisma - SQLite, LIVE)
Enums: AssetStatus, UserRole(ADMIN|WAREHOUSE|WARD|AUDITOR)
Models: Plan, PurchaseOrder, POLine, ReceiptLine, Asset, PaymentClaim,
        JournalEntry, WorkflowException, AuditLog, SyncReceipt,
        User, UserWard, UserLoginLog, ConflictCase

    model Asset {
      id          String @id @default(uuid())
      hospitalId  String
      wardId      String          // NOT "department" / NOT "location"
      receiptId   String?         // optional FK -> ReceiptLine
      assetNo     String          // NOT "assetNumber"
      name        String          // NOT "assetName"
      status      AssetStatus @default(AVAILABLE)   // ENUM, not free text
      version     Int @default(0)
      needsReview Boolean @default(false)
      cost        Decimal         // NOT "unitPrice"
      receipt     ReceiptLine?
      conflicts   ConflictCase[]
      journals    JournalEntry[]
      @@unique([hospitalId, assetNo])
      @@index([hospitalId, wardId, status])
    }
    model User {
      id, hospitalId, staffCode, fullName, role UserRole, passwordHash,
      active Boolean @default(true), wards UserWard[], loginLogs UserLoginLog[]
      @@unique([hospitalId, staffCode])
    }

COMMON FIELD MISTAKES TO AVOID:
  assetName   -> name      assetNumber -> assetNo
  department  -> wardId    location    -> wardId
  unitPrice   -> cost      status      -> one of the AssetStatus enum values
NOTE: the datasource url in schema.prisma is an ABSOLUTE file path
  (file:///home/admin/Working/edr-new/prisma/dev.db). Keep it absolute.

## API Contract (live)
GET /api/assets?page&pageSize&search&status&wardId&hospitalId
  -> { assets, total, page, pageSize, totalPages }
  - search: assetNo OR name (case-insensitive)  - status: exact enum  - pageSize default 25, max 100
POST /api/assets            body { hospitalId, wardId?, assetNo, name, cost?, status? }
  -> 201 { asset } | 400 (missing) | 409 (duplicate assetNo)
PUT /api/assets/[id]        body { name?, status?, cost?, wardId?, needsReview? } -> bumps version
DELETE /api/assets/[id]     -> deletes asset
GET/POST/DELETE /api/auth   -> session cookie; 401 on bad login
GET/POST /api/users, GET/PUT/DELETE /api/users/[id]   -> user management
GET /api/dashboard, GET /api/reports/assets-pdf
NOTE: CSV import is CLIENT-SIDE (components/legacy-excel-import.tsx + lib/csv.mjs + excel-import.ts);
      there is NO /api/csv route.

## AUTH + RBAC (verified)
- POST /api/auth { staffCode, password }: staffCode is .toUpperCase() server-side before lookup
  ("admin" == "ADMIN"). 401 on bad creds; success writes a UserLoginLog row.
- Roles: ADMIN (all), WAREHOUSE (all assets), WARD (scoped to user.wards wardIds), AUDITOR (read-only).
- Seeded logins: ADMIN (pw `admin`) is the standard admin; 12345, WARE-01, WARD-01,
  AUDIT-01 all use pw `uth12345` (roles ADMIN / WAREHOUSE / WARD / AUDITOR).
- Session is a signed cookie; /api/auth GET returns the current public user (or 401).

## Feature status (honest, as of 2026-03-11)
| Area | Status |
|------|--------|
| Executive Dashboard + Charts (Recharts) | DONE (live) |
| Asset CRUD (register/edit/delete) | DONE (API + UI, live SQLite) |
| Search + Filter + Pagination (assets) | DONE |
| Login + RBAC (4 roles + ward scoping) | DONE |
| User management (UI + API) | DONE |
| Asset numbering | DONE |
| CSV/Excel import (client-side) | DONE (prototype) |
| PDF export (assets) | DONE |
| System log + audit (UserLoginLog/AuditLog) | DONE |
| Planning / Procurement / Finance / Accounting / Legal workspaces | WORKING PROTOTYPE (demo state) |
| 15-step procurement cycle (lib/procurement-flow.ts) | WORKING PROTOTYPE (in-memory) |
| Multi-hospital (multi-tenant) | TODO (hospitalId is single "UTH") |
| AI Assistant (Ollama) | TODO |
| Real MySQL: transaction/rollback/concurrency/trigger tests | TODO (open in VERIFICATION.md) |
| Real device / HOSxP / e-GP / OCR / RFID integration | TODO (prototype only) |

## Conventions
- Components: named export AND export default (some files import both ways)
- Button variant: only default | secondary | ghost  (NO "outline")
- Currency display: formatCurrency() from lib/utils.ts
- crypto.randomUUID(): add a fallback polyfill in browser HTTP context
- After editing prisma/schema.prisma: npx prisma generate
- Read the matching docs/ file before changing a module

## Repo notes
- prisma/dev.db is COMMITTED as a binary (SQLite data lives in git) - KEEP it
  committed: the datasource path is the same absolute path on local + DGX, so it
  is how seeded test data syncs via git push/pull; do NOT gitignore it.
- Seed helpers live in scripts/ (run from repo root):
    node scripts/seed-uth-users.mjs  -> 4 role accounts
    node scripts/set-admin.mjs       -> ADMIN (pw admin)
- Seeded logins in dev.db (staffCode / password -> role):
    ADMIN   / admin     -> ADMIN      (standard admin login; set-admin.mjs)
    12345   / uth12345  -> ADMIN      (seed-uth-users.mjs)
    WARE-01 / uth12345  -> WAREHOUSE  (seed-uth-users.mjs)
    WARD-01 / uth12345  -> WARD       (seed-uth-users.mjs)
    AUDIT-01/ uth12345  -> AUDITOR    (seed-uth-users.mjs)
