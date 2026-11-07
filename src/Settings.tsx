import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Sheet } from "./Sheet";

export function Settings({ onClose, onCopied }: { onClose: () => void; onCopied: (what: string) => void }) {
  const [token, setToken] = useState("");
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  const endpoint = `${location.origin}/api/items`;

  useEffect(() => {
    void api.token().then((r) => setToken(r.token)).catch(() => {});
    // React blocks javascript: URLs in JSX, so the bookmarklet href is set directly.
    bookmarklet.current?.setAttribute("href", `javascript:location.href='${location.origin}/share?url='+encodeURIComponent(location.href)`);
  }, []);

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    onCopied(what);
  };

  return (
    <Sheet title="Settings" onClose={onClose} trailing={<button type="button" className="text-button strong" onClick={onClose}>Done</button>}>
      <h3 className="group-title">iPhone share sheet</h3>
      <div className="group">
        <ol className="steps">
          <li>Open <b>Shortcuts</b>, tap <b>+</b>, name it <b>Save to Pockit</b>.</li>
          <li>In its details, turn on <b>Show in Share Sheet</b> and accept <b>URLs</b> and <b>Text</b>.</li>
          <li>
            Add <b>Get Contents of URL</b> with the URL below, method <b>POST</b>, a header <code>Authorization</code> set to <code>Bearer</code> plus the token, and a JSON body
            with key <code>input</code> set to <b>Shortcut Input</b>.
          </li>
          <li>Add <b>Show Notification</b> with “Saved to Pockit”.</li>
        </ol>
        <button type="button" className="row copy-row" onClick={() => copy(endpoint, "URL")}>
          <span>URL</span>
          <code>{endpoint}</code>
        </button>
        <button type="button" className="row copy-row" disabled={!token} onClick={() => copy(`Bearer ${token}`, "Header")}>
          <span>Header</span>
          <code>Bearer {token ? `${token.slice(0, 10)}…` : "…"}</code>
        </button>
      </div>
      <p className="group-footer">Tap a row to copy it. The token changes if you change POCKIT_PASSWORD.</p>

      <h3 className="group-title">Laptop</h3>
      <div className="group">
        <div className="row">
          <span>Bookmarklet</span>
          <a ref={bookmarklet} className="bookmarklet" onClick={(e) => e.preventDefault()}>Save to Pockit</a>
        </div>
        <div className="row"><span>Search</span><kbd>/</kbd></div>
        <div className="row"><span>New item</span><kbd>N</kbd></div>
        <div className="row"><span>Save text</span><kbd>Ctrl Enter</kbd></div>
      </div>
      <p className="group-footer">Drag the bookmarklet to your bookmarks bar to save the current tab.</p>
    </Sheet>
  );
}
