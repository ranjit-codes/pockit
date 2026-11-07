import type { Kind } from "../shared/item";

const HOST_KINDS: [RegExp, Kind][] = [
  [/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)vimeo\.com$/, "video"],
  [/^(www\.|mobile\.)?(x|twitter)\.com$/, "tweet"],
  [/^(www\.)?(github|gitlab)\.com$/, "repo"],
  [/(^|\.)(medium\.com|substack\.com|dev\.to|hashnode\.dev|hackernoon\.com)$/, "article"],
];

export const kindForUrl = (url: URL): Kind =>
  HOST_KINDS.find(([pattern]) => pattern.test(url.hostname))?.[1] ?? "link";

const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|mc_eid|ref_src|si)$/;

export const canonicalUrl = (raw: string): URL | null => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  if (/^(www\.|mobile\.)?twitter\.com$/.test(url.hostname) || url.hostname === "mobile.x.com") url.hostname = "x.com";
  const youtubeId = url.hostname === "youtu.be" ? url.pathname.slice(1) : /(^|\.)youtube\.com$/.test(url.hostname) && url.pathname === "/watch" ? url.searchParams.get("v") : null;
  if (youtubeId) return new URL(`https://www.youtube.com/watch?v=${youtubeId}`);
  const isTweet = url.hostname === "x.com";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key) || (isTweet && (key === "s" || key === "t"))) url.searchParams.delete(key);
  }
  return url;
};
