-- Run once in the project's SQL editor. The app uses only a public API key.
-- Administrator access requires this exact email to be verified by Supabase Auth.
BEGIN;
CREATE SCHEMA IF NOT EXISTS touchline_private;
REVOKE ALL ON SCHEMA touchline_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA touchline_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.touchline_season (
 id smallint PRIMARY KEY CHECK (id = 1),
 payload text NOT NULL CHECK (coalesce((
  octet_length(payload) <= 800000
  AND (payload::jsonb)->>'version' = '1'
  AND jsonb_typeof((payload::jsonb)->'players') = 'array'
  AND jsonb_typeof((payload::jsonb)->'matches') = 'array'
 ),false)),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1)
);
INSERT INTO public.touchline_season(id,payload,revision)
VALUES (1,'{"version":1,"players":[],"matches":[]}',1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS touchline_private.season_history (
 revision bigint PRIMARY KEY,
 payload text NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON touchline_private.season_history FROM PUBLIC,anon,authenticated;
ALTER TABLE touchline_private.season_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION touchline_private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = (SELECT auth.uid())
   AND lower(email) = 'rashed.bayani@gmail.com'
   AND email_confirmed_at IS NOT NULL
 );
$$;
REVOKE ALL ON FUNCTION touchline_private.is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION touchline_private.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.touchline_can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT touchline_private.is_admin();
$$;
REVOKE ALL ON FUNCTION public.touchline_can_edit() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.touchline_can_edit() TO authenticated;

ALTER TABLE public.touchline_season ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.touchline_season FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.touchline_season TO anon,authenticated;
GRANT UPDATE(payload) ON public.touchline_season TO authenticated;
DROP POLICY IF EXISTS "Anyone can view results" ON public.touchline_season;
CREATE POLICY "Anyone can view results" ON public.touchline_season FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS "Only the verified organizer can update" ON public.touchline_season;
CREATE POLICY "Only the verified organizer can update" ON public.touchline_season FOR UPDATE TO authenticated
 USING ((SELECT touchline_private.is_admin())) WITH CHECK ((SELECT touchline_private.is_admin()));

CREATE OR REPLACE FUNCTION touchline_private.save_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 NEW.revision := OLD.revision + 1;
 INSERT INTO touchline_private.season_history(revision,payload) VALUES(OLD.revision,OLD.payload);
 DELETE FROM touchline_private.season_history WHERE revision < NEW.revision - 100;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION touchline_private.save_revision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS touchline_save_revision ON public.touchline_season;
CREATE TRIGGER touchline_save_revision BEFORE UPDATE ON public.touchline_season
FOR EACH ROW EXECUTE FUNCTION touchline_private.save_revision();
COMMIT;
