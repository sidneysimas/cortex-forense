
-- Explicit Data API grants for every public table.
-- All RLS policies target the `authenticated` role and scope by auth.uid()
-- or org membership, so anon needs no direct access. Public sharing flows
-- go through SECURITY DEFINER functions (verify_evidence_public,
-- get_shared_link_bundle) that already have their own controlled EXECUTE grants.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'audit_logs','cases','evidence_access_log','evidence_versions','evidences',
    'notification_queue','org_invites','org_members','organizations','profiles',
    'shared_links','smtp_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
