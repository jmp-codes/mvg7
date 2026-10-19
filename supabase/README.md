# Supabase setup (G7)
1. SQL Editor > New query > paste `schema.sql` > Run.
2. Authentication > Users > Add user (your admin email + password, tick Auto Confirm). The first account becomes the Administrator.
3. Edge Function `staff-admin`: Edge Functions > Deploy a new function (via Editor) > name `staff-admin` > paste `functions/staff-admin/index.ts` > Deploy. Leave "Verify JWT" on.
The website only ever uses the Project URL and the publishable key. Never put the secret/service_role key in any website file.

If you ran an earlier version of schema.sql, run the new one again (it is safe to repeat) and redeploy the staff-admin function.

## Update: dates open for booking
Re-run `schema.sql` in the SQL Editor (safe to run again). It adds the `openDates` setting and makes the server reject bookings on dates the office has not opened. Until the office sets ranges, today through the next 30 days are open.
