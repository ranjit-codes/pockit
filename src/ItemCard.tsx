import { useState } from "react";
import { type Item, type ItemPatch, KINDS, type Kind } from "../shared/item";
import { Icon } from "./icons";
import { ago, host, KIND_INFO, parseTags } from "./kinds";
import { Sheet } from "./Sheet";

type CardProps = {
  item: Item;
  onTag: (tag: string) => void;
  onCopy: () => void;
  onEdit: () => void;
};

export function ItemCard({ item, onTag, onCopy, onEdit }: CardProps) {
  const copy = async () => {
    await navigator.clipboard.writeText(item.body ?? item.url ?? item.title);
    onCopy();
  };
  const thumb = item.url && item.meta.image;
  const body = item.body?.trim();
  const titleIsBodyStart = !!body && body.startsWith(item.title.replace(/…$/, ""));
  const showTitle = !titleIsBodyStart || body === item.title;
  const showBody = !!body && body !== item.title;
  const description = item.kind !== "tweet" ? item.meta.description : undefined;

  return (
    <li className="card" data-kind={item.kind}>
      <div className="card-meta">
        <span className="kind-label">
          <Icon name={item.kind} size={14} strokeWidth={2} />
          {KIND_INFO[item.kind].label}
        </span>
        {item.url && <span className="dot">{host(item.url)}</span>}
        <span className="dot">{ago(item.createdAt)}</span>
        <span className="card-actions">
          <button type="button" className="icon-button small" onClick={copy} aria-label="Copy">
            <Icon name="copy" size={17} />
          </button>
          <button type="button" className="icon-button small" onClick={onEdit} aria-label="Edit">
            <Icon name="more" size={17} />
          </button>
        </span>
      </div>
      <div className={`card-main${thumb ? " has-thumb" : ""}`}>
        <div className="card-text">
          {item.url ? (
            <a className="card-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          ) : (
            showTitle && <span className="card-title">{item.title}</span>
          )}
          {description && <p className="card-desc">{description}</p>}
        </div>
        {thumb && (
          <a className="thumb" href={item.url!} target="_blank" rel="noreferrer" tabIndex={-1}>
            <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.parentElement?.remove()} />
          </a>
        )}
      </div>
      {showBody && <pre className={`card-body${showTitle ? "" : " lead"}`}>{body}</pre>}
      {item.note && <p className="card-note">{item.note}</p>}
      {item.tags.length > 0 && (
        <div className="card-tags">
          {item.tags.map((t) => (
            <button type="button" key={t} className="tag-pill" onClick={() => onTag(t)}>#{t}</button>
          ))}
        </div>
      )}
    </li>
  );
}

type EditProps = {
  item: Item;
  onClose: () => void;
  onSave: (patch: ItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function EditSheet({ item, onClose, onSave, onDelete }: EditProps) {
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState<Kind>(item.kind);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [note, setNote] = useState(item.note ?? "");
  const [body, setBody] = useState(item.body ?? "");
  const [confirming, setConfirming] = useState(false);

  const save = () => onSave({ title, kind, tags: parseTags(tags), note, ...(item.body !== null && { body }) });

  return (
    <Sheet
      title="Edit"
      onClose={onClose}
      leading={<button type="button" className="text-button" onClick={onClose}>Cancel</button>}
      trailing={<button type="button" className="text-button strong" onClick={save}>Done</button>}
    >
      <div className="group">
        <label className="row">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="row">
          <span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
          </select>
        </label>
        <label className="row">
          <span>Tags</span>
          <input placeholder="react, ai, later" value={tags} onChange={(e) => setTags(e.target.value)} autoCapitalize="none" autoCorrect="off" />
        </label>
      </div>
      {item.body !== null && (
        <div className="group">
          <textarea className="mono" rows={7} aria-label="Content" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      )}
      <div className="group">
        <textarea rows={3} placeholder="Why is this worth keeping?" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {item.url && (
        <div className="group">
          <a className="row link-row" href={item.url} target="_blank" rel="noreferrer">
            <span>Open {host(item.url)}</span>
            <Icon name="link" size={16} />
          </a>
        </div>
      )}
      <div className="group">
        <button type="button" className="row destructive" onClick={() => (confirming ? void onDelete() : setConfirming(true))}>
          {confirming ? "Tap again to delete" : "Delete Item"}
        </button>
      </div>
    </Sheet>
  );
}
