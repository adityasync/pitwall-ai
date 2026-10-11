import type { Evidence, Trust } from "@/lib/types";

const TRUST_STYLE: Record<Trust, string> = {
  MEASURED: "text-[var(--good)] border-[var(--good)]",
  DERIVED: "text-[#64C4FF] border-[#64C4FF]",
  ESTIMATE: "text-[var(--accent)] border-[var(--accent)]",
};

/** Every number says which trust it carries (06-DESIGN-SYSTEM.md rule 1). */
export function TrustBadge({ trust }: { trust: Trust }) {
  return (
    <span
      className={`tnum inline-flex min-h-[22px] items-center rounded border px-1.5 text-[10px] font-bold tracking-widest ${TRUST_STYLE[trust]}`}
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
          className="tnum inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--raised)] px-2.5 py-1.5 text-xs"
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
    <article className="rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-4 sm:p-5">
      <p className="panel-label mb-1">Pit wall AI</p>
      <h3 className="display text-2xl font-bold">{headline}</h3>
      <p className="mt-2 text-base leading-relaxed">
        {lang === "hi" ? hinglish : text}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {lang === "hi" ? text : hinglish}
      </p>
      <div className="mt-3">
        <p className="panel-label mb-2">Evidence from the data</p>
        <EvidenceStrip evidence={evidence} />
      </div>
      {footer && (
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
          {footer}
        </p>
      )}
    </article>
  );
}
