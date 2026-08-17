import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { createApiKey, type ApiScope } from "@/lib/codeforge/api-keys";
import { getAuthenticatedUser } from "@/lib/codeforge/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in to view API keys." } }, { status: 401 });
  }

  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));

  const safeKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    displayKey: `${k.keyPrefix}${"*".repeat(20)}`,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
  }));

  return Response.json({ apiKeys: safeKeys });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in to generate API keys." } }, { status: 401 });
  }

  let body: { name?: string; scopes?: ApiScope[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_request", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { name, scopes } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: { code: "invalid_name", message: "API key name is required." } }, { status: 400 });
  }

  const keyResult = await createApiKey(user.id, name, scopes);

  // Return full raw key once at creation
  return Response.json(
    {
      apiKey: {
        id: keyResult.keyId,
        name: keyResult.name,
        rawKey: keyResult.rawKey, // Only shown once!
        keyPrefix: keyResult.keyPrefix,
        scopes: keyResult.scopes,
        expiresAt: keyResult.expiresAt ? keyResult.expiresAt.toISOString() : null,
      },
    },
    { status: 201 },
  );
}
