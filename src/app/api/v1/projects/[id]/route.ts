import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds, projects } from "@/db/schema";
import { authenticateApiKey } from "@/lib/codeforge/api-keys";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authenticateApiKey(request, "project:read");
  if (!auth) {
    return Response.json(
      { error: { code: "unauthorized", message: "Valid API key with 'project:read' scope required." } },
      { status: 401 },
    );
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, auth.user.id)))
    .limit(1);

  if (!project) {
    return Response.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  const projectBuilds = await db
    .select()
    .from(builds)
    .where(and(eq(builds.projectId, id), eq(builds.userId, auth.user.id)))
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
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authenticateApiKey(request, "project:write");
  if (!auth) {
    return Response.json(
      { error: { code: "unauthorized", message: "Valid API key with 'project:write' scope required." } },
      { status: 401 },
    );
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, auth.user.id)))
    .limit(1);

  if (!project) {
    return Response.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, auth.user.id)));

  return Response.json({ success: true, message: "Project deleted." });
}
