import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { type Item, type ItemPatch, isKind, type NewItem, normalizeTags } from "../shared/item";
import { canonicalUrl, kindForUrl } from "./kind";
import { fetchMeta } from "./meta";

type Env = { DB: D1Database; POCKIT_PASSWORD: string };
type Row = { id: string; kind: string; title: string; url: string | null; body: string | null; note: string | null; tags: string; meta: string; created_at: number };

const COOKIE = "pockit_session";
const encoder = new TextEncoder();

const sessionToken = async (password: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("pockit-session-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const safeEqual = (a: string, b: string) => {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
};

const toItem = (r: Row): Item => ({
  id: r.id,
  kind: isKind(r.kind) ? r.kind : "link",
  title: r.title,
  url: r.url,
  body: r.body,
  note: r.note,
  tags: JSON.parse(r.tags),
  meta: JSON.parse(r.meta),
  createdAt: r.created_at,
});

const ftsQuery = (q: string) => (q.match(/[\p{L}\p{N}_]+/gu) ?? []).map((t) => `"${t}"*`).join(" ");

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.post("/login", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!c.env.POCKIT_PASSWORD || typeof password !== "string" || !safeEqual(password, c.env.POCKIT_PASSWORD)) {
    return c.json({ error: "Wrong password" }, 401);
  }
  setCookie(c, COOKIE, await sessionToken(c.env.POCKIT_PASSWORD), {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return c.json({ ok: true });
});

app.use("*", async (c, next) => {
  const presented = getCookie(c, COOKIE) ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!presented || !c.env.POCKIT_PASSWORD || !safeEqual(presented, await sessionToken(c.env.POCKIT_PASSWORD))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.get("/token", async (c) => c.json({ token: await sessionToken(c.env.POCKIT_PASSWORD) }));

app.get("/items", async (c) => {
  const q = ftsQuery(c.req.query("q") ?? "");
  const kind = c.req.query("kind");
  const tag = c.req.query("tag");
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push("items_fts MATCH ?");
    params.push(q);
  }
  if (kind && isKind(kind)) {
    where.push("items.kind = ?");
    params.push(kind);
  }
  if (tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = ?)");
    params.push(tag);
  }
  const sql = [
    "SELECT items.* FROM items",
    q && "JOIN items_fts ON items_fts.rowid = items.rowid",
    where.length && `WHERE ${where.join(" AND ")}`,
    q ? "ORDER BY rank" : "ORDER BY items.created_at DESC",
    "LIMIT 200",
  ]
    .filter(Boolean)
    .join(" ");
  const { results } = await c.env.DB.prepare(sql).bind(...params).all<Row>();
  return c.json(results.map(toItem));
});

app.get("/facets", async (c) => {
  const [kinds, tags] = await c.env.DB.batch<{ name: string; count: number }>([
    c.env.DB.prepare("SELECT kind AS name, COUNT(*) AS count FROM items GROUP BY kind"),
    c.env.DB.prepare("SELECT value AS name, COUNT(*) AS count FROM items, json_each(items.tags) GROUP BY value ORDER BY count DESC, name"),
  ]);
  return c.json({ total: kinds!.results.reduce((n, k) => n + k.count, 0), kinds: kinds!.results, tags: tags!.results });
});

app.post("/items", async (c) => {
  const body = await c.req.json<NewItem>();
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) return c.json({ error: "Nothing to save" }, 400);

  const tags = JSON.stringify(normalizeTags(Array.isArray(body.tags) ? body.tags : []));
  const note = body.note?.trim() || null;
  const url = /^\S+$/.test(input) ? canonicalUrl(input) : null;
  const id = crypto.randomUUID();
  const now = Date.now();

  if (url) {
    const existing = await c.env.DB.prepare("SELECT * FROM items WHERE url = ?").bind(url.href).first<Row>();
    if (existing) return c.json({ item: toItem(existing), duplicate: true });
    const kind = isKind(body.kind) ? body.kind : kindForUrl(url);
    const fetched = await fetchMeta(url, kind);
    const row = await c.env.DB.prepare(
      `INSERT INTO items (id, kind, title, url, note, tags, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (url) DO UPDATE SET url = excluded.url RETURNING *`,
    )
      .bind(id, kind, fetched.title ?? url.hostname + url.pathname, url.href, note, tags, JSON.stringify(fetched.meta), now)
      .first<Row>();
    return c.json({ item: toItem(row!), duplicate: row!.id !== id }, 201);
  }

  const kind = isKind(body.kind) ? body.kind : "note";
  const firstLine = input.split("\n")[0]!.trim();
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  const row = await c.env.DB.prepare(
    "INSERT INTO items (id, kind, title, body, note, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
  )
    .bind(id, kind, title, input, note, tags, now)
    .first<Row>();
  return c.json({ item: toItem(row!), duplicate: false }, 201);
});

app.patch("/items/:id", async (c) => {
  const patch = await c.req.json<ItemPatch>();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof patch.title === "string" && patch.title.trim()) sets.push("title = ?"), params.push(patch.title.trim());
  if (isKind(patch.kind)) sets.push("kind = ?"), params.push(patch.kind);
  if (Array.isArray(patch.tags)) sets.push("tags = ?"), params.push(JSON.stringify(normalizeTags(patch.tags)));
  if (typeof patch.note === "string") sets.push("note = ?"), params.push(patch.note.trim() || null);
  if (typeof patch.body === "string") sets.push("body = ?"), params.push(patch.body);
  if (!sets.length) return c.json({ error: "Nothing to update" }, 400);
  const row = await c.env.DB.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...params, c.req.param("id"))
    .first<Row>();
  return row ? c.json(toItem(row)) : c.json({ error: "Not found" }, 404);
});

app.delete("/items/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default app;
