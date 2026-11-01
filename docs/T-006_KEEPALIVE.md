# T-006 related — Keep Free Supabase project awake

## Fact
Free projects pause after ~7 days of insufficient database activity.  
Resume is manual from the dashboard (window ~1 year). Data is not lost on pause.

## Goal
Avoid surprise downtime during holidays / summer without paying for Pro.

## Recommended approach (fully free)

### Option 1 — GitHub Actions (preferred)
Private workflow in this repo (or a tiny separate repo) that once or twice a week:

1. Calls a lightweight Edge Function `health` **or**
2. Hits the REST endpoint with the **anon** key:  
   `GET https://dtpyvyedcptdkdsowmco.supabase.co/rest/v1/subjects?select=id&limit=1`  
   Header: `apikey: <ANON_KEY>` and `Authorization: Bearer <ANON_KEY>`

Store the anon key only in GitHub Actions secrets (`SUPABASE_ANON_KEY`, `SUPABASE_URL`).  
**Never** commit the key.

Example schedule: `cron: '0 9 * * 1,4'` (Mon + Thu 09:00 UTC).

### Option 2 — Manual
Owner opens the dashboard or the future PWA at least once a week.

### Option 3 — External free cron
Any free cron (cron-job.org, etc.) that pings the same URL.

## Do not
- Rely on `pg_cron` alone (it dies when the project is paused).
- Put service-role key in Actions or the client.

## Status
PLANNED until owner chooses option and (if needed) ChatGPT adds the Edge Function + workflow file.
