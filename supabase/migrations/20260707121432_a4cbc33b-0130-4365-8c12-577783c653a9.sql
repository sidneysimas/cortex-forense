
-- 1) Drop public/permissive policies that leak data
DROP POLICY IF EXISTS "Public can view evidence for verification" ON public.evidences;
DROP POLICY IF EXISTS "Public can view active shared links by token" ON public.shared_links;
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.org_invites;

-- 2) Replace always-true INSERT policy on organizations
DROP POLICY IF EXISTS "Authenticated users can create org" ON public.organizations;
CREATE POLICY "Authenticated users can create org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Org-scoped read access for cases and evidences (fixes MISSING_ORG_SCOPE_RLS)
DROP POLICY IF EXISTS "Org members can view org cases" ON public.cases;
CREATE POLICY "Org members can view org cases"
  ON public.cases FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can view org evidences" ON public.evidences;
CREATE POLICY "Org members can view org evidences"
  ON public.evidences FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), org_id));

-- 4) Public verification RPC: only returns non-sensitive verification fields for a single ID
CREATE OR REPLACE FUNCTION public.verify_evidence_public(_id uuid)
RETURNS TABLE (
  id uuid,
  module text,
  title text,
  file_hash text,
  created_at timestamptz,
  tsa_timestamp text,
  tsa_token text,
  blockchain_tx text,
  blockchain_network text,
  verification_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.module, e.title, e.file_hash, e.created_at,
         e.tsa_timestamp, e.tsa_token, e.blockchain_tx, e.blockchain_network, e.verification_url
  FROM public.evidences e
  WHERE e.id = _id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_evidence_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_evidence_public(uuid) TO anon, authenticated;

-- 5) Shared-link RPC: validates exact token (+ optional password), respects expiry/max_views,
--    increments view_count, and returns bundle (link metadata without password_hash, case, evidences)
CREATE OR REPLACE FUNCTION public.get_shared_link_bundle(_token text, _password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links;
  v_pw_hex text;
  v_case jsonb;
  v_evidences jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT * INTO v_link FROM public.shared_links
   WHERE token = _token AND is_active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  IF v_link.max_views IS NOT NULL AND v_link.max_views > 0 AND v_link.view_count >= v_link.max_views THEN
    RETURN jsonb_build_object('error', 'max_views_reached');
  END IF;

  IF v_link.password_hash IS NOT NULL AND v_link.password_hash <> '' THEN
    IF _password IS NULL OR _password = '' THEN
      RETURN jsonb_build_object('needs_password', true);
    END IF;
    v_pw_hex := encode(extensions.digest(_password, 'sha256'), 'hex');
    IF v_pw_hex <> v_link.password_hash THEN
      RETURN jsonb_build_object('error', 'wrong_password');
    END IF;
  END IF;

  -- Increment view counter
  UPDATE public.shared_links SET view_count = view_count + 1 WHERE id = v_link.id;

  IF v_link.case_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_case FROM public.cases c WHERE c.id = v_link.case_id;
    SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
      INTO v_evidences
      FROM public.evidences e WHERE e.case_id = v_link.case_id;
  ELSIF v_link.evidence_id IS NOT NULL THEN
    v_case := NULL;
    SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      INTO v_evidences
      FROM public.evidences e WHERE e.id = v_link.evidence_id;
  ELSE
    v_evidences := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link.id,
      'expires_at', v_link.expires_at,
      'view_count', v_link.view_count + 1,
      'max_views', v_link.max_views,
      'case_id', v_link.case_id,
      'evidence_id', v_link.evidence_id
    ),
    'caseData', v_case,
    'evidences', v_evidences
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_link_bundle(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_link_bundle(text, text) TO anon, authenticated;

-- 6) Tighten EXECUTE on internal helpers/triggers
REVOKE ALL ON FUNCTION public.enforce_evidence_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_belongs_to_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_org_role(uuid, uuid, org_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_org_ids(uuid) FROM PUBLIC, anon;
-- Keep authenticated EXECUTE for RLS helpers (needed by policy evaluator under the calling role)
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_role(uuid, uuid, org_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids(uuid) TO authenticated;
