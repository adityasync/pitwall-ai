import type { Evidence, Trust } from "@/lib/types";

const TRUST_STYLE: Record<Trust, string> = {
  MEASURED: "text-[var(--good)] border-[var(--good)]/50",
  DERIVED: "text-[#7cc4ff] border-[#7cc4ff]/50",
  ESTIMATE: "text-[var(--accent)] border-[var(--accent)]/50",
};

/** Every number says which trust it carries (06-DESIGN-SYSTEM.md rule 1). */
export function TrustBadge({ trust }: { trust: Trust }) {
  return (
    <span
      className={`tnum inline-flex min-h-[22px] items-center rounded-md bg-black/30 px-1.5 text-[10px] font-bold tracking-widest ${TRUST_STYLE[trust]}`}
      style={{ borderWidth: 1 }}
    >
      {trust}
    </span>
  );
}

/** Chips of label + value + trust under every AI sentence (07-AI-RULES.md). */
export function EvidenceStrip({ evidence }: { evidence: Evidence[] }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Evidence from the data">
      {evidence.map((e) => (
        <span
          key={e.label}
          className="tnum inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1.5 text-xs"
        >
          <span className="text-[var(--muted)]">{e.label}</span>
          <span className="font-semibold text-[var(--text)]">{e.value}</span>
          <TrustBadge trust={e.trust} />
        </span>
      ))}
    </div>
  );
}

export function AiCard({
  headline,
  text,
  hinglish,
  evidence,
  footer,
  lang,
}: {
  headline: string;
  text: string;
  hinglish: string;
  evidence: Evidence[];
  footer?: string;
  lang: "en" | "hi";
}) {
  return (
    <article className="relative border border-[var(--border)] bg-[var(--panel)]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-deep)]" />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <p className="tnum flex items-center gap-2 text-[11px] font-bold tracking-widest text-[var(--accent)]">
          PIT WALL AI
        </p>
        <h3 className="display mt-2 text-2xl font-bold leading-tight sm:text-3xl">{headline}</h3>
        <p className="mt-3 text-base leading-relaxed text-[var(--text)]">
          {lang === "hi" ? hinglish : text}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          {lang === "hi" ? text : hinglish}
        </p>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="panel-label mb-2.5">Evidence from the data</p>
          <EvidenceStrip evidence={evidence} />
        </div>
        {footer && (
          <p className="mt-4 text-xs leading-relaxed text-[var(--faint)]">
            {footer}
          </p>
        )}
      </div>
    </article>
  );
}
