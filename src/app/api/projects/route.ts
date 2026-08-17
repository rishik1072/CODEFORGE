import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds, projects } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/codeforge/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in to view projects." } }, { status: 401 });
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  // Count builds per project
  const projectList = await Promise.all(
    userProjects.map(async (p) => {
      const projectBuilds = await db
        .select()
        .from(builds)
        .where(and(eq(builds.projectId, p.id), eq(builds.userId, user.id)))
        .orderBy(desc(builds.createdAt))
        .limit(1);

      const allBuilds = await db
        .select()
        .from(builds)
        .where(and(eq(builds.projectId, p.id), eq(builds.userId, user.id)));

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        defaultLanguage: p.defaultLanguage,
        buildCount: allBuilds.length,
        lastBuildAt: projectBuilds[0]?.createdAt.toISOString() || null,
        lastBuildStatus: projectBuilds[0]?.status || null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
  );

  return Response.json({ projects: projectList });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in to create a project." } }, { status: 401 });
  }

  let body: { name?: string; description?: string; defaultLanguage?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_request", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { name, description, defaultLanguage } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: { code: "invalid_name", message: "Project name is required." } }, { status: 400 });
  }

  const cleanName = name.trim();
  if (cleanName.length > 100) {
    return Response.json({ error: { code: "name_too_long", message: "Project name must be 100 characters or less." } }, { status: 400 });
  }

  const cleanDesc = typeof description === "string" ? description.trim().slice(0, 500) : null;
  const lang = defaultLanguage === "c" || defaultLanguage === "rust" ? defaultLanguage : "cpp";

  const projectId = randomUUID();
  const now = new Date();

  await db.insert(projects).values({
    id: projectId,
    userId: user.id,
    name: cleanName,
    description: cleanDesc,
    defaultLanguage: lang,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json(
    {
      project: {
        id: projectId,
        name: cleanName,
        description: cleanDesc,
        defaultLanguage: lang,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
    { status: 201 },
  );
}
