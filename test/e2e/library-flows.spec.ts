import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type FixtureData = {
  username: string;
  password: string;
  email: string;
  name: string;
  userId: string;
  studentId: number;
  studentLabel: string;
  studentIdOld: string;
  bookId: number;
  bookName: string;
  itemId: string;
  leaseId: number;
};

type UserRole = "USER" | "ADMIN";

function loadDotenvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotenvFile(resolve(process.cwd(), ".env.local"));

const connectionString = process.env.POSTGRES_PRISMA_URL;
if (!connectionString) {
  throw new Error("POSTGRES_PRISMA_URL is required for E2E tests");
}

const pool = new Pool({ connectionString });

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function register(page: Page, fixture: FixtureData) {
  await page.goto("/register");
  await page.locator('input[name="name"]').fill(fixture.name);
  await page.locator('input[name="email"]').fill(fixture.email);
  await page.locator('input[name="username"]').fill(fixture.username);
  await page.locator('input[name="password"]').fill(fixture.password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await page.waitForURL("**/");
}

async function login(page: Page, fixture: FixtureData) {
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(fixture.username);
  await page.locator('input[name="password"]').fill(fixture.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("**/");
}

async function logout(page: Page) {
  await page.context().clearCookies();
  await page.goto("/");
}

async function makeUserAndFixture(page: Page, role: UserRole = "USER"): Promise<FixtureData> {
  const suffix = randomSuffix();
  const usernameToken = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const fixture: FixtureData = {
    username: usernameToken.slice(0, 24),
    password: "Passw0rd123!",
    email: `${usernameToken.slice(0, 24)}@example.com`,
    name: `E2E User ${suffix}`,
    userId: "",
    studentId: 0,
    studentLabel: "",
    studentIdOld: `S-${suffix}`,
    bookId: 0,
    bookName: `E2E Book ${suffix}`,
    itemId: `RSV-${suffix}`.toUpperCase().slice(0, 20),
    leaseId: 0,
  };

  await register(page, fixture);

  const createdUserResult = await pool.query<{ id: string }>(
    'select id from "User" where username = $1',
    [fixture.username],
  );

  const createdUser = createdUserResult.rows[0];
  if (!createdUser?.id) {
    throw new Error("Registered user was not found in DB");
  }

  fixture.userId = createdUser.id;
  await pool.query('update "User" set role = $1 where id = $2', [role, fixture.userId]);

  const studentResult = await pool.query<{ id: number; firstname: string; lastname: string }>(
    'insert into "Student" ("idOld", firstname, lastname, course, status, "createdAt", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7) returning id, firstname, lastname',
    [fixture.studentIdOld, "Anna", `Meyer${suffix.slice(-4)}`, "10A", "ACTIVE", new Date(), new Date()],
  );
  const student = studentResult.rows[0];
  if (!student) {
    throw new Error("Student fixture could not be created");
  }

  fixture.studentId = student.id;
  fixture.studentLabel = `${student.lastname}, ${student.firstname}`;

  const bookResult = await pool.query<{ id: number }>(
    'insert into "Book" (isbn, name, "createdAt", "updatedAt") values ($1, $2, $3, $4) returning id',
    [`978-${suffix.slice(0, 10)}`, fixture.bookName, new Date(), new Date()],
  );
  const book = bookResult.rows[0];
  if (!book) {
    throw new Error("Book fixture could not be created");
  }
  fixture.bookId = book.id;

  await pool.query(
    'insert into "Item" (id, status, "bookId", "createdAt", "updatedAt") values ($1, $2, $3, $4, $5)',
    [fixture.itemId, "NEW", fixture.bookId, new Date(), new Date()],
  );

  const leaseResult = await pool.query<{ id: number }>(
    'insert into "Lease" ("leasedAt", "returnedAt", active, "studentId", "itemId", "createdAt", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7) returning id',
    [new Date(), null, true, fixture.studentId, fixture.itemId, new Date(), new Date()],
  );
  const lease = leaseResult.rows[0];
  if (!lease) {
    throw new Error("Lease fixture could not be created");
  }
  fixture.leaseId = lease.id;

  await logout(page);
  await login(page, fixture);

  return fixture;
}

async function cleanupFixture(fixture: FixtureData | null) {
  if (!fixture) {
    return;
  }

  try {
    await pool.query('delete from "Lease" where id = $1 or "itemId" = $2', [fixture.leaseId, fixture.itemId]);
    await pool.query('delete from "Item" where id = $1', [fixture.itemId]);
    await pool.query('delete from "Book" where id = $1', [fixture.bookId]);
    await pool.query('delete from "Student" where id = $1', [fixture.studentId]);
    await pool.query('delete from "User" where id = $1', [fixture.userId]);
  } catch {
    // Keep cleanup best-effort so one failed step does not mask the test assertion failure.
  }
}

test("students row click opens lease workflow", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page);

    await page.goto("/students");
    await page.locator('input[placeholder="Name, alte ID, Kurs oder Status"]').fill(fixture.studentIdOld);
    const idCell = page.getByRole("cell", { name: fixture.studentIdOld });
    await expect(idCell).toBeVisible({ timeout: 10_000 });
    await idCell.click();

    await expect(page).toHaveURL(new RegExp(`/lease\\?studentId=${fixture.studentId}$`));
    await expect(page.getByRole("heading", { name: "Ausleihe" })).toBeVisible();
    await expect(page.getByText(fixture.bookName)).toBeVisible();
    await expect(page.getByText(fixture.itemId)).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
  }
});

test("books and items are publicly readable with availability information", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page);
    await logout(page);

    await page.goto("/books");
    await expect(page.getByRole("heading", { name: "Bücher" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Buch hinzufügen" })).toHaveCount(0);

    const booksResponse = await page.request.get("/api/books");
    expect(booksResponse.ok()).toBeTruthy();
    const booksData = (await booksResponse.json()) as Array<{ id: number; name: string; itemCount: number; leasedCount: number }>;
    const listedBook = booksData.find((book) => book.id === fixture.bookId);
    expect(listedBook?.name).toBe(fixture.bookName);
    expect(listedBook?.itemCount).toBe(1);

    await page.goto(`/books/${fixture.bookId}`);
    await expect(page.getByRole("heading", { name: "Buch-Items" })).toBeVisible();
    await expect(page.getByRole("button", { name: fixture.studentLabel })).toBeVisible();
    await expect(page.getByRole("button", { name: "Item anlegen" })).toHaveCount(0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("guest cannot access student or admin areas", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page);
    await logout(page);

    await page.goto("/students");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/lease");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/return");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("admin can access student workflows", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page, "ADMIN");

    await page.goto("/students");
    await expect(page.getByRole("heading", { name: "Schüler" })).toBeVisible();

    await page.goto("/lease");
    await expect(page.getByRole("heading", { name: "Ausleihe" })).toBeVisible();

    await page.goto("/return");
    await expect(page.getByRole("heading", { name: "Rückgabe" })).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
  }
});

test("admin can see danger zone and user management", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page, "ADMIN");

    await page.goto("/admin?tab=imports");
    await expect(page.getByRole("heading", { name: "Verwaltung" })).toBeVisible();
    await expect(page.getByText("Gefahrenbereich")).toBeVisible();
    await expect(page.getByRole("button", { name: "Alle Daten löschen" })).toBeVisible();

    await page.goto("/admin?tab=users");
    await expect(page.getByRole("link", { name: "Benutzer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Löschen" }).first()).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
  }
});

test("clicking leased student name in items opens student leases page", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page);

    await page.goto(`/books/${fixture.bookId}`);
    const row = page.locator("tr", { hasText: fixture.itemId });
    const studentButton = row.getByRole("button", { name: fixture.studentLabel });
    await expect(studentButton).toBeVisible();
    await studentButton.click();

    await expect(page).toHaveURL(new RegExp(`/students/${fixture.studentId}/leases$`));
    await expect(page.getByText(fixture.bookName)).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
  }
});

test("return button immediately marks item as available", async ({ page }) => {
  let fixture: FixtureData | null = null;
  try {
    fixture = await makeUserAndFixture(page);

    await page.goto(`/books/${fixture.bookId}`);

    const row = page.locator("tr", { hasText: fixture.itemId });
    await expect(row.getByRole("button", { name: "Zurückgeben" })).toBeVisible();
    await row.getByRole("button", { name: "Zurückgeben" }).click();

    await expect(page.getByText(`Item ${fixture.itemId} wurde zurückgegeben`)).toBeVisible();

    await page.goto(`/books/${fixture.bookId}`);
    const refreshedRow = page.locator("tr", { hasText: fixture.itemId });
    await expect(refreshedRow.getByText("Verfügbar")).toBeVisible();
    await expect(refreshedRow.getByRole("button", { name: "Zurückgeben" })).toHaveCount(0);

    const booksResponse = await page.request.get("/api/books");
    expect(booksResponse.ok()).toBeTruthy();
    const booksData = (await booksResponse.json()) as Array<{ id: number; itemCount: number; leasedCount: number }>;
    const updatedBook = booksData.find((book) => book.id === fixture.bookId);
    expect(updatedBook).toBeTruthy();
    expect(updatedBook?.itemCount).toBe(1);
    expect(updatedBook?.leasedCount).toBe(0);
  } finally {
    await cleanupFixture(fixture);
  }
});
