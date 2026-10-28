# Fresh database setup

The migration history was consolidated on 2026-09-29 for a fresh database setup.
Columns, constraints, and indexes from incremental migrations now live in their
original table-creation migrations. Separate migrations remain for new tables
and domains, including carpooling. There are 48 migrations creating 85 application
tables.

From `server-app`, run `php artisan migrate:fresh` when ready to rebuild your
configured database. This drops existing tables and data. Add `--seed` if you
also want to run the configured database seeders.

This consolidated history is for fresh installs; it is not an upgrade path for
a database that already ran the old migration history. Data backfills for those
older databases have been removed. Future schema changes should use new migrations.

Validation: compared the original and consolidated schemas on an isolated SQLite
database (columns, types, defaults, nullability, indexes, and foreign keys), then
ran fresh migration and full rollback. No application database was rebuilt.
