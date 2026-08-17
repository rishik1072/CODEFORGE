import { destroySession, getAuthenticatedUser } from "@/lib/codeforge/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ user: null }, { status: 200 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
  });
}

export async function POST() {
  await destroySession();
  return Response.json({ success: true, message: "Logged out successfully." }, { status: 200 });
}
