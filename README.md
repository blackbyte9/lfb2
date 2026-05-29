# LFB2

LFB2 is a school library management app for books, physical items, and students.

It includes role-based access control, import workflows for multiple formats, data quality tooling (name-fix preview/apply), and student timeline tracking by school year.

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui + custom UI components
- Prisma ORM 7
- Neon Postgres
- ESLint + Prettier
- Node test runner (`node --test`) with `tsx`
- GitHub Actions CI

## Requirements Summary (Current)

### Security & Roles

- Roles: `GUEST`, `USER`, `ADMIN`
- Students data is restricted to `USER`/`ADMIN` only:
  - Students page access
  - Students APIs (list/detail operations used by UI)
  - Students navigation link visibility
- Guests can still access books list in read-only mode.

### Books

- List books with pagination and sorting (`ISBN`, `Titel`, `Items`, `Verfügbar`, `Ausgeliehen`)
- **Verfügbar** counter: active items without an active lease
- **Ausgeliehen** counter: active items with an active lease
- All three item-count columns are sortable
- Add, edit, delete books (USER/ADMIN)
- Import books from JSON file picker
- Item count per book excludes removed items
- Item-ID search/jump from books list to the corresponding book detail

### Items

- Manage items in book detail page
- Create item by ID/barcode
- Update item status (`NEW`, `USED`, `DAMAGED`, `REMOVED`)
- Soft-delete items by setting status `REMOVED`
- Item list/read/count logic excludes removed items
- Sort items by ID, status, and availability
- **Verfügbarkeit** column shows `Verfügbar` (green) or the name of the lending student (amber, clickable)
- Clicking a leased item's student name navigates to that student's leases detail page
- **Zurückgeben** button on leased items (USER/ADMIN): marks the active lease as returned immediately
- Import items from uploaded JSON
- Tolerant import parsing with skipped-line issue reporting

### Students

- Students table with sorting (`Vorname`, `Nachname`, `Kurs`, `Ausgeliehen`)
- **Ausgeliehen** column shows count of active leases per student (amber when > 0), sortable
- Clicking a student row navigates to their leases detail page (`/students/[id]/leases`)
- Leases detail page shows all active leases with book title, ISBN, item ID, and leased date
- Book title links back to the corresponding book detail page
- Search field for students (name, old ID, course, status)
- Student row edit action (ID, first name, last name, course, status)
- Status management: `ACTIVE`, `INACTIVE`, `SPECIAL`
- Grade history modal per student
- Role-protected students access (USER/ADMIN)
- Lease import (JSON) to link students and items

### Leases Workflow

- Main navigation includes a dedicated **Ausleihe** workflow entry (USER/ADMIN)
- Workflow starts with student selection via modal (search by name, old ID, class)
- Item scanner/input is enabled only after a student is selected
- Scanning or entering a valid item ID creates a lease immediately for the selected student
- Active leases list for the selected student is shown directly below, including links back to the corresponding book item

### Student Imports & Data Quality

- JSON import via file picker
- WiB CSV import via file picker
- Leases JSON import via file picker (`leased`, `returned`, `active`, `itemId`, `studentId`)
- Import setup modal asks for school year before opening file picker
- School year is import metadata (timeline alignment), not a table filter
- Grade timeline tracking in `StudentGradeHistory` (per student/year/source)
- Name encoding repair workflow:
  - Preview proposed fixes
  - Select/reject individual fixes
  - Edit individual fix proposals manually
  - Apply selected fixes only

### Reusability/Refactor State

- Shared file upload hook: `src/lib/useFileUpload.ts`
- Shared import route wrapper: `src/lib/import-route.ts`
- Shared sort header button component
- Shared editable row action component

## Data Model Summary

Main Prisma entities:

- `Book`
- `Item` (+ `ItemStatus`)
- `Student` (+ `StudentStatus`)
- `StudentGradeHistory`
- `Lease` (student-item lending relation)
- Auth entities (`User`, `Session`, `Account`, `Verification`)

See full schema in `prisma/schema.prisma`.

## Setup

## Prerequisites

- Node.js 22+
- npm 11+
- `.env.local` with database/auth variables

## Installation

```bash
npm install
```

## Environment

Required Prisma-related variables include:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

Pull from Vercel if needed:

```bash
vercel env pull .env.local
```

## Commands

### App

```bash
npm run dev
npm run build
npm run start
```

### Quality

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run test
```

### Prisma

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npx prisma db pull
```

## Testing & CI

- Local tests: `npm run test`
- Browser E2E tests (Playwright):
  - One-time browser install: `npm run test:e2e:install`
  - Run E2E suite: `npm run test:e2e`
- Current automated regressions cover:
  - role/access helpers and protected API behavior
  - import/parser logic (WiB CSV, leases JSON)
  - name-fix proposal logic
  - browser flows for student row navigation, item-student navigation, and immediate return flow
- GitHub Actions workflow runs on push/PR to `main`:
  - lint
  - test
  - build

Workflow file:

- `.github/workflows/ci-main.yml`

## Import Policy

- All imports are performed through UI file selectors.
- No fixed local file path imports are used by active application routes.

## Project Structure (Relevant)

```text
lfb2/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      books/
      students/
        [id]/
          leases/
      api/
        books/
        items/
          [id]/
            return/
        students/
          [id]/
            leases/
    components/
      books/
      students/
      admin/
      ui/
    lib/
      prisma.ts
      import-route.ts
      useFileUpload.ts
      item-import.ts
      student-import.ts
      student-import-wib.ts
      student-name-fixes.ts
      students-access.ts
  .github/workflows/
    ci-main.yml
```
