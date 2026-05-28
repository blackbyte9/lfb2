# LFB2

Lehrmittel Bibliothek web app built with Next.js, Prisma, and Neon Postgres.

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui with Base UI primitives
- Prisma ORM 7
- Neon Postgres
- ESLint + Prettier
- Vercel Analytics + Vercel Speed Insights

## Prerequisites

- Node.js 22+
- npm 11+
- A populated `.env.local` (pulled from Vercel)

## Environment Variables

Database access is configured from `.env.local`.

Required variables used by Prisma setup:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

If needed, pull env vars from Vercel:

```bash
vercel env pull .env.local
```

## Installation

```bash
npm install
```

## Useful Commands

### App

```bash
npm run dev           # Start local dev server
npm run build         # Production build
npm run start         # Run production build locally
```

### Code Quality

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Format with Prettier
npm run format:check  # Check formatting without writing
```

### Prisma

```bash
npx prisma generate   # Generate Prisma client
npx prisma db push    # Sync schema to database (non-migration workflow)
npx prisma db seed    # Run seed script (prisma/seed.ts)
npx prisma db pull    # Introspect existing database schema
```

Migration workflow (when using local migration history):

```bash
npx prisma migrate dev --name <migration_name>
```

## Database Seed

Seed script:

- `prisma/seed.ts`

Current sample seed data includes rows for table `test`.

Run seed:

```bash
npx prisma db seed
```

## API Sample

Example DB-backed API route:

- `GET /api/test`
- Source: `src/app/api/test/route.ts`

## Project Structure

```text
lfb2/
 prisma/
  schema.prisma         # Prisma models
  seed.ts               # Seed script
 src/
  app/
   api/test/route.ts   # Sample API route (Prisma read)
   layout.tsx          # App shell (header/footer, Vercel insights)
   page.tsx            # Home page
  components/
   layout/             # Reusable layout components
   ui/                 # shadcn/Base UI components
  lib/
   prisma.ts           # Prisma client singleton
 prisma.config.ts        # Prisma 7 config (env, datasource, seed)
 .env.local              # Local environment variables (ignored)
```

## Deployment

This project is connected to Vercel.

For local parity with deployed environment variables:

```bash
vercel env pull .env.local
```
