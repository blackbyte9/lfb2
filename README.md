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

- List books with pagination and sorting (`ISBN`, `Titel`, `Items` count)
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
- Sort items by ID and status
- Import items from uploaded JSON
- Import items from fixed default file path
- Tolerant import parsing with skipped-line issue reporting

### Students

- Students table with sorting (`Vorname`, `Nachname`, `Kurs`)
- Search field for students (name, old ID, course, status)
- Student row edit action (ID, first name, last name, course, status)
- Status management: `ACTIVE`, `INACTIVE`, `SPECIAL`
- Grade history modal per student
- Role-protected students access (USER/ADMIN)

### Student Imports & Data Quality

- JSON import via file picker
- WiB CSV import via file picker
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
- Current automated regression includes students access rule test
- GitHub Actions workflow runs on push/PR to `main`:
  - lint
  - test
  - build

Workflow file:

- `.github/workflows/ci-main.yml`

## Important Import Paths

- Students default JSON source (legacy route): `C:\Programming\sbm5\data\students.json`
- WiB annual CSV source example: `Z:\Dokumente\Birgit\Birgit_Schule\2024\WiB_Export.csv`
- Items default source: `C:\Programming\sbm5\data\items.json`

Note: UI import flow uses file pickers for active workflows.

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
      api/
        books/
        items/
        students/
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
