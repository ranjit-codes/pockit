import type { Item, ItemPatch, Kind, NewItem } from "../shared/item";

export class Unauthorized extends Error {}

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (res.status === 401) throw new Unauthorized();
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
};

export type Filters = { q: string; kind: Kind | null; tag: string | null };

export const api = {
  login: (password: string) => call<{ ok: true }>("/login", { method: "POST", body: JSON.stringify({ password }) }),
  list: ({ q, kind, tag }: Filters) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (kind) params.set("kind", kind);
    if (tag) params.set("tag", tag);
    return call<Item[]>(`/items?${params}`);
  },
  tags: () => call<{ tag: string; count: number }[]>("/tags"),
  create: (item: NewItem) => call<{ item: Item; duplicate: boolean }>("/items", { method: "POST", body: JSON.stringify(item) }),
  update: (id: string, patch: ItemPatch) => call<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => call<void>(`/items/${id}`, { method: "DELETE" }),
};
