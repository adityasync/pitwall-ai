import { Suspense } from "react";
import { StandingsClient } from "./standings-client";

export default function StandingsRoute() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10">
          <p className="text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <StandingsClient />
    </Suspense>
  );
}
