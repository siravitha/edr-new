# AGENTS.md - UTH Smart Assets (edr-new)

Context for AI coding agents (Cline / Continue / Cursor / Copilot).
Full detail: read .continue/rules/project-context.md

## What this is
Hospital Asset Management system ("UTH Smart Assets") built with
Next.js 16 (App Router) + React 19 + TypeScript + Prisma (SQLite) + Tailwind + Recharts.

## Commands
  npm run dev          # dev server
  npm run build        # production build (webpack + offline bundle)
  npm test             # node --test tests/*.test.mjs
  npx prisma generate  # regenerate client after schema changes

## Repo layout
  app/page.tsx                         # main tabbed UI
  app/api/assets/route.ts              # GET list (search/filter/paginate) + POST create
  app/api/assets/[id]/route.ts         # GET / PUT / DELETE single asset
  app/api/dashboard/route.ts           # dashboard KPI + chart data
  components/asset-catalog-workspace.tsx   # asset table + CRUD modal (CURRENT FOCUS)
  components/executive-dashboard.tsx       # dashboard + Recharts
  lib/prisma.ts                          # PrismaClient singleton
  lib/utils.ts                           # cn(), formatCurrency()
  prisma/schema.prisma                   # Prisma schema (SQLite)
  prisma/dev.db                          # local SQLite data

## CRITICAL - Asset field names (do NOT invent others)
  id, hospitalId, wardId, receiptId?, assetNo, name, status(ENUM), version, needsReview, cost
  status enum: AVAILABLE | IN_USE | REPAIR | QUARANTINED | DISPOSED
  wrong -> right: assetName->name, assetNumber->assetNo, department->wardId, unitPrice->cost

## Current status
  DONE:  Feature 1 Executive Dashboard + Charts
  DONE:  Feature 2 Asset CRUD (API + UI)
  NEXT:  Feature 3 Search + Filter + Pagination UI  (in components/asset-catalog-workspace.tsx)
  TODO:  4 PDF export, 5 Login+RBAC, 6 Approval workflow, 7 Excel import,
         8 Multi-hospital, 9 Mobile, 10 AI assistant (Ollama)

## Conventions
  - Button variant: only default | secondary | ghost (no "outline")
  - Currency: formatCurrency() from lib/utils.ts
  - crypto.randomUUID(): add a fallback polyfill (browser HTTP context)
  - Components: named export + default export
  - Verify by running the relevant code and/or npm test
