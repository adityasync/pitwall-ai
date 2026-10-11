import { Suspense } from "react";
import { RaceBar } from "@/components/RaceTabs";

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

function RaceBarSkeleton() {
  return (
    <div className="border-b border-[var(--border)] bg-[#090e16]" aria-hidden>
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <div className="h-[52px] w-40 animate-pulse bg-white/[0.06]" />
        <div className="h-8 flex-1 animate-pulse bg-white/[0.04]" />
      </div>
    </div>
  );
}

async function RaceBarLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RaceBar raceId={id} />;
}

export default function RaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <Suspense fallback={<RaceBarSkeleton />}>
        <RaceBarLoader params={params} />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
