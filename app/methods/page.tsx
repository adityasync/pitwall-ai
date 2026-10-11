const METRICS = [
  { name: "Lap time, sectors", source: "OpenF1 laps", how: "Straight from the feed.", trust: "MEASURED" },
  { name: "Gap to leader / ahead", source: "OpenF1 intervals (~4 s, races)", how: "Straight from the feed.", trust: "MEASURED" },
  { name: "Position", source: "OpenF1 position", how: "Change feed, forward-filled to 1 Hz.", trust: "MEASURED" },
  { name: "Speed, throttle, gear, DRS", source: "OpenF1 car_data (~3.7 Hz)", how: "Straight from the feed, resampled to 10 m.", trust: "MEASURED" },
  { name: "Brake", source: "OpenF1 car_data", how: "Binary on/off only — never pressure.", trust: "MEASURED" },
  { name: "Track outline", source: "OpenF1 location", how: "x/y trace, downsampled. Units are not meters.", trust: "MEASURED" },
  { name: "Pit stop, duration", source: "OpenF1 pit", how: "Straight from the feed.", trust: "MEASURED" },
  { name: "Tyre compound + age", source: "OpenF1 stints + laps", how: "Compound joined by lap range; age counted from stint start.", trust: "MEASURED" },
  { name: "Median / best pace", source: "Computed", how: "Median and min over clean laps (pit, SC and in/out laps excluded).", trust: "DERIVED" },
  { name: "Closing rate, likely pass", source: "Computed", how: "Linear fit of the gap over recent laps.", trust: "DERIVED" },
  { name: "Corners + braking zones", source: "Computed", how: "Speed minima for apexes; brake on/off runs for zones.", trust: "DERIVED" },
  { name: "Delta traces", source: "Computed", how: "Cumulative time from speed integrated over distance.", trust: "DERIVED" },
  { name: "Tyre health bars", source: "Model", how: "1 − age/45 until degradation-based health lands.", trust: "ESTIMATE" },
  { name: "Tyre life left, wear/lap", source: "Model", how: "Linear slope of clean lap times per stint.", trust: "ESTIMATE" },
  { name: "Pit rejoin, undercut odds", source: "Model", how: "Gap arithmetic with pit-loss assumptions.", trust: "ESTIMATE" },
  { name: "Standings if ended now", source: "Model", how: "Standard 25-18-15… scale applied to current order.", trust: "ESTIMATE" },
];

const SOURCES = [
  { name: "OpenF1", access: "Free historical from 2023; live needs a paid plan.", note: "Primary source for everything." },
  { name: "FastF1", access: "Python loader with local cache.", note: "Fallback for lap telemetry; unused while OpenF1 suffices." },
];

const LIMITS = [
  "No brake pressure, steering angle, ERS deployment, brake bias, tyre temperature, tyre wear, fuel load, engine modes or car setup — anything built on these is an estimate and labelled.",
  "Brake is on/off. Braking distances are approximate.",
  "Location has no lateral lane position and its units are not meters; lap distance comes from integrating speed.",
  "Position updates only on change; the tower forward-fills to 1 Hz.",
  "Team radio coverage varies sharply by race (especially 2026) and transcripts are auto-generated where present.",
  "Championship endpoints are beta and race-session only; standings projections use the standard scale.",
];

export default function MethodsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <p className="panel-label">Methods and data limits</p>
      <h1 className="display mt-1 text-4xl font-bold sm:text-5xl">What is measured, and what is a guess.</h1>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">
        Analysts trust a tool that shows its working. Every metric here lists where it comes from,
        how it is computed, and how far to trust it.
      </p>

      <section aria-label="Metric by metric" className="mt-8">
        <h2 className="panel-label mb-2">Metric by metric</h2>
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="panel-label border-b border-[var(--border)] text-left">
                <th className="p-3">Metric</th><th className="p-3">Source</th>
                <th className="p-3">How it is computed</th><th className="p-3">Trust</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 font-semibold">{m.name}</td>
                  <td className="tnum p-3 text-[var(--muted)]">{m.source}</td>
                  <td className="p-3 text-[var(--muted)]">{m.how}</td>
                  <td className="tnum p-3">
                    <span style={{ color: m.trust === "MEASURED" ? "var(--good)" : m.trust === "DERIVED" ? "#64C4FF" : "var(--accent)" }}>
                      {m.trust}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Data sources" className="mt-8">
        <h2 className="panel-label mb-2">Data sources</h2>
        <ul className="grid gap-2">
          {SOURCES.map((s) => (
            <li key={s.name} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-[var(--muted)]">{s.access} {s.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Known limits" className="mt-8">
        <h2 className="panel-label mb-2">Known limits</h2>
        <ul className="grid gap-2">
          {LIMITS.map((l) => (
            <li key={l.slice(0, 24)} className="rounded-md border border-[var(--warn)] bg-[var(--panel)] p-4 text-sm">
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="How the AI stays honest" className="mt-8 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] p-5">
        <h2 className="panel-label mb-2">How the AI stays honest</h2>
        <p>
          The AI never reads raw data. Code computes the numbers first, and the AI explains only
          those, quoting them in an evidence strip. If the data cannot answer, it says so.
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Unofficial fan project. Not associated with Formula 1 companies. F1 and related marks are
          trade marks of Formula One Licensing B.V.
        </p>
      </section>
    </main>
  );
}
