# Backup and Restore Strategy

This guide documents how to run PostgreSQL backups and restores for TZONA V2 using the shipped automation and standard `pg_dump`/`pg_restore` tools.

## Running backups

1. Ensure `DATABASE_URL` points at the target database. Optionally set `BACKUP_OUTPUT_DIR` to control where dumps land (defaults to `.backups/` in the repo root).
2. Run `npm run backup:database --prefix backend`.
3. The command invokes `pg_dump` with `--no-owner` and writes `backup-<timestamp>.sql` to the output directory. Keep the resulting SQL outside of git.

> Tip: schedule the command in cron or your CI with offsite storage to meet retention requirements.

## Restoring backups

1. Point `DATABASE_URL` at the restore target and ensure the database is empty or snapshot is acceptable.
2. Run `psql "$DATABASE_URL" -f <path-to-backup.sql>`.
3. Re-run `prisma generate` and any materialized view refresh scripts if needed after the restore.

## Retention and rotation

- Keep a minimum of daily backups for 7 days and weekly backups for 4 weeks; adjust per your SLA.
- Store dumps in encrypted storage with restricted access; never commit backups to git.
- Periodically test restores in a staging environment to validate dump integrity.

## Related scripts

- `npm run backup:database --prefix backend` — creates a SQL dump via `pg_dump`.
- `npm run audit:db-size --prefix backend` — generates `docs/database-size-report.md` with top table/index sizes to inform retention and partitioning.
