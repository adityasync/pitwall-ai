import { Suspense } from "react";
import { DriverClient } from "./driver-client";

export async function generateStaticParams() {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(process.cwd(), "public", "data", "index.json"), "utf-8");
    const idx = JSON.parse(raw) as { races: { id: string }[] };
    const out: { id: string; code: string }[] = [];
    for (const r of idx.races) {
      try {
        const d = JSON.parse(
          await readFile(join(process.cwd(), "public", "data", r.id, "drivers.json"), "utf-8")
        ) as { code: string }[];
        for (const drv of d) out.push({ id: r.id, code: drv.code });
      } catch {
        /* skip race */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default function Page({ params }: {
  params: Promise<{ id: string; code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-10">
          <p className="text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <DriverInner params={params} />
    </Suspense>
  );
}

async function DriverInner({
  params,
}: {
  params: Promise<{ id: string; code: string }>;
}) {
  const { id, code } = await params;
  return <DriverClient raceId={id} code={code.toUpperCase()} />;
}
