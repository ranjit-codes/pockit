import { type FocusEvent, type FormEvent, type KeyboardEvent, type RefObject, useLayoutEffect, useState } from "react";
import type { Kind } from "../shared/item";
import { Icon } from "./icons";
import { isSingleUrl, KIND_INFO, parseTags, TEXT_KINDS } from "./kinds";

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSave: (input: string, kind: Kind | undefined, tags: string[]) => Promise<boolean>;
};

const canReadClipboard = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

export function Composer({ inputRef, onSave }: Props) {
  const [input, setInput] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const isUrl = isSingleUrl(input);
  const hasInput = input.trim() !== "";
  const expanded = focused || hasInput;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, inputRef]);

  const save = async (value = input) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    const ok = await onSave(value, isSingleUrl(value) ? undefined : kind, parseTags(tags));
    setBusy(false);
    if (ok) {
      setInput("");
      setTags("");
      setKind("note");
      inputRef.current?.blur();
    }
  };

  const paste = async () => {
    const text = (await navigator.clipboard.readText().catch(() => "")).trim();
    if (!text) return;
    if (isSingleUrl(text)) return save(text);
    setInput(text);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      (e.target as HTMLElement).blur();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (isUrl && !e.shiftKey))) {
      e.preventDefault();
      void save();
    }
  };

  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  return (
    <div className="composer-dock">
      <form
        className={`composer glass${expanded ? " expanded" : ""}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save();
        }}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
      >
        <div className="composer-row">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Save a link, prompt, or note"
            aria-label="Save a link, prompt, or note"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {hasInput ? (
            <button type="submit" className="send" disabled={busy} aria-label="Save">
              <Icon name={busy ? "more" : "send"} size={18} strokeWidth={2.4} />
            </button>
          ) : (
            canReadClipboard && (
              <button type="button" className="icon-button" onClick={paste} aria-label="Paste and save">
                <Icon name="paste" />
              </button>
            )
          )}
        </div>
        {expanded && (
          <div className="composer-extra">
            {hasInput && !isUrl && (
              <div className="segmented" role="radiogroup" aria-label="Kind">
                {TEXT_KINDS.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} data-kind={k} className={kind === k ? "on" : undefined} onClick={() => setKind(k)}>
                    <Icon name={k} size={15} />
                    {KIND_INFO[k].label}
                  </button>
                ))}
              </div>
            )}
            <label className="tag-field">
              <Icon name="tag" size={15} />
              <input placeholder="Tags" value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={onKeyDown} autoCapitalize="none" autoCorrect="off" />
            </label>
          </div>
        )}
      </form>
    </div>
  );
}
