import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Sheet } from "./Sheet";

export function Settings({ onClose, onCopied }: { onClose: () => void; onCopied: (what: string) => void }) {
  const [token, setToken] = useState("");
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  const endpoint = `${location.origin}/api/items`;
  const prompt = shortcutPrompt(endpoint);

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
        <pre className="prompt">{prompt}</pre>
        <button type="button" className="row copy-row strong-row" onClick={() => copy(prompt, "Prompt")}>
          <span>Copy Prompt</span>
        </button>
        <button type="button" className="row copy-row" disabled={!token} onClick={() => copy(`Bearer ${token}`, "Header")}>
          <span>Header</span>
          <code>Bearer {token ? `${token.slice(0, 10)}…` : "…"}</code>
        </button>
      </div>
      <p className="group-footer">
        Paste the prompt into the Shortcuts app. It has no token, so then copy the Header row and paste it over <code>Bearer {TOKEN_PLACEHOLDER}</code> in the Authorization header.
      </p>

      <details className="group manual">
        <summary className="row">Set it up by hand</summary>
        <ol className="steps">
          <li>Open <b>Shortcuts</b>, tap <b>+</b>, name it <b>Save to Pockit</b>.</li>
          <li>In its details, turn on <b>Show in Share Sheet</b> and accept <b>URLs</b> and <b>Text</b>.</li>
          <li>Add <b>Get Contents of URL</b>. Paste the URL below as plain text, with nothing after it.</li>
          <li>Tap <b>Show More</b>. Set Method to <b>POST</b>.</li>
          <li>Under Headers, add one header. Key <code>Authorization</code>, value is the Header row above.</li>
          <li>Set Request Body to <b>JSON</b>. Add a <b>Text</b> field with key <code>input</code>, and pick the <b>Shortcut Input</b> variable as its value.</li>
          <li>Add <b>Show Notification</b> and set its body to the <b>Contents of URL</b> variable, so errors show up too.</li>
        </ol>
        <button type="button" className="row copy-row" onClick={() => copy(endpoint, "URL")}>
          <span>URL</span>
          <code>{endpoint}</code>
        </button>
      </details>
      <p className="group-footer">The token changes if you change POCKIT_PASSWORD. Rebuild the shortcut after that.</p>

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

const TOKEN_PLACEHOLDER = "PASTE_TOKEN_HERE";

const shortcutPrompt = (endpoint: string) => `Create a shortcut named "Save to Pockit".

Show it in the Share Sheet and accept URLs and Text. If there is no input, ask for text.

Actions:
1. Get Contents of URL.
   - URL: ${endpoint}
     Type it exactly as plain text. Do not add Shortcut Input or any variable to the URL.
   - Method: POST
   - Headers: one header with key "Authorization" and value "Bearer ${TOKEN_PLACEHOLDER}"
   - Request Body: JSON, with one Text field. Key "input", value is the Shortcut Input variable.
2. Get Dictionary Value for key "error" from Contents of URL.
3. If Dictionary Value has any value, show a notification with the text "Pockit error: " followed by Dictionary Value.
4. Otherwise, get the value for key "item" from Contents of URL, then get the value for key "title" from that, and show a notification with the text "Saved to Pockit: " followed by that title.`;
