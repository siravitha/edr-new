# AGENTS.md - UTH Smart Assets (edr-new)

Context for AI coding agents (Cline / Continue / Cursor / Copilot).
Full detail: read .continue/rules/project-context.md

## What this is
Hospital Asset Management system ("UTH Smart Assets") for a hospital
planning -> procurement -> finance -> accounting -> legal workflow plus an
asset registry. Next.js 16 (App Router) + React 19 + TypeScript + Prisma
(SQLite) + Tailwind + Recharts.
STATUS: working PROTOTYPE. Assets + users + dashboard are LIVE on SQLite;
the 15-step cycle and most department workspaces are DEMO (in-memory /
IndexedDB) until the Phase-2 MySQL schema is adopted. See docs/ for design.

## Commands
  npm run dev          # dev server (127.0.0.1:3001)
  npm run build        # next build --webpack + offline bundle
  npm start            # serve static export (scripts/serve.mjs)
  npm test             # node --test tests/*.test.mjs
  npx prisma generate  # after editing prisma/schema.prisma

## Repo layout
  app/page.tsx                          # main tabbed UI (dashboard/assets/procurement/reports/settings)
  app/api/assets/route.ts               # GET list (search/filter/paginate) + POST create
  app/api/assets/[id]/route.ts          # GET / PUT / DELETE single asset
  app/api/auth/route.ts                 # POST login (session cookie) / GET session / DELETE logout
  app/api/users/{route,[id]}/route.ts   # user management (RBAC)
  app/api/dashboard/route.ts            # dashboard KPI + chart data
  app/api/reports/assets-pdf/route.ts   # PDF report
  components/asset-catalog-workspace.tsx # asset table + CRUD modal (CURRENT FOCUS)
  components/executive-dashboard.tsx     # dashboard + Recharts
  components/{planning,procurement-flow,lifecycle,master-data,user-management}-*.tsx # workspaces
  lib/prisma.ts                         # PrismaClient singleton (lazy init)
  lib/utils.ts                          # cn() + formatCurrency()
  lib/{auth,seed,csv,excel-import,pdf-report,procurement-flow,users,...} # domain/logic
  prisma/schema.prisma                  # LIVE SQLite schema (what the app uses)
  prisma/dev.db                         # local SQLite data
  prisma/phase2.prisma                  # Phase-2 MySQL design (NOT applied to any DB)
  backend/                              # separate Fastify + RSA-JWT service (needs config, not on a DB)
  docs/                                 # 13 design docs - READ the relevant one before changing a module
  scripts/ + public/sw.js               # offline static export + Service Worker

## CRITICAL - Asset field names (do NOT invent others)
  id, hospitalId, wardId, receiptId?, assetNo, name, status(ENUM), version, needsReview, cost
  status enum: AVAILABLE | IN_USE | REPAIR | QUARANTINED | DISPOSED
  user.role enum (UserRole): ADMIN | WAREHOUSE | WARD | AUDITOR
  wrong -> right: assetName->name, assetNumber->assetNo, department->wardId, unitPrice->cost

## AUTH (important - verified this session)
  - POST /api/auth { staffCode, password } -> sets session cookie; 401 on bad creds.
  - staffCode is .toUpperCase() on the SERVER before lookup: "admin" == "ADMIN".
  - Roles: ADMIN (all), WAREHOUSE (all assets), WARD (only wards in user.wards), AUDITOR (read-only).
  - Seeded: ADMIN (pw admin, standard) + 12345/WARE-01/WARD-01/AUDIT-01 (pw uth12345).
    Roles: ADMIN/WAREHOUSE/WARD/AUDITOR (see lib/seed.ts + scripts/seed-uth-users.mjs).
  - Every login attempt is written to UserLoginLog.

## Feature status (honest)
  DONE (on SQLite, wired to app): Dashboard+charts, Asset CRUD, Login+RBAC, user management,
      asset numbering, CSV import (client-side: lib/csv.mjs + excel-import.ts), PDF export (assets),
      system log, regulatory baseline, planning/procurement/finance/accounting/legal workspaces.
  DESIGN-ONLY (not on any DB): prisma/phase2.prisma (MySQL 15-step), backend/ (RSA-JWT service).
  TODO: Multi-hospital (hospitalId is single "UTH"), AI Assistant (Ollama), real-MySQL
      transaction/rollback/concurrency/trigger tests, real device / HOSxP / e-GP integration, OCR/RFID.

## Conventions
  - Button variant: only default | secondary | ghost  (NO "outline")
  - Currency: formatCurrency() from lib/utils.ts
  - Components: named export AND export default (some files import both ways)
  - crypto.randomUUID(): add a fallback polyfill in browser HTTP context
  - After editing prisma/schema.prisma: run npx prisma generate
  - Read the matching docs/ file before changing a module

## Repo notes
  - prisma/dev.db is COMMITTED as a binary (SQLite data lives in git) - KEEP it
    committed: the datasource path is the same absolute path on local + DGX, so
    this is how seeded test data syncs via git push/pull. Do NOT gitignore it.
  - Seed helpers (run from repo root): `node scripts/seed-uth-users.mjs` (4 role
    accounts) and `node scripts/set-admin.mjs` (creates ADMIN/admin).
  - Seeded logins in dev.db (staffCode / password -> role):
      ADMIN   / admin     -> ADMIN      (standard admin login; set-admin.mjs)
      12345   / uth12345  -> ADMIN      (seed-uth-users.mjs)
      WARE-01 / uth12345  -> WAREHOUSE  (seed-uth-users.mjs)
      WARD-01 / uth12345  -> WARD       (seed-uth-users.mjs)
      AUDIT-01/ uth12345  -> AUDITOR    (seed-uth-users.mjs)
