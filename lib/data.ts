/** Fetch + cache for static race JSON in public/data (docs/03 + 05). */

export type LoadStatus = "loading" | "ready" | "empty" | "error";

export async function loadJson<T>(path: string): Promise<{ data: T | null; status: LoadStatus }> {
  try {
    const base = process.env.NEXT_PUBLIC_DATA_BASE ?? "";
    const res = await fetch(`${base}/data/${path}`, { cache: "force-cache" });
    if (!res.ok) return { data: null, status: "error" };
    const data = (await res.json()) as T;
    if (data == null) return { data: null, status: "empty" };
    if (Array.isArray(data) && data.length === 0) return { data: null, status: "empty" };
    return { data, status: "ready" };
  } catch {
    return { data: null, status: "error" };
  }
}
