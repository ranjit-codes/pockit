import type { Kind } from "../shared/item";

export const KIND_INFO: Record<Kind, { label: string; plural: string }> = {
  link: { label: "Link", plural: "Links" },
  article: { label: "Article", plural: "Articles" },
  video: { label: "Video", plural: "Videos" },
  tweet: { label: "Tweet", plural: "Tweets" },
  repo: { label: "Repo", plural: "Repos" },
  prompt: { label: "Prompt", plural: "Prompts" },
  snippet: { label: "Snippet", plural: "Snippets" },
  note: { label: "Note", plural: "Notes" },
};

export const TEXT_KINDS: Kind[] = ["note", "prompt", "snippet"];

export const parseTags = (raw: string) => raw.split(/[\s,]+/).filter(Boolean);
export const isSingleUrl = (text: string) => /^https?:\/\/\S+$/.test(text.trim());
export const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export const ago = (ms: number) => {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(s > 86400 * 300 && { year: "numeric" }) });
};
