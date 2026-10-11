import { useMemo } from "react";
import { fmtLapTime } from "@/lib/format";
import { bestLaps, sectorBests, sectorTone, type LapLike } from "@/lib/timing";
import { TYRE_STYLE } from "@/components/TimingRow";

function fmtSector(v: number | null): string {
  return v == null ? "—" : v.toFixed(3);
}

/** Best-laps table with F1 sector colours: purple = session best,
 *  green = personal best. Sectors are MEASURED, bests are DERIVED. */
export function BestLapsTable({
  laps,
  order,
  colours,
}: {
  laps: Record<string, LapLike[]>;
  order: string[];
  colours: Record<string, string>;
}) {
  const rows = useMemo(() => {
    const bests = bestLaps(laps);
    const sb = sectorBests(laps);
    return order
      .map((code) => ({ code, row: bests[code] ?? null, pb: sb.personal[code] }))
      .filter((r) => r.row?.time != null)
      .sort((a, b) => (a.row?.time as number) - (b.row?.time as number))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [laps, order]);

  if (rows.length === 0) return null;
  const fastest = rows[0].row?.time as number;

  const cell = (v: number | null, code: string, k: "s1" | "s2" | "s3", sb: ReturnType<typeof sectorBests>) => {
    const tone = sectorTone(v, sb.personal[code]?.[k] ?? null, sb.session[k]);
    return (
      <td
        key={k}
        className="p-2"
        style={
          tone === "purple"
            ? { color: "var(--fastest)", fontWeight: 700 }
            : tone === "green"
              ? { color: "var(--good)", fontWeight: 700 }
              : undefined
        }
      >
        {fmtSector(v)}
      </td>
    );
  };

  const sb = sectorBests(laps);
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[620px] text-sm">
        <thead>
          <tr className="panel-label border-b border-[var(--border)] text-left">
            <th className="p-2">#</th>
            <th className="p-2">Driver</th>
            <th className="p-2">Lap</th>
            <th className="p-2">Time</th>
            <th className="p-2">S1</th>
            <th className="p-2">S2</th>
            <th className="p-2">S3</th>
            <th className="p-2">Tyre</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tyre = TYRE_STYLE[(r.row?.compound ?? "").toUpperCase()] ?? { bg: "var(--raised)", fg: "var(--muted)", letter: "?" };
            return (
              <tr key={r.code} className="border-b border-[var(--border)] last:border-0">
                <td className="p-2 text-[var(--muted)]">{r.rank}</td>
                <td className="p-2 font-bold">
                  <span aria-hidden className="mr-1.5 inline-block h-3.5 w-1 rounded-sm align-middle" style={{ background: colours[r.code] ?? "#fff" }} />
                  {r.code}
                </td>
                <td className="p-2 text-[var(--muted)]">{r.row?.lap}</td>
                <td className="p-2 font-bold" style={(r.row?.time as number) === fastest ? { color: "var(--fastest)" } : undefined}>
                  {fmtLapTime(r.row?.time ?? null)}
                </td>
                {(["s1", "s2", "s3"] as const).map((k) => cell(r.row?.[k] ?? null, r.code, k, sb))}
                <td className="p-2">
                  <span
                    className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: tyre.bg, color: tyre.fg }}
                    title={`${r.row?.compound}, age ${r.row?.tyreAge ?? "?"} laps`}
                  >
                    {tyre.letter}
                  </span>
                  <span className="ml-1.5 text-xs text-[var(--muted)]">{r.row?.tyreAge} laps</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tnum mt-2 text-[11px] text-[var(--faint)]">
        <span style={{ color: "var(--fastest)" }}>PURPLE</span> session best ·{" "}
        <span style={{ color: "var(--good)" }}>GREEN</span> personal best · pit-lane laps excluded
      </p>
    </div>
  );
}
