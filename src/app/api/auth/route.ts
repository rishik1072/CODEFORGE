import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, hashPassword, verifyPassword } from "@/lib/codeforge/auth";

export const dynamic = "force-dynamic";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export async function POST(request: Request) {
  let body: { action?: string; email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_request", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { action, email, password, name } = body;

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: { code: "missing_fields", message: "Email and password are required." } }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!validateEmail(cleanEmail)) {
    return Response.json({ error: { code: "invalid_email", message: "Please provide a valid email address." } }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: { code: "weak_password", message: "Password must be at least 8 characters long." } }, { status: 400 });
  }

  if (action === "signup") {
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) {
      return Response.json({ error: { code: "email_taken", message: "An account with this email already exists." } }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      email: cleanEmail,
      name: typeof name === "string" ? name.trim() : null,
      passwordHash,
    });

    await createSession(userId);

    return Response.json({ user: { id: userId, email: cleanEmail, name: name || null } }, { status: 201 });
  }

  if (action === "login") {
    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user) {
      return Response.json({ error: { code: "invalid_credentials", message: "Invalid email or password." } }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return Response.json({ error: { code: "invalid_credentials", message: "Invalid email or password." } }, { status: 401 });
    }

    await createSession(user.id);

    return Response.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 200 });
  }

  return Response.json({ error: { code: "invalid_action", message: "Action must be either 'login' or 'signup'." } }, { status: 400 });
}
