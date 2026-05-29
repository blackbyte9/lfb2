# LFB2

LFB2 ist eine Schulbibliotheks-Anwendung für Bücher, physische Items und Schülerdaten.

Sie verbindet rollenbasierte Zugriffe, Leih- und Rückgabe-Workflows, zentrale Importfunktionen, Datenqualitäts-Tools und eine übersichtliche Historie pro Schüler und Schuljahr.

## Technologie

- Next.js 16 mit App Router
- React 19 und TypeScript
- Tailwind CSS 4
- shadcn/ui und eigene UI-Komponenten
- Prisma ORM 7
- Neon Postgres
- ESLint und Prettier
- Node Test Runner mit `tsx`
- Playwright für Browser-Tests

## Aktuelle Implementierung

### Rollen und Zugriff

- Rollen: `GUEST`, `USER`, `ADMIN`
- Gäste und anonyme Nutzer dürfen Bücher und Items nur lesend nutzen, inklusive Verfügbarkeitsinformationen.
- Schülerfunktionen sind für `USER` und `ADMIN` verfügbar.
- Die Verwaltungsseite ist ausschließlich für `ADMIN` sichtbar.
- Benutzerverwaltung und Gefahrenbereich sind nur in der Verwaltung verfügbar.
- Importe und Namenskorrekturen liegen zentral unter **Verwaltung -> Importe**.

### Bücher

- Bücherliste mit Pagination und Sortierung nach `ISBN`, `Titel`, `Verfügbar`, `Ausgeliehen`
- `Verfügbar` zählt aktive Items ohne aktive Ausleihe
- `Ausgeliehen` zählt aktive Items mit aktiver Ausleihe
- Die Buchliste ist öffentlich lesbar
- Buch anlegen, bearbeiten und löschen ist für `USER` und `ADMIN` möglich
- Suche per Item-ID aus der Buchliste zur passenden Buchdetailseite

### Items

- Item-Verwaltung auf der Buchdetailseite
- Items per ID/Barcode anlegen
- Statuswechsel für `NEW`, `USED`, `DAMAGED`, `REMOVED`
- Entfernte Items werden in den Listen und Zählungen ignoriert
- Sortierung nach ID, Status und Verfügbarkeit
- Die Spalte `Verfügbarkeit` zeigt `Verfügbar` oder den Namen des ausleihenden Schülers
- Klick auf den Namen eines ausgeliehenen Schülers führt zu dessen Ausleihen
- Der Button `Zurückgeben` setzt die aktive Ausleihe sofort zurück

### Schüler

- Schülerliste mit Sortierung nach Vorname, Nachname, Kurs und Ausgeliehen
- Die Spalte `Ausgeliehen` zeigt die Anzahl aktiver Ausleihen pro Schüler
- Klick auf eine Schülerzeile öffnet den Ausleihe-Workflow mit Vorbelegung der Schüler-ID
- Die Detailseite `/students/[id]/leases` zeigt alle aktiven Ausleihen des Schülers
- In der Detailansicht werden Buchtitel, ISBN, Item-ID und Ausleihdatum angezeigt
- Schülersuche nach Name, alter ID, Kurs oder Status
- Bearbeiten von ID, Vorname, Nachname, Kurs und Status
- Unterstützte Status: `ACTIVE`, `INACTIVE`, `SPECIAL`
- Pro Schüler gibt es eine Historie der Jahrgangsdaten

### Ausleihe und Rückgabe

- Die Navigation enthält die Workflows **Ausleihe** und **Rückgabe**
- Der Ausleihe-Workflow startet mit einer Schülerauswahl per Suche
- Aus der Schülerliste kann direkt in den Ausleihe-Workflow gesprungen werden
- Das Item-Eingabefeld wird erst nach Auswahl eines Schülers aktiviert
- Gültige Item-IDs lösen sofort eine neue Ausleihe für den gewählten Schüler aus
- Die aktive Ausleihliste des gewählten Schülers wird direkt darunter angezeigt

### Importe und Datenqualität

- Alle Import-Workflows sind in **Verwaltung -> Importe** gebündelt
- JSON-Importe für Bücher, Items, Schüler und Leihen
- WiB-CSV-Import für Schüler
- Namenskorrekturen mit Vorschau, Auswahl, Ablehnung und manueller Bearbeitung
- Schuljahresfeld für Schülerimporte
- Der Gefahrenbereich kann alle Anwendungsdaten außer Benutzern löschen
- Schuljahr wird als Import-Metadatum verwendet und nicht als Tabellenfilter
- Die Jahrgangshistorie landet in `StudentGradeHistory`

### Wiederverwendung

- Gemeinsamer Upload-Hook: `src/lib/useFileUpload.ts`
- Gemeinsame Import-Route-Hülle: `src/lib/import-route.ts`
- Gemeinsame Sortier-Button-Komponente
- Gemeinsame Komponenten für bearbeitbare Tabellenzeilen

## Datenmodell

Wichtige Prisma-Entitäten:

- `Book`
- `Item` und `ItemStatus`
- `Student` und `StudentStatus`
- `StudentGradeHistory`
- `Lease`
- Auth-Entitäten (`User`, `Session`, `Account`, `Verification`)

Das vollständige Schema steht in `prisma/schema.prisma`.

## Einrichtung

### Voraussetzungen

- Node.js 22+
- npm 11+
- `.env.local` mit Datenbank- und Auth-Variablen

### Installation

```bash
npm install
```

### Umgebung

Benötigte Prisma-Variablen:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

Wenn nötig, kannst du die Werte aus Vercel ziehen:

```bash
vercel env pull .env.local
```

## Befehle

### Anwendung

```bash
npm run dev
npm run build
npm run start
```

### Qualität

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

## Tests und CI

- Lokale Tests: `npm run test`
- Browser-Tests mit Playwright:
  - Browser einmalig installieren: `npm run test:e2e:install`
  - E2E-Suite ausführen: `npm run test:e2e`
- Die Tests liegen jetzt im Verzeichnis `test/`
- Automatisch abgesicherte Bereiche:
  - Rollen- und Zugriffshilfen
  - geschützte API-Routen
  - Import- und Parserlogik
  - Namenskorrektur-Logik
  - Browser-Flows für Schülernavigation, Item-Schüler-Navigation und sofortige Rückgabe
- GitHub Actions läuft bei Push und Pull Requests auf `main` und prüft:
  - Lint
  - Tests
  - Build

Workflow-Datei:

- `.github/workflows/ci-main.yml`

## Import-Richtlinie

- Importe laufen über UI-Dateiauswahl.
- Aktive Anwendungsrouten verwenden keine festen lokalen Dateipfade.

## Relevante Struktur

```text
lfb2/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      admin/
      books/
      lease/
      return/
      students/
      api/
    components/
      admin/
      books/
      leases/
      returns/
      students/
      ui/
    lib/
      prisma.ts
      import-route.ts
      useFileUpload.ts
      students-access.ts
  test/
    src/
    e2e/
  .github/workflows/
    ci-main.yml
```
