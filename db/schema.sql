CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    refresh_token TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epubs (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    size        INTEGER NOT NULL,
    translate_to TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'queued',
    user_id     TEXT NOT NULL REFERENCES users(id),
    chunk_count INTEGER NOT NULL DEFAULT 0,
    object_key  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'upload',
    drive_link  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epubs_user_id ON epubs (user_id);

CREATE TABLE IF NOT EXISTS chunks (
    id           TEXT PRIMARY KEY,
    epub_id      TEXT NOT NULL REFERENCES epubs(id) ON DELETE CASCADE,
    chunk_id     INTEGER NOT NULL,
    object_key   TEXT NOT NULL,
    chapter_path TEXT,
    status       TEXT NOT NULL DEFAULT 'queued',
    retry_count  INTEGER NOT NULL DEFAULT 0,
    error_msg    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_epub ON chunks (epub_id, chunk_id);
