# T-043 — Backup / export on Free plan

## Fact
Supabase Free has **no automatic daily backups**.  
If you drop a table or corrupt data, there is no restore button.

## Goal
Periodic export of schema + data that the owner can keep offline or in a private archive.

## Recommended approach (free)

### 1. Schema always in git
Migrations in `supabase/migrations/` are the source of truth for structure.  
Already done.

### 2. Data export (synthetic + later real operational data)

**Manual (now):**
```bash
# Requires Supabase CLI linked to the project (owner machine)
supabase db dump --data-only -f backup_data_$(date +%Y%m%d).sql
# or full
supabase db dump -f backup_full_$(date +%Y%m%d).sql
```

Store the file outside the public repo (private drive / private GitHub release / encrypted archive).

**Scheduled (later):**
- GitHub Action with CLI + project access token (careful: treat as secret).
- Or owner runs dump weekly before holidays.

### 3. What to export
- All `public` tables (students are synthetic in seed; later real lists stay off public git).
- Never commit dumps that contain real pupil names to a public repository.

### 4. Restore drill
Once: restore a dump into a **second** free project or local Postgres to prove the file works.

## Status
PLANNED. Owner decides cadence (weekly / before long breaks).  
Grok can add a small script under `scripts/export.sh` when asked.
