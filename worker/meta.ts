import type { ItemMeta, Kind } from "../shared/item";

type Fetched = { title?: string; meta: ItemMeta };

const TIMEOUT_MS = 5000;

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const clean = (s: string | undefined) => {
  const v = s && decodeEntities(s).replace(/\s+/g, " ").trim();
  return v || undefined;
};

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json<T>();
};

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string; provider_name?: string; html?: string };

const youtube = async (url: URL): Promise<Fetched> => {
  const o = await getJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`);
  return { title: clean(o.title), meta: { author: o.author_name, image: o.thumbnail_url, site: "YouTube" } };
};

const tweet = async (url: URL): Promise<Fetched> => {
  const o = await getJson<OEmbed>(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url.href)}`);
  const text = clean(o.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, ""));
  const title = text ? `${o.author_name}: ${text.length > 140 ? `${text.slice(0, 140)}…` : text}` : o.author_name;
  return { title, meta: { author: o.author_name, description: text, site: "X" } };
};

const page = async (url: URL): Promise<Fetched> => {
  const res = await fetch(url.href, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Pockit/1.0)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("html")) return { meta: {} };

  const tags: Record<string, string> = {};
  let title = "";
  await new HTMLRewriter()
    .on("title", { text: (t) => void (title += t.text) })
    .on("meta", {
      element: (el) => {
        const key = (el.getAttribute("property") ?? el.getAttribute("name"))?.toLowerCase();
        const content = el.getAttribute("content");
        if (key && content && !(key in tags)) tags[key] = content;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    title: clean(tags["og:title"] ?? tags["twitter:title"] ?? title),
    meta: {
      description: clean(tags["og:description"] ?? tags["description"]),
      image: tags["og:image"],
      site: clean(tags["og:site_name"]),
      author: clean(tags["author"]),
    },
  };
};

export const fetchMeta = async (url: URL, kind: Kind): Promise<Fetched> => {
  try {
    if (kind === "video" && /youtu/.test(url.hostname)) return await youtube(url);
    if (kind === "tweet") return await tweet(url);
    return await page(url);
  } catch {
    return { meta: {} };
  }
};
