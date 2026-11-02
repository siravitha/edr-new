# UTH Smart Assets - Project Context

> Hospital Asset Management system ("UTH Smart Assets").
> Read this file first before working on any feature.

## Tech Stack
- Framework: Next.js 16.4.3 (App Router) + React 19
- Language: TypeScript (frontend + API routes) / JavaScript .mjs (some domain libs)
- DB: SQLite via Prisma ORM v6 - file: prisma/dev.db
- Styling: Tailwind CSS 4
- Charts: Recharts v3
- UI primitives: components/ui/ (button, card, etc) - Radix slot + CVA
- Testing: node --test  (npm test -> node --test tests/*.test.mjs)
- PM: npm

## Run / Verify
    npm run dev          # dev server (hostname 127.0.0.1)
    npm run build        # next build --webpack + offline bundle
    npm test             # node --test
    npx prisma generate  # after editing prisma/schema.prisma
- REAL SERVER: DGX Spark at http://192.168.1.224:3001  (view results in browser)
- WORKFLOW: edit -> git push -> (DGX) git pull -> dev server HMR reload -> check browser

## Key Files
| File | Role |
|------|------|
| app/page.tsx | Main page, tabbed interface, tab menu |
| app/api/assets/route.ts | Asset list (GET: search+filter+pagination) + create (POST) |
| app/api/assets/[id]/route.ts | Asset single GET / PUT (update) / DELETE |
| app/api/dashboard/route.ts | Dashboard KPIs + chart data |
| components/asset-catalog-workspace.tsx | Asset table UI + CRUD modal |
| components/executive-dashboard.tsx | Dashboard + charts (Recharts) |
| lib/prisma.ts | PrismaClient singleton (lazy init) |
| lib/utils.ts | cn() + formatCurrency() |
| prisma/schema.prisma | Prisma schema |
| lib/seed.ts | Seed test data |

## SCHEMA - Asset (use these EXACT field names)
    model Asset {
      id          String @id @default(uuid())
      hospitalId  String
      wardId      String          // NOT "department" / NOT "location"
      receiptId   String?         // optional FK -> ReceiptLine
      assetNo     String          // NOT "assetNumber"
      name        String          // NOT "assetName"
      status      AssetStatus @default(AVAILABLE)   // ENUM, NOT free string
      version     Int @default(0)
      needsReview Boolean @default(false)
      cost        Decimal         // NOT "unitPrice"
      receipt     ReceiptLine?    // optional relation
      @@unique([hospitalId, assetNo])
      @@index([hospitalId, wardId, status])
    }
    enum AssetStatus {
      AVAILABLE
      IN_USE
      REPAIR
      QUARANTINED
      DISPOSED
    }

COMMON FIELD MISTAKES TO AVOID:
  assetName    -> use: name
  assetNumber  -> use: assetNo
  department   -> use: wardId
  location     -> use: wardId
  unitPrice    -> use: cost
  status       -> MUST be one of the enum values above

## API Contract
GET /api/assets?page&pageSize&search&status&wardId&hospitalId
  -> { assets: Asset[], total, page, pageSize, totalPages }
  - search : matches assetNo OR name (case-insensitive contains)
  - status : exact enum value
  - default pageSize 25, max 100

POST /api/assets
  body: { hospitalId, wardId?, assetNo, name, cost?, status? }
  -> 201 { asset } | 400 (missing hospitalId/assetNo/name) | 409 (duplicate assetNo)

PUT /api/assets/[id]
  body: { name?, status?, cost?, wardId?, needsReview? }
  -> updates + bumps version + 1

DELETE /api/assets/[id]
  -> deletes asset

## Current Feature Status
| # | Feature | Status |
|---|---------|--------|
| 1 | Executive Dashboard + Charts (Recharts) | DONE |
| 2 | Asset CRUD (register form)            | DONE (API + UI) |
| 3 | Search + Filter + Pagination UI        | NEXT (in progress) |
| 4 | PDF Report Export                      | TODO |
| 5 | Login + RBAC                           | TODO |
| 6 | Approval Workflow (multi-step)         | TODO |
| 7 | Excel Import (drag-drop)               | TODO |
| 8 | Multi-Hospital (multi-tenant)          | TODO |
| 9 | Mobile responsive                      | TODO |
| 10| AI Assistant (DGX Ollama)              | TODO |

## Feature 3 (IN PROGRESS) - Search + Filter + Pagination UI
The API already supports it (GET /api/assets accepts search/status/wardId + pagination).
Finish the UI in components/asset-catalog-workspace.tsx:
  [ ] Debounced search input  -> binds to ?search=
  [ ] Status filter dropdown  -> the 5 enum values
  [ ] Ward filter             -> ?wardId=
  [ ] Full pagination         -> prev/next + page numbers + "showing X-Y of Z"
  [ ] Call /api/assets/ for real and render the response

## Conventions
- Components use named export AND export default (some files import both ways)
- Button variant only supports: default | secondary | ghost  (NO "outline")
- Currency display: use formatCurrency() from lib/utils.ts
- crypto.randomUUID(): always add a fallback polyfill (browser HTTP context)
- After editing prisma/schema.prisma, run: npx prisma generate
