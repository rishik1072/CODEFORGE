import { CodeForgeApp } from "@/components/codeforge/CodeForgeApp";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <CodeForgeApp />
    </main>
  );
}
