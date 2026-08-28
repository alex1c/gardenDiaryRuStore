# Backup and restore (format v1)

«Моя дача» uses a **JSON domain backup** (`garden-diary-backup`, version **1**). This is separate from the SQLite schema version (currently v4).

## What is included

- All persisted user tables: gardens, seasons, areas, catalog, garden plants, plantings, tasks, events, harvests, expenses, photo metadata, app settings.
- **Photo files**: app-owned images under `documentDirectory/garden-photos/` are embedded as base64 in `data.photoFiles` keyed by `garden_photos.id`. Normal picker/camera ingestion copies images into this directory.

## What is not included

- Derived stats (recomputed after restore).
- Transient picker URIs for photos that were never copied into app storage.

External photo references are therefore metadata-only. A backup should not be described as containing every referenced external file.

Photo bytes encoded as base64 are roughly one third larger than the original files, and the JSON backup may temporarily require additional memory while it is created and shared. Very large photo libraries can therefore produce large backups or fail on memory-constrained devices.

## Restore semantics

Restore **replaces** all current data after validation and explicit user confirmation; it is not a merge. The operation is atomic at the SQLite level. Incoming photos use new, non-colliding app-owned paths before the database transaction. On failure, original database rows and original photo files remain intact; cleanup of newly staged files is best-effort and never takes precedence over data preservation.

Backup files remain local unless the user explicitly chooses a destination or app in the system share sheet. The app does not upload them to a cloud service itself.

## CSV export

CSV is a human-readable export for Excel/archiving. It is **not** restorable. UTF-8 with BOM, semicolon separator.
