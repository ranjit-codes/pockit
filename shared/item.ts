export const KINDS = ["link", "article", "video", "tweet", "repo", "prompt", "snippet", "note"] as const;
export type Kind = (typeof KINDS)[number];

export const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);

export type ItemMeta = {
  description?: string;
  image?: string;
  author?: string;
  site?: string;
};

export type Item = {
  id: string;
  kind: Kind;
  title: string;
  url: string | null;
  body: string | null;
  note: string | null;
  tags: string[];
  meta: ItemMeta;
  createdAt: number;
};

export type NewItem = {
  input: string;
  kind?: Kind;
  tags?: string[];
  note?: string;
};

export type ItemPatch = Partial<Pick<Item, "title" | "kind" | "tags" | "note" | "body">>;

export const normalizeTags = (tags: string[]): string[] =>
  [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))];

export const firstUrl = (text: string): string | null => {
  const match = text.match(/https?:\/\/[^\s<>"']+/);
  return match ? match[0] : null;
};
