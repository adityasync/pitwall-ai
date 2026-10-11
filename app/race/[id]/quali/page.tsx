import { Suspense } from "react";
import { QualiClient } from "./quali-client";

async function staticIds() {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(process.cwd(), "public", "data", "index.json"), "utf-8");
    const idx = JSON.parse(raw) as { races: { id: string }[] };
    return idx.races.map((r) => ({ id: r.id }));
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return staticIds();
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
          <p className="text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QualiClient raceId={id} />;
}
