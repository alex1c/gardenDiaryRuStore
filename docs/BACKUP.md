# Backup and restore (format v1)

«Моя дача» uses a **JSON domain backup** (`garden-diary-backup`, version **1**). This is separate from the SQLite schema version (currently v4).

## What is included

- All persisted user tables: gardens, seasons, areas, catalog, garden plants, plantings, tasks, events, harvests, expenses, photo metadata, app settings.
- **Photo files**: owned images under `documentDirectory/garden-photos/` are embedded as base64 in `data.photoFiles` keyed by `garden_photos.id`.

## What is not included

- Derived stats (recomputed after restore).
- Transient picker URIs for photos that were never copied into app storage.

## Restore semantics

Restore **replaces** all current data after validation and explicit user confirmation. The operation is atomic at the SQLite level: failure rolls back DB changes; staged photo files are cleaned up on failure.

## CSV export

CSV is a human-readable export for Excel/archiving. It is **not** restorable. UTF-8 with BOM, semicolon separator.
