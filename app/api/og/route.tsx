import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readJsonFile(raceId: string, file: string): Promise<unknown> {
  return JSON.parse(
    await readFile(join(process.cwd(), "public", "data", raceId, file), "utf-8")
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let raceId = searchParams.get("race");
  if (!raceId) {
    try {
      const idx = JSON.parse(
        await readFile(join(process.cwd(), "public", "data", "index.json"), "utf-8")
      ) as { races: { id: string }[] };
      raceId = idx.races[0]?.id ?? "unknown";
    } catch {
      raceId = "unknown";
    }
  }
  let name = raceId;
  let top: string[] = [];
  let story = "";
  try {
    const meta = (await readJsonFile(raceId, "meta.json")) as { name: string } | null;
    const drivers = (await readJsonFile(raceId, "drivers.json")) as
      | { finish: number | null; name: string }[]
      | null;
    const moments = (await readJsonFile(raceId, "moments.json")) as
      | { confidence: string; headline: string }[]
      | null;
    if (meta) name = meta.name;
    if (drivers) {
      top = drivers
        .filter((d) => d.finish && d.finish <= 3)
        .sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99))
        .map((d) => `${d.finish}. ${d.name.split(" ").slice(-1)}`);
    }
    if (moments) story = moments.find((m) => m.confidence === "high")?.headline ?? "";
  } catch {
    /* placeholder card */
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "#09090b",
          color: "#e4e4e7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#8a8a93" }}>PITWALL.AI · RACE RECAP</div>
        <div style={{ fontSize: 64, fontWeight: 700, marginTop: 12 }}>{name}</div>
        <div style={{ fontSize: 36, marginTop: 16 }}>{top.join("   ")}</div>
        <div style={{ fontSize: 28, marginTop: 16, color: "#2de2e6" }}>{story}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
