import type { ReactNode } from "react";
import { fmtGap } from "@/lib/format";

export const TYRE_STYLE: Record<string, { bg: string; fg: string; letter: string }> = {
  SOFT: { bg: "#DA291C", fg: "#fff", letter: "S" },
  MEDIUM: { bg: "#FFF000", fg: "#000", letter: "M" },
  HARD: { bg: "#FFFFFF", fg: "#000", letter: "H" },
  INTERMEDIATE: { bg: "#39B54A", fg: "#000", letter: "I" },
  WET: { bg: "#64C4FF", fg: "#000", letter: "W" },
};

/** Tyre circle with a letter — colour never the only signal (06 rule 5). */
export function TyreDot({ compound, age }: { compound: string | null; age: number | null }) {
  const s = TYRE_STYLE[(compound ?? "").toUpperCase()] ?? {
    bg: "var(--raised)",
    fg: "var(--muted)",
    letter: "?",
  };
  return (
    <span
      className="tnum inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.fg }}
      title={compound ? `${compound}, age ${age ?? "?"} laps` : "Compound unknown"}
    >
      {s.letter}
    </span>
  );
}

/** Simple tyre-health bar (ESTIMATE from lap times). Green fresh → red worn. */
export function TyreBars({ health }: { health: number | null }) {
  // health 0..1 (1 = fresh). 5 blocks, label included for non-colour signal.
  const filled = health == null ? 0 : Math.round(health * 5);
  const colour =
    health == null ? "var(--muted)" : health > 0.6 ? "var(--good)" : health > 0.3 ? "var(--warn)" : "var(--bad)";
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={health == null ? "Tyre health unknown" : `Tyre health ${Math.round(health * 100)} percent`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-4 rounded-sm"
          style={{ background: i < filled ? colour : "var(--border)" }}
        />
      ))}
    </span>
  );
}

export function TimingRow({
  pos,
  teamColour,
  code,
  gap,
  tyre,
  age,
  trend,
  onSelect,
  selected,
  sectors,
  status,
  dense,
  flash,
}: {
  pos: number;
  teamColour: string;
  code: string;
  /** main interval readout (gap ahead, or LEADER) */
  gap: string | null;
  tyre: string | null;
  age: number | null;
  /** positions gained (+) / lost (−) vs grid, null when unknown */
  trend: number | null;
  onSelect?: () => void;
  selected?: boolean;
  /** last-lap sector mini-cells (xl screens only) */
  sectors?: ReactNode;
  /** PIT when in the pit lane, DRS when within 1 s of the car ahead */
  status?: "PIT" | "DRS" | null;
  /** compact rows for the mission-control rail */
  dense?: boolean;
  /** position changed since last render — flash, no remount */
  flash?: boolean;
}) {
  const inner = (
    <>
      <span className="h-9 w-1.5 flex-none rounded-full" style={{ background: teamColour }} aria-hidden />
      <span className="tnum w-7 flex-none text-sm font-bold text-[var(--muted)]">{pos}</span>
      <span className="tnum w-12 flex-none text-[15px] font-bold tracking-wide">{code}</span>
      <span className="tnum min-w-16 flex-none text-sm text-[var(--muted)]" title="Interval to the car ahead (MEASURED)">
        {gap ?? fmtGap(null)}
      </span>
      {status && (
        <span
          className="tnum shrink-0 rounded border px-1 text-[10px] font-bold tracking-widest"
          style={
            status === "PIT"
              ? { color: "var(--warn)", borderColor: "var(--warn)" }
              : { color: "var(--accent)", borderColor: "var(--accent)" }
          }
        >
          {status}
        </span>
      )}
      <span className="tnum min-w-0 flex-1" />
      {sectors}
      {trend != null && trend !== 0 && (
        <span
          className="tnum shrink-0 text-xs font-bold"
          style={{ color: trend > 0 ? "var(--good)" : "var(--bad)" }}
          aria-label={`${trend > 0 ? "gained" : "lost"} ${Math.abs(trend)} positions`}
        >
          {trend > 0 ? `▲${trend}` : `▼${Math.abs(trend)}`}
        </span>
      )}
      <TyreDot compound={tyre} age={age} />
    </>
  );
  if (!onSelect) {
    return (
      <li className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 transition-colors last:border-0 hover:bg-[var(--raised)]/60">
        {inner}
      </li>
    );
  }
  return (
    <li
      className={`border-b border-[var(--border)] last:border-0 ${flash ? "flash" : ""}`}
      style={
        selected
          ? { background: "var(--accent-dim)", boxShadow: "inset 3px 0 0 0 var(--accent-deep)" }
          : undefined
      }
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select ${code}, position ${pos}`}
        className={`flex w-full items-center gap-2.5 px-3 text-left hover:bg-[var(--raised)]/60 ${dense ? "py-1.5" : "py-2.5"}`}
      >
        {inner}
      </button>
    </li>
  );
}
