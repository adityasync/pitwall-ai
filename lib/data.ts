/** Fetch + cache for race JSON (docs/03 + 05).
 * Backend-first with static fallback: if NEXT_PUBLIC_API_BASE is set, try
 * the pitwall-api service (GET /v1/...) and fall through to the committed
 * public/data files on any failure — a sleeping backend never breaks the app.
 */

export type LoadStatus = "loading" | "ready" | "empty" | "error";

/** Map a static data path to the service route, or null to go static-only. */
function apiPath(path: string): string | null {
  if (path === "index.json") return "index";
  const m = path.match(/^([^/]+)\/(.+)\.json$/);
  if (!m) return null;
  return `race/${m[1]}/${m[2]}`;
}

async function parse<T>(res: globalThis.Response): Promise<{ data: T | null; status: LoadStatus }> {
  if (!res.ok) return { data: null, status: "error" };
  const data = (await res.json()) as T;
  if (data == null) return { data: null, status: "empty" };
  if (Array.isArray(data) && data.length === 0) return { data: null, status: "empty" };
  return { data, status: "ready" };
}

export async function loadJson<T>(path: string): Promise<{ data: T | null; status: LoadStatus }> {
  const api = process.env.NEXT_PUBLIC_API_BASE ?? "";
  if (api) {
    const route = apiPath(path);
    if (route) {
      try {
        const res = await fetch(`${api}/v1/${route}`);
        if (res.ok) return parse<T>(res);
        // non-ok -> fall through to static below
      } catch {
        // backend asleep/unreachable -> static fallback
      }
    }
  }
  try {
    const base = process.env.NEXT_PUBLIC_DATA_BASE ?? "";
    // index.json is tiny and changes every deploy: always revalidate so new
    // races appear without a hard refresh. Heavy race files stay cached.
    // track.json is tiny too (~5 KB) and the pipeline rewrites outlines in
    // place (rebuild_outlines.py) — a cached whole-race-trace scribble once
    // survived a fix behind force-cache, so it always revalidates as well.
    // meta.json carries coverage.telemetryDrivers; rebuilding a race can add
    // telemetry files, so a stale copy would hide drivers that now exist.
    const fresh =
      path === "index.json" || path.endsWith("/track.json") || path.endsWith("/meta.json");
    const init = fresh ? { cache: "no-store" as const } : { cache: "force-cache" as const };
    const res = await fetch(`${base}/data/${path}`, init);
    return parse<T>(res);
  } catch {
    return { data: null, status: "error" };
  }
}
