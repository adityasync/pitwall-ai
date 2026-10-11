/** Pit-stop table: every stop with stationary + total pit-lane loss.
 *  Durations are MEASURED from the timing feed. */
export function PitTable({
  pits,
  colours,
}: {
  pits: { driver: string; lap: number; duration: number | null; stationary: number | null }[];
  colours: Record<string, string>;
}) {
  if (pits.length === 0) return null;
  const rows = [...pits].sort((a, b) => a.lap - b.lap);
  const best = Math.min(...rows.map((r) => r.stationary ?? Infinity).filter((v) => v !== Infinity));
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[420px] text-sm">
        <thead>
          <tr className="panel-label border-b border-[var(--border)] text-left">
            <th className="p-2">Lap</th>
            <th className="p-2">Driver</th>
            <th className="p-2">Stationary</th>
            <th className="p-2">Pit-lane loss</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0">
              <td className="p-2 text-[var(--muted)]">{r.lap}</td>
              <td className="p-2 font-bold">
                <span aria-hidden className="mr-1.5 inline-block h-3.5 w-1 rounded-sm align-middle" style={{ background: colours[r.driver] ?? "#fff" }} />
                {r.driver}
              </td>
              <td className="p-2 font-bold" style={r.stationary === best ? { color: "var(--fastest)" } : undefined}>
                {r.stationary != null ? `${r.stationary.toFixed(1)}s` : "—"}
              </td>
              <td className="p-2">{r.duration != null ? `${r.duration.toFixed(1)}s` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tnum mt-2 text-[11px] text-[var(--faint)]">
        stationary = wheels stopped · loss = total time in the pit lane
      </p>
    </div>
  );
}
