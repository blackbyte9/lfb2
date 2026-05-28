import assert from "node:assert/strict";

export function ensureTestEnv() {
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET ??= "test-secret";
  process.env.POSTGRES_PRISMA_URL ??= "postgresql://user:pass@localhost:5432/lfb2_test";
}

export async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  assert.ok(contentType.includes("application/json"), `Expected JSON response, got ${contentType}`);
  return response.json();
}

export function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}
