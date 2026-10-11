import { TYRE_STYLE } from "@/components/TimingRow";

export type Stint = { stint: number; compound: string | null; lapStart: number; lapEnd: number };

/** The iconic strategy graphic: one stacked bar per driver, stints coloured
 *  by compound. Stints are MEASURED from the timing feed. */
export function StintBars({
  stints,
  order,
  colours,
  laps,
  cap,
}: {
  stints: Record<string, Stint[]>;
  /** driver codes in finish order */
  order: string[];
  colours: Record<string, string>;
  laps: number;
  cap?: number;
}) {
  const rows = order.slice(0, cap ?? 12).filter((c) => (stints[c] ?? []).length > 0);
  return (
    <div role="img" aria-label="Tyre strategy: stint compounds for every driver across all laps">
      <div className="tnum flex text-[10px] text-[var(--faint)]" aria-hidden>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="w-1/4" style={{ marginLeft: f === 0 ? 64 : 0 }}>
            L{Math.round(1 + f * (laps - 1))}
          </span>
        ))}
      </div>
      <ul className="mt-1 flex flex-col gap-1.5">
        {rows.map((code) => (
          <li key={code} className="flex items-center gap-2">
            <span className="tnum flex w-14 shrink-0 items-center gap-1.5 text-xs font-bold">
              <span aria-hidden className="inline-block h-3 w-1 rounded-sm" style={{ background: colours[code] ?? "#fff" }} />
              {code}
            </span>
            <div className="flex h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-[var(--raised)]">
              {(stints[code] ?? []).map((s, i) => {
                const style = TYRE_STYLE[(s.compound ?? "").toUpperCase()] ?? { bg: "var(--border-strong)", fg: "#fff", letter: "?" };
                const left = ((s.lapStart - 1) / laps) * 100;
                const width = Math.max(1.5, ((s.lapEnd - s.lapStart + 1) / laps) * 100);
                return (
                  <span
                    key={i}
                    title={`${code} ${s.compound} laps ${s.lapStart}–${s.lapEnd}`}
                    className="tnum flex h-full items-center justify-center text-[10px] font-bold"
                    style={{ marginLeft: i === 0 ? `${left}%` : undefined, width: `${width}%`, background: style.bg, color: style.fg }}
                  >
                    {width > 7 ? `${style.letter}${s.lapEnd - s.lapStart + 1}` : ""}
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="tnum mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
        <span><span style={{ color: "#DA291C" }}>■</span> S SOFT</span>
        <span><span style={{ color: "#FFF000" }}>■</span> M MEDIUM</span>
        <span><span className="text-white">■</span> H HARD</span>
        <span><span style={{ color: "#39B54A" }}>■</span> I INTER</span>
        <span className="text-[var(--faint)]">segment edges = pit stops</span>
      </p>
    </div>
  );
}
