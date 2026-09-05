import { randomUUID } from "node:crypto";
import type {
  ImportAccountType,
  ImportCandidate,
} from "@/lib/finance/import-service";

/**
 * In-memory preview cache for the two-step MCP import flow.
 *
 * A preview parses, dedups, and category-suggests a whole file (expensive),
 * then hands the caller back a token. Apply looks the token up and inserts
 * only the accepted rowIds. The cache is per-process (stdio MCP is a single
 * long-lived per-user process), tokens are TTL-bounded, and each entry can
 * only be consumed by the user who produced it.
 */

export interface ImportPreviewEntry {
  userId: string;
  accountId: string;
  accountType: ImportAccountType;
  candidates: ImportCandidate[];
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 32;
const store = new Map<string, ImportPreviewEntry>();

function purgeExpired(now: number) {
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}

export function storeImportPreview(
  entry: Omit<ImportPreviewEntry, "createdAt" | "expiresAt">
): { token: string; expiresAt: number } {
  const now = Date.now();
  purgeExpired(now);
  if (store.size >= MAX_ENTRIES) {
    // Evict the oldest entry to keep the process bounded.
    let oldestToken: string | undefined;
    let oldestAt = Infinity;
    for (const [token, item] of store) {
      if (item.createdAt < oldestAt) {
        oldestAt = item.createdAt;
        oldestToken = token;
      }
    }
    if (oldestToken) store.delete(oldestToken);
  }
  const token = randomUUID();
  const expiresAt = now + TTL_MS;
  store.set(token, { ...entry, createdAt: now, expiresAt });
  return { token, expiresAt };
}

export function readImportPreview(
  token: string,
  userId: string
): ImportPreviewEntry {
  const now = Date.now();
  purgeExpired(now);
  const entry = store.get(token);
  if (!entry) {
    throw new Error(
      "Import preview token not found or expired. Rerun finance_import_preview."
    );
  }
  if (entry.userId !== userId) {
    // Never leak whose token it is; treat mismatch as not-found.
    throw new Error(
      "Import preview token not found or expired. Rerun finance_import_preview."
    );
  }
  return entry;
}

export function consumeImportPreview(token: string): void {
  store.delete(token);
}

/** For tests only. */
export function __clearImportPreviewCache(): void {
  store.clear();
}
