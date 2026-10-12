import { memo } from "react";
import { sectorTone, type LapLike, type SectorBests } from "@/lib/timing";

/** Last-lap sector mini-cells for the timing tower: purple = session best,
 *  green = personal best, with text labels (never colour-only).
 *  Memoized — row objects come straight from the bundle, so identity is
 *  stable across replay ticks until the car completes another lap. */
export const SectorCells = memo(function SectorCells({
  row,
  personal,
  session,
}: {
  row: LapLike | null;
  personal: SectorBests["personal"][string] | undefined;
  session: SectorBests["session"];
}) {
  if (!row) return <span className="tnum text-xs text-[var(--faint)]">—</span>;
  return (
    <span className="tnum inline-flex items-center gap-1 text-xs" title={`Lap ${row.lap} sectors${row.pitLane ? " (pit lane)" : ""}`}>
      {(["s1", "s2", "s3"] as const).map((k) => {
        const v = row[k];
        const tone = sectorTone(v, personal?.[k] ?? null, session[k]);
        return (
          <span
            key={k}
            className="rounded bg-black/30 px-1 py-0.5"
            style={
              tone === "purple"
                ? { color: "var(--fastest)", fontWeight: 700 }
                : tone === "green"
                  ? { color: "var(--good)", fontWeight: 700 }
                  : { color: "var(--muted)" }
            }
          >
            {v != null ? v.toFixed(1) : "–"}
          </span>
        );
      })}
    </span>
  );
});
