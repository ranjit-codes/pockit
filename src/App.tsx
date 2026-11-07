import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { firstUrl, type Item, KINDS, type Kind } from "../shared/item";
import { api, type Filters, Unauthorized } from "./api";

const KIND_LABEL: Record<Kind, string> = {
  link: "Link",
  article: "Article",
  video: "Video",
  tweet: "Tweet",
  repo: "Repo",
  prompt: "Prompt",
  snippet: "Snippet",
  note: "Note",
};

const TEXT_KINDS: Kind[] = ["note", "prompt", "snippet"];

const parseTags = (raw: string) => raw.split(/[\s,]+/).filter(Boolean);
const isSingleUrl = (text: string) => /^https?:\/\/\S+$/.test(text.trim());
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const ago = (ms: number) => {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const sharedInput = () => {
  if (location.pathname !== "/share") return null;
  const p = new URLSearchParams(location.search);
  const text = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  history.replaceState(null, "", "/");
  return firstUrl(text) ?? (text.trim() || null);
};

const SHARED_INPUT = sharedInput();

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  return authed === false ? (
    <Login onDone={() => setAuthed(true)} />
  ) : (
    <Vault pendingShare={SHARED_INPUT} onUnauthorized={() => setAuthed(false)} onAuthed={() => setAuthed(true)} />
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.login(password);
      onDone();
    } catch {
      setError("Wrong password");
    }
  };
  return (
    <form className="login" onSubmit={submit}>
      <h1>Pockit</h1>
      <input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Unlock</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function Vault({ pendingShare, onUnauthorized, onAuthed }: { pendingShare: string | null; onUnauthorized: () => void; onAuthed: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", kind: null, tag: null });
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const shareHandled = useRef(false);

  const guard = useCallback(
    async <T,>(work: Promise<T>): Promise<T | undefined> => {
      try {
        const result = await work;
        onAuthed();
        return result;
      } catch (e) {
        if (e instanceof Unauthorized) onUnauthorized();
        else flash(e instanceof Error ? e.message : "Something went wrong");
      }
    },
    [onAuthed, onUnauthorized],
  );

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  };

  const refresh = useCallback(async () => {
    const [list, tagList] = (await guard(Promise.all([api.list(filters), api.tags()]))) ?? [];
    if (list) setItems(list);
    if (tagList) setTags(tagList);
  }, [filters, guard]);

  useEffect(() => {
    const t = setTimeout(refresh, filters.q ? 200 : 0);
    return () => clearTimeout(t);
  }, [refresh, filters.q]);

  const save = async (input: string, kind: Kind | undefined, tagList: string[]) => {
    const res = await guard(api.create({ input, kind, tags: tagList }));
    if (!res) return false;
    flash(res.duplicate ? "Already saved" : "Saved");
    setOpenId(res.item.id);
    await refresh();
    return true;
  };

  useEffect(() => {
    if (pendingShare && !shareHandled.current) {
      shareHandled.current = true;
      void save(pendingShare, undefined, []);
    }
  });

  const filtered = filters.q || filters.kind || filters.tag;

  return (
    <main>
      <header>
        <h1>Pockit</h1>
        <span className="count">{items.length}{items.length === 200 ? "+" : ""} {filtered ? "found" : "saved"}</span>
      </header>

      <Capture onSave={save} />

      <section className="filters">
        <input
          className="search"
          type="search"
          placeholder="Search everything…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <div className="chips">
          <Chip active={!filters.kind} onClick={() => setFilters({ ...filters, kind: null })}>All</Chip>
          {KINDS.map((k) => (
            <Chip key={k} kind={k} active={filters.kind === k} onClick={() => setFilters({ ...filters, kind: filters.kind === k ? null : k })}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="chips tags">
            {tags.map(({ tag, count }) => (
              <Chip key={tag} active={filters.tag === tag} onClick={() => setFilters({ ...filters, tag: filters.tag === tag ? null : tag })}>
                #{tag} <small>{count}</small>
              </Chip>
            ))}
          </div>
        )}
      </section>

      <ul className="items">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            onTag={(tag) => setFilters({ ...filters, tag })}
            onCopy={() => flash("Copied")}
            onUpdate={async (patch) => {
              if (await guard(api.update(item.id, patch))) {
                setOpenId(null);
                await refresh();
              }
            }}
            onDelete={async () => {
              await guard(api.remove(item.id));
              await refresh();
            }}
          />
        ))}
      </ul>
      {items.length === 0 && <p className="empty">{filtered ? "Nothing matches." : "Paste a link or some text above to save your first thing."}</p>}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Chip({ active, kind, onClick, children }: { active: boolean; kind?: Kind; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip${active ? " active" : ""}`} data-kind={kind} onClick={onClick}>
      {children}
    </button>
  );
}

function Capture({ onSave }: { onSave: (input: string, kind: Kind | undefined, tags: string[]) => Promise<boolean> }) {
  const [input, setInput] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const isUrl = isSingleUrl(input);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    const ok = await onSave(input, isUrl ? undefined : kind, parseTags(tags));
    setBusy(false);
    if (ok) {
      setInput("");
      setTags("");
      setKind("note");
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (isUrl && !e.shiftKey))) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form className="capture" onSubmit={submit}>
      <textarea
        autoFocus
        rows={input.includes("\n") ? 5 : 1}
        placeholder="Paste a URL, prompt, snippet, or note…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {input.trim() && (
        <div className="capture-row">
          {!isUrl && (
            <div className="chips">
              {TEXT_KINDS.map((k) => (
                <Chip key={k} kind={k} active={kind === k} onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </Chip>
              ))}
            </div>
          )}
          <input className="tag-input" placeholder="tags: react, ai" value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={onKeyDown} />
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      )}
    </form>
  );
}

type CardProps = {
  item: Item;
  open: boolean;
  onToggle: () => void;
  onTag: (tag: string) => void;
  onCopy: () => void;
  onUpdate: (patch: Partial<Item>) => Promise<void>;
  onDelete: () => Promise<void>;
};

function ItemCard({ item, open, onToggle, onTag, onCopy, onUpdate, onDelete }: CardProps) {
  const copy = async () => {
    await navigator.clipboard.writeText(item.body ?? item.url ?? item.title);
    onCopy();
  };
  return (
    <li className="item">
      <div className="item-head">
        {item.meta.image && item.url && <img className="thumb" src={item.meta.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        <div className="item-main">
          <div className="item-meta">
            <span className="badge" data-kind={item.kind}>{KIND_LABEL[item.kind]}</span>
            {item.url && <span>{host(item.url)}</span>}
            <span>{ago(item.createdAt)}</span>
          </div>
          {item.url ? (
            <a className="title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          ) : (
            <span className="title">{item.title}</span>
          )}
          {item.meta.description && item.kind !== "tweet" && <p className="desc">{item.meta.description}</p>}
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={copy} title="Copy">Copy</button>
          <button type="button" className="ghost" onClick={onToggle} title="Edit">{open ? "Close" : "Edit"}</button>
        </div>
      </div>
      {item.body && !open && <pre className="body">{item.body}</pre>}
      {item.note && !open && <p className="note">{item.note}</p>}
      {item.tags.length > 0 && !open && (
        <div className="item-tags">
          {item.tags.map((t) => (
            <button type="button" key={t} className="tag" onClick={() => onTag(t)}>#{t}</button>
          ))}
        </div>
      )}
      {open && <Editor item={item} onUpdate={onUpdate} onDelete={onDelete} />}
    </li>
  );
}

function Editor({ item, onUpdate, onDelete }: Pick<CardProps, "item" | "onUpdate" | "onDelete">) {
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState(item.kind);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [note, setNote] = useState(item.note ?? "");
  const [body, setBody] = useState(item.body ?? "");
  const [confirming, setConfirming] = useState(false);
  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        void onUpdate({ title, kind, tags: parseTags(tags), note, ...(item.body !== null && { body }) });
      }}
    >
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label>Tags<input autoFocus placeholder="react, ai, later" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      {item.body !== null && <label>Content<textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></label>}
      <label>Note<textarea rows={2} placeholder="Why is this worth keeping?" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="editor-actions">
        <button type="submit">Save</button>
        <button type="button" className={confirming ? "danger" : "ghost"} onClick={() => (confirming ? void onDelete() : setConfirming(true))}>
          {confirming ? "Really delete?" : "Delete"}
        </button>
      </div>
    </form>
  );
}
