CREATE TABLE items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'article', 'video', 'tweet', 'repo', 'prompt', 'snippet', 'note')),
  title TEXT NOT NULL,
  url TEXT UNIQUE,
  body TEXT,
  note TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX items_created_at ON items (created_at DESC);

CREATE VIRTUAL TABLE items_fts USING fts5 (
  title, body, note, tags, url,
  content = 'items',
  content_rowid = 'rowid'
);

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts (rowid, title, body, note, tags, url)
  VALUES (new.rowid, new.title, new.body, new.note, new.tags, new.url);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts (items_fts, rowid, title, body, note, tags, url)
  VALUES ('delete', old.rowid, old.title, old.body, old.note, old.tags, old.url);
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts (items_fts, rowid, title, body, note, tags, url)
  VALUES ('delete', old.rowid, old.title, old.body, old.note, old.tags, old.url);
  INSERT INTO items_fts (rowid, title, body, note, tags, url)
  VALUES (new.rowid, new.title, new.body, new.note, new.tags, new.url);
END;
