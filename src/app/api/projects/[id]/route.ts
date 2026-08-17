import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds, projects } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/codeforge/auth";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in." } }, { status: 401 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return Response.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const projectBuilds = await db
    .select()
    .from(builds)
    .where(and(eq(builds.projectId, id), eq(builds.userId, user.id)))
    .orderBy(desc(builds.createdAt));

  return Response.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      defaultLanguage: project.defaultLanguage,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      builds: projectBuilds.map(toPublicBuildRecord),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in." } }, { status: 401 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return Response.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, user.id)));

  return Response.json({ success: true, message: "Project and associated builds deleted." });
}
