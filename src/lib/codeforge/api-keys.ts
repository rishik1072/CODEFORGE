import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users, type ApiKeyRow, type UserRow } from "@/db/schema";

export const ALL_API_SCOPES = [
  "build:read",
  "build:create",
  "build:cancel",
  "project:read",
  "project:write",
] as const;

export type ApiScope = (typeof ALL_API_SCOPES)[number];

export interface GeneratedApiKey {
  keyId: string;
  rawKey: string;
  keyPrefix: string;
  name: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generates a secure random API key of format: cf_live_<32-hex-chars>
 */
export async function createApiKey(
  userId: string,
  name: string,
  scopes: ApiScope[] = ["build:read", "build:create", "build:cancel", "project:read", "project:write"],
  expiresAt: Date | null = null,
): Promise<GeneratedApiKey> {
  const randomPart = randomBytes(24).toString("hex");
  const rawKey = `cf_live_${randomPart}`;
  const keyPrefix = rawKey.slice(0, 16);
  const keyHash = hashApiKey(rawKey);
  const keyId = `key_${randomBytes(12).toString("hex")}`;

  await db.insert(apiKeys).values({
    id: keyId,
    userId,
    name: name.trim(),
    keyPrefix,
    keyHash,
    scopes,
    expiresAt,
  });

  return {
    keyId,
    rawKey,
    keyPrefix,
    name: name.trim(),
    scopes,
    expiresAt,
  };
}

export interface ApiAuthResult {
  user: UserRow;
  apiKey: ApiKeyRow;
  scopes: string[];
}

/**
 * Authenticates a request via Authorization: Bearer <API_KEY> header.
 */
export async function authenticateApiKey(request: Request, requiredScope?: ApiScope): Promise<ApiAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("cf_live_")) {
    return null;
  }

  const keyPrefix = rawKey.slice(0, 16);
  const computedHash = hashApiKey(rawKey);

  const [keyRow] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, keyPrefix), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!keyRow) {
    return null;
  }

  // Verify expiration
  if (keyRow.expiresAt && keyRow.expiresAt.getTime() < Date.now()) {
    return null;
  }

  // Constant-time hash verification
  const computedBuffer = Buffer.from(computedHash, "hex");
  const storedBuffer = Buffer.from(keyRow.keyHash, "hex");
  if (computedBuffer.length !== storedBuffer.length || !timingSafeEqual(computedBuffer, storedBuffer)) {
    return null;
  }

  const scopes = (keyRow.scopes as string[]) || [];
  if (requiredScope && !scopes.includes(requiredScope)) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, keyRow.userId)).limit(1);
  if (!user) {
    return null;
  }

  // Update last_used_at asynchronously
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRow.id))
    .catch(() => undefined);

  return {
    user,
    apiKey: keyRow,
    scopes,
  };
}
