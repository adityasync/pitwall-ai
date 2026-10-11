import type { Metadata } from "next";
import { LiveClient } from "./live-client";

export const metadata: Metadata = {
  title: "Live positions (beta) — PITWALL.AI",
  description: "Live F1 car positions from OpenF1. Beta, needs the paid live feed; replays always work.",
};

export default function LivePage() {
  return <LiveClient />;
}
