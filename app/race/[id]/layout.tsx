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

export default async function RaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <RaceBar raceId={id} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
