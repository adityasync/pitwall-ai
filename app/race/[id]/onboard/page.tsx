import { Suspense } from "react";
import { StateCard } from "@/components/StateCard";
import { OnboardClient } from "./onboard-client";

export async function generateStaticParams() {
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

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-10">
          <StateCard kind="loading" title="Loading onboard" text="Warming up telemetry…" progress={60} />
        </main>
      }
    >
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OnboardClient raceId={id} />;
}
