import type Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      file TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    );

    -- ON DELETE CASCADE matters: re-indexing an edited file deletes and
    -- re-inserts that file's 'nodes' rows (see graph/builder.ts). better-sqlite3
    -- turns PRAGMA foreign_keys on by default, so without CASCADE those deletes
    -- fail with "FOREIGN KEY constraint failed" as soon as a node has any
    -- dependent edge or chunk row — i.e. on every re-index after the first.
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
  `);
}
