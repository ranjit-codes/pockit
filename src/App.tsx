import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { type Facets, firstUrl, type Item, KINDS, type Kind } from "../shared/item";
import { api, type Filters, Unauthorized } from "./api";
import { Composer } from "./Composer";
import { Icon } from "./icons";
import { EditSheet, ItemCard } from "./ItemCard";
import { KIND_INFO } from "./kinds";
import { Settings } from "./Settings";
import { useKeyboardInset } from "./useKeyboardInset";

const sharedInput = () => {
  if (location.pathname !== "/share") return null;
  const p = new URLSearchParams(location.search);
  const text = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  history.replaceState(null, "", "/");
  return firstUrl(text) ?? (text.trim() || null);
};

const SHARED_INPUT = sharedInput();
const EMPTY_FACETS: Facets = { total: 0, kinds: [], tags: [] };

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useKeyboardInset();
  return (
    <>
      <div className="ambient" aria-hidden />
      {authed === false ? (
        <Login onDone={() => setAuthed(true)} />
      ) : (
        <Vault pendingShare={SHARED_INPUT} onUnauthorized={() => setAuthed(false)} />
      )}
    </>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.login(password);
      onDone();
    } catch {
      setError(true);
    }
  };
  return (
    <form className="login glass" onSubmit={submit}>
      <img src="/icon.svg" alt="" width={64} height={64} />
      <h1>Pockit</h1>
      <p>Everything worth keeping.</p>
      <input
        type="password"
        autoFocus
        placeholder="Password"
        aria-invalid={error}
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(false);
        }}
      />
      <button type="submit" className="primary">Unlock</button>
      <p className="error" role="alert">{error ? "Wrong password" : " "}</p>
    </form>
  );
}

const filterTitle = ({ kind, tag }: Filters) => (tag ? `#${tag}` : kind ? KIND_INFO[kind].plural : "All Items");

function Vault({ pendingShare, onUnauthorized }: { pendingShare: string | null; onUnauthorized: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [filters, setFilters] = useState<Filters>({ q: "", kind: null, tag: null });
  const [editing, setEditing] = useState<Item | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const shareHandled = useRef(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 70);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const flash = useCallback((text: string) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2000);
  }, []);

  const guard = useCallback(
    async <T,>(work: Promise<T>): Promise<T | undefined> => {
      try {
        return await work;
      } catch (e) {
        if (e instanceof Unauthorized) onUnauthorized();
        else flash(e instanceof Error ? e.message : "Something went wrong");
      }
    },
    [flash, onUnauthorized],
  );

  const refresh = useCallback(async () => {
    const result = await guard(Promise.all([api.list(filters), api.facets()]));
    if (!result) return;
    setItems(result[0]);
    setFacets(result[1]);
    setLoaded(true);
  }, [filters, guard]);

  useEffect(() => {
    const t = setTimeout(refresh, filters.q ? 180 : 0);
    return () => clearTimeout(t);
  }, [refresh, filters.q]);

  const save = async (input: string, kind: Kind | undefined, tags: string[]) => {
    const res = await guard(api.create({ input, kind, tags }));
    if (!res) return false;
    flash(res.duplicate ? "Already saved" : "Saved");
    await refresh();
    return true;
  };

  useEffect(() => {
    if (!pendingShare || shareHandled.current) return;
    shareHandled.current = true;
    void guard(api.create({ input: pendingShare })).then(async (res) => {
      if (!res) {
        shareHandled.current = false;
        return;
      }
      flash(res.duplicate ? "Already saved" : "Saved");
      setEditing(res.item);
      await refresh();
    });
  }, [pendingShare, guard, flash, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setKind = (kind: Kind | null) => setFilters((f) => ({ ...f, kind, tag: null }));
  const setTag = (tag: string | null) => setFilters((f) => ({ ...f, tag, kind: null }));
  const kindCount = (k: Kind) => facets.kinds.find((f) => f.name === k)?.count ?? 0;
  const presentKinds = KINDS.filter((k) => kindCount(k) > 0);
  const filtered = Boolean(filters.q || filters.kind || filters.tag);

  return (
    <div className="shell">
      <div className="status-bar glass-strip" aria-hidden />

      <aside className="sidebar glass">
        <div className="sidebar-brand">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>Pockit</span>
        </div>
        <nav>
          <SidebarItem icon="all" label="All Items" count={facets.total} active={!filters.kind && !filters.tag} onClick={() => setFilters((f) => ({ ...f, kind: null, tag: null }))} />
          {KINDS.map((k) => (
            <SidebarItem key={k} icon={k} kind={k} label={KIND_INFO[k].plural} count={kindCount(k)} active={filters.kind === k} onClick={() => setKind(filters.kind === k ? null : k)} />
          ))}
        </nav>
        {facets.tags.length > 0 && (
          <>
            <h3 className="sidebar-heading">Tags</h3>
            <nav className="sidebar-tags">
              {facets.tags.map((t) => (
                <SidebarItem key={t.name} icon="tag" label={t.name} count={t.count} active={filters.tag === t.name} onClick={() => setTag(filters.tag === t.name ? null : t.name)} />
              ))}
            </nav>
          </>
        )}
        <button type="button" className="sidebar-settings" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" />
          Settings
        </button>
      </aside>

      <main className="content">
        <header className="large-title">
          <div>
            <h1>{filterTitle(filters)}</h1>
            <p>{loaded ? `${items.length}${items.length === 200 ? "+" : ""} ${items.length === 1 ? "item" : "items"}${filters.q ? " found" : ""}` : " "}</p>
          </div>
          <button type="button" className="icon-button glass round settings-button" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Icon name="settings" />
          </button>
        </header>

        <div className={`toolbar${pinned ? " pinned" : ""}`}>
          <label className="search glass">
            <Icon name="search" size={17} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search"
              enterKeyHint="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Escape" && (setFilters((f) => ({ ...f, q: "" })), e.currentTarget.blur())}
            />
            {filters.q && (
              <button type="button" className="clear" onClick={() => setFilters((f) => ({ ...f, q: "" }))} aria-label="Clear search">
                <Icon name="close" size={12} strokeWidth={2.6} />
              </button>
            )}
          </label>
          {(presentKinds.length > 0 || facets.tags.length > 0) && (
            <div className="chip-scroller">
              <div className="chips">
                <button type="button" className={`chip glass${!filters.kind && !filters.tag ? " on" : ""}`} onClick={() => setFilters((f) => ({ ...f, kind: null, tag: null }))}>
                  All
                </button>
                {presentKinds.map((k) => (
                  <button type="button" key={k} data-kind={k} className={`chip glass${filters.kind === k ? " on" : ""}`} onClick={() => setKind(filters.kind === k ? null : k)}>
                    <Icon name={k} size={15} />
                    {KIND_INFO[k].plural}
                  </button>
                ))}
                {facets.tags.map((t) => (
                  <button type="button" key={t.name} className={`chip glass${filters.tag === t.name ? " on" : ""}`} onClick={() => setTag(filters.tag === t.name ? null : t.name)}>
                    #{t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ul className="cards">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onTag={setTag} onCopy={() => flash("Copied")} onEdit={() => setEditing(item)} />
          ))}
        </ul>
        {loaded && items.length === 0 && (
          <div className="empty">
            <Icon name={filtered ? "search" : "paste"} size={40} strokeWidth={1.4} />
            <h2>{filtered ? "No Results" : "Nothing Saved Yet"}</h2>
            <p>{filtered ? "Try a different search or filter." : "Paste a link, prompt, or note below. Share from any app to save it here."}</p>
          </div>
        )}
      </main>

      <Composer inputRef={composerRef} onSave={save} />

      {toast && (
        <div className="toast glass" key={toast.id} role="status">
          <Icon name="check" size={16} strokeWidth={2.4} />
          {toast.text}
        </div>
      )}

      {editing && (
        <EditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (await guard(api.update(editing.id, patch))) {
              setEditing(null);
              await refresh();
            }
          }}
          onDelete={async () => {
            await guard(api.remove(editing.id));
            setEditing(null);
            flash("Deleted");
            await refresh();
          }}
        />
      )}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onCopied={(what) => flash(`${what} copied`)} />}
    </div>
  );
}

type SidebarItemProps = { icon: Kind | "all" | "tag"; kind?: Kind; label: string; count: number; active: boolean; onClick: () => void };

function SidebarItem({ icon, kind, label, count, active, onClick }: SidebarItemProps) {
  return (
    <button type="button" className={`sidebar-item${active ? " on" : ""}`} data-kind={kind} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
      {count > 0 && <small>{count}</small>}
    </button>
  );
}
