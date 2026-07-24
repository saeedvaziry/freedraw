# FreeDraw Hocuspocus service

A standalone Node/TypeScript collaboration server built on
[`@hocuspocus/server`](https://tiptap.dev/docs/hocuspocus). It persists yjs
documents into FreeDraw's existing MySQL update-log / snapshot schema through a
custom `UpdateLogDatabase` extension.

A Hocuspocus "room" is the page's `public_id` (the `pages.public_id` UUID).

## What it does

The `UpdateLogDatabase` extension wires three Hocuspocus hooks to the database:

- **`onLoadDocument`** hydrates a room. It loads the latest row from
  `page_snapshots`, applies that state, then replays the tail of `page_updates`
  with `seq > up_to_seq`. When there is no snapshot it replays every
  `page_updates` row. When neither exists it seeds the document from the base64
  `pages.document` bridge column (the same encoding the browser writes).
- **`onChange`** appends the incoming yjs update as a new `page_updates` row.
- **`onStoreDocument`** compacts: it inserts a fresh `page_snapshots` row, prunes
  the superseded `page_updates` rows, writes the compacted state back to
  `pages.document` as base64, and stamps `referenced_at` on the `page_assets`
  rows the document still references.

### Sequence contention

`page_updates` has a `UNIQUE (page_id, seq)` constraint. `onChange` allocates the
next sequence inside a single statement
(`INSERT ... SELECT COALESCE(MAX(seq), 0) + 1 ... FROM page_updates WHERE page_id = ?`)
so the read-and-write is atomic. If two writers still collide on the same
`seq`, the loser receives a duplicate-key error and the append is retried (up to
`HOCUSPOCUS_SEQ_MAX_RETRIES` times), re-reading the max on each attempt.

### Compaction correctness

`onStoreDocument` reads the current `MAX(seq)` **before** encoding the document
state and uses that value as the snapshot boundary. Because a `page_updates` row
is only written after its update has already been applied to the in-memory
document, every row with `seq <= boundary` is guaranteed to be represented in the
encoded snapshot state. The prune therefore deletes only `seq <= boundary`; any
update that arrives concurrently (`seq > boundary`) is preserved and replayed on
top of the snapshot on the next load. The snapshot row is inserted before the
prune runs, so a crash between the two steps leaves redundant-but-harmless
updates rather than losing data.

Prior machine-generated snapshots (`label IS NULL AND created_by IS NULL`) below
the new boundary are removed to keep growth bounded; labeled / user-created
snapshots are always kept.

## Environment variables

The service reads its database configuration from the same variables the Laravel
app uses, so it can share the project `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_DATABASE` | `freedraw` | Database name |
| `DB_USERNAME` | `root` | MySQL user |
| `DB_PASSWORD` | _(empty)_ | MySQL password |
| `DB_SOCKET` | _(unset)_ | Optional unix socket path |
| `DB_CHARSET` | `utf8mb4` | Connection charset |
| `DB_POOL_SIZE` | `10` | mysql2 pool connection limit |
| `HOCUSPOCUS_PORT` / `PORT` | `1234` | WebSocket listen port |
| `HOCUSPOCUS_ADDRESS` | `0.0.0.0` | Bind address |
| `HOCUSPOCUS_NAME` | `freedraw-hocuspocus` | Instance name (logging) |
| `HOCUSPOCUS_TIMEOUT` | `30000` | Ping timeout (ms) |
| `HOCUSPOCUS_DEBOUNCE` | `2000` | `onStoreDocument` debounce (ms) |
| `HOCUSPOCUS_MAX_DEBOUNCE` | `10000` | Max `onStoreDocument` debounce (ms) |
| `HOCUSPOCUS_QUIET` | `false` | Suppress the start screen |
| `HOCUSPOCUS_SEQ_MAX_RETRIES` | `5` | Duplicate-seq append retries |
| `HOCUSPOCUS_STAMP_ASSETS` | `true` | Stamp `page_assets.referenced_at` on store |
| `HOCUSPOCUS_PRUNE_SNAPSHOTS` | `true` | Prune superseded auto snapshots on store |

## Scripts

```bash
npm install        # install dependencies (isolated from the Laravel app)
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # compile src/ to dist/
npm start          # node dist/server.js (after build)
npm run dev        # run src/server.ts directly (Node type-stripping)
```

## Notes / prerequisites

- This service depends on the schema created by the Laravel migrations
  (`pages`, `page_updates`, `page_snapshots`, `page_assets`).
- `HOCUSPOCUS_STAMP_ASSETS` requires a `page_assets.referenced_at` (nullable
  timestamp) column. That column is **not** part of the current schema and must
  be added by a Laravel migration before enabling the stamp; the stamp step is
  wrapped in error handling so a missing column degrades gracefully instead of
  breaking compaction.
- A given room should be served by a single Hocuspocus instance. Horizontal
  scaling of the same room requires sticky routing or the Hocuspocus Redis
  extension, which is out of scope for this service.
