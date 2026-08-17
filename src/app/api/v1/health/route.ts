export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      version: "v1",
      service: "codeforge-compilation-api",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
