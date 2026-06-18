
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- remove old jobs if present
DO $$
BEGIN
  PERFORM cron.unschedule('coach-daily-tip');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('coach-pre-session');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'coach-daily-tip',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--0c21fc33-4089-4e57-8a73-9c59a404077e.lovable.app/api/public/hooks/daily-tip',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_LapBJIrtU81QKfWI_MWrMg_HvdrtJFn"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'coach-pre-session',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--0c21fc33-4089-4e57-8a73-9c59a404077e.lovable.app/api/public/hooks/pre-session',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_LapBJIrtU81QKfWI_MWrMg_HvdrtJFn"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
