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
          <li>Open <b>Shortcuts</b> and tap <b>+</b>. Tap the name at the top and rename it <b>Save to Pockit</b>.</li>
          <li>Tap <b>ⓘ</b> and turn on <b>Show in Share Sheet</b>. Back in the editor, tap <b>Any</b> in “Receive Any input” and keep only <b>URLs</b> and <b>Text</b>.</li>
          <li>Add the <b>Get Contents of URL</b> action. Tap its <b>URL</b> field and paste the URL row below. Nothing else goes in that field.</li>
          <li>Tap <b>›</b> on the action to show more. Set <b>Method</b> to <b>POST</b>.</li>
          <li>Under <b>Headers</b>, tap <b>Add new header</b>. Key <code>Authorization</code>, value is the Header row below.</li>
          <li>Set <b>Request Body</b> to <b>JSON</b>. Tap <b>Add new field</b>, choose <b>Text</b>, and set the key to <code>input</code>. Tap the value and pick <b>Shortcut Input</b> from the bar above the keyboard.</li>
          <li>Add the <b>Show Notification</b> action. Delete its text and pick <b>Contents of URL</b> from the bar above the keyboard.</li>
          <li>Tap <b>Done</b>. Share any link to <b>Save to Pockit</b>. The notification reads “Saved: title”, or says what went wrong.</li>
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
      <p className="group-footer">Tap a row to copy it. If you change POCKIT_PASSWORD, the token changes, so paste the new Header row into the shortcut.</p>

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

