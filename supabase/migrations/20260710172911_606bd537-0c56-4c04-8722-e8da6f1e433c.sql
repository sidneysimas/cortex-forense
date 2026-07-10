CREATE OR REPLACE FUNCTION public.set_brasilia_custody_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.created_at_brt := public.format_brasilia_timestamp(NEW.created_at);

  IF TG_TABLE_NAME IN ('evidences', 'evidence_versions') THEN
    NEW.metadata := public.apply_brasilia_custody_metadata(NEW.metadata, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_brasilia_custody_timestamp() FROM anon, authenticated;