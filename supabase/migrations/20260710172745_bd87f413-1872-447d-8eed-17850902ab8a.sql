DROP TRIGGER IF EXISTS trg_evidence_immutability ON public.evidences;
DROP TRIGGER IF EXISTS enforce_evidence_immutability_on_update ON public.evidences;

CREATE OR REPLACE FUNCTION public.format_brasilia_timestamp(_ts timestamp with time zone)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT to_char(_ts AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS') || ' (BRT)'
$$;

CREATE OR REPLACE FUNCTION public.apply_brasilia_custody_metadata(_metadata jsonb, _created_at timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_metadata jsonb := COALESCE(_metadata, '{}'::jsonb);
  v_brt text := public.format_brasilia_timestamp(_created_at);
BEGIN
  IF v_metadata ? 'iso27037' THEN
    v_metadata := jsonb_set(v_metadata, '{iso27037,timezone}', to_jsonb('America/Sao_Paulo'::text), true);
    v_metadata := jsonb_set(v_metadata, '{iso27037,timezoneLabel}', to_jsonb('BRT/UTC-3'::text), true);
    v_metadata := jsonb_set(v_metadata, '{iso27037,acquisition,timestampBR}', to_jsonb(v_brt), true);
    v_metadata := jsonb_set(v_metadata, '{iso27037,acquisition,timezone}', to_jsonb('America/Sao_Paulo'::text), true);
    v_metadata := jsonb_set(v_metadata, '{iso27037,chainOfCustody,acquisitionTimeBR}', to_jsonb(v_brt), true);
    v_metadata := jsonb_set(v_metadata, '{iso27037,chainOfCustody,timezone}', to_jsonb('America/Sao_Paulo'::text), true);
  END IF;

  RETURN v_metadata;
END;
$$;

ALTER TABLE public.evidences ADD COLUMN IF NOT EXISTS created_at_brt text;
ALTER TABLE public.evidence_versions ADD COLUMN IF NOT EXISTS created_at_brt text;
ALTER TABLE public.evidence_access_log ADD COLUMN IF NOT EXISTS created_at_brt text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at_brt text;

UPDATE public.evidences
SET created_at_brt = public.format_brasilia_timestamp(created_at),
    metadata = public.apply_brasilia_custody_metadata(metadata, created_at)
WHERE created_at_brt IS DISTINCT FROM public.format_brasilia_timestamp(created_at)
   OR metadata IS DISTINCT FROM public.apply_brasilia_custody_metadata(metadata, created_at);

UPDATE public.evidence_versions
SET created_at_brt = public.format_brasilia_timestamp(created_at),
    metadata = public.apply_brasilia_custody_metadata(metadata, created_at)
WHERE created_at_brt IS DISTINCT FROM public.format_brasilia_timestamp(created_at)
   OR metadata IS DISTINCT FROM public.apply_brasilia_custody_metadata(metadata, created_at);

UPDATE public.evidence_access_log
SET created_at_brt = public.format_brasilia_timestamp(created_at)
WHERE created_at_brt IS DISTINCT FROM public.format_brasilia_timestamp(created_at);

UPDATE public.audit_logs
SET created_at_brt = public.format_brasilia_timestamp(created_at)
WHERE created_at_brt IS DISTINCT FROM public.format_brasilia_timestamp(created_at);

ALTER TABLE public.evidences ALTER COLUMN created_at_brt SET DEFAULT public.format_brasilia_timestamp(now());
ALTER TABLE public.evidence_versions ALTER COLUMN created_at_brt SET DEFAULT public.format_brasilia_timestamp(now());
ALTER TABLE public.evidence_access_log ALTER COLUMN created_at_brt SET DEFAULT public.format_brasilia_timestamp(now());
ALTER TABLE public.audit_logs ALTER COLUMN created_at_brt SET DEFAULT public.format_brasilia_timestamp(now());

ALTER TABLE public.evidences ALTER COLUMN created_at_brt SET NOT NULL;
ALTER TABLE public.evidence_versions ALTER COLUMN created_at_brt SET NOT NULL;
ALTER TABLE public.evidence_access_log ALTER COLUMN created_at_brt SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN created_at_brt SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_brasilia_custody_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS set_evidences_brasilia_custody_timestamp ON public.evidences;
CREATE TRIGGER set_evidences_brasilia_custody_timestamp
BEFORE INSERT ON public.evidences
FOR EACH ROW
EXECUTE FUNCTION public.set_brasilia_custody_timestamp();

DROP TRIGGER IF EXISTS set_evidence_versions_brasilia_custody_timestamp ON public.evidence_versions;
CREATE TRIGGER set_evidence_versions_brasilia_custody_timestamp
BEFORE INSERT ON public.evidence_versions
FOR EACH ROW
EXECUTE FUNCTION public.set_brasilia_custody_timestamp();

DROP TRIGGER IF EXISTS set_evidence_access_log_brasilia_custody_timestamp ON public.evidence_access_log;
CREATE TRIGGER set_evidence_access_log_brasilia_custody_timestamp
BEFORE INSERT ON public.evidence_access_log
FOR EACH ROW
EXECUTE FUNCTION public.set_brasilia_custody_timestamp();

DROP TRIGGER IF EXISTS set_audit_logs_brasilia_custody_timestamp ON public.audit_logs;
CREATE TRIGGER set_audit_logs_brasilia_custody_timestamp
BEFORE INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_brasilia_custody_timestamp();

CREATE OR REPLACE FUNCTION public.enforce_evidence_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.file_hash IS DISTINCT FROM OLD.file_hash
     OR NEW.input_content IS DISTINCT FROM OLD.input_content
     OR NEW.result_content IS DISTINCT FROM OLD.result_content
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.module IS DISTINCT FROM OLD.module
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_at_brt IS DISTINCT FROM OLD.created_at_brt
  THEN
    RAISE EXCEPTION 'Evidência imutável (ISO/IEC 27037): conteúdo evidencial e cadeia de custódia não podem ser alterados após o registro.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(OLD.tsa_timestamp, '') <> '' AND NEW.tsa_timestamp IS DISTINCT FROM OLD.tsa_timestamp THEN
    RAISE EXCEPTION 'Evidência já certificada: carimbo de tempo (TSA) não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(OLD.tsa_token, '') <> '' AND NEW.tsa_token IS DISTINCT FROM OLD.tsa_token THEN
    RAISE EXCEPTION 'Evidência já certificada: token TSA não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(OLD.blockchain_tx, '') <> '' AND NEW.blockchain_tx IS DISTINCT FROM OLD.blockchain_tx THEN
    RAISE EXCEPTION 'Evidência já certificada: registro de ancoragem não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_evidence_immutability
BEFORE UPDATE ON public.evidences
FOR EACH ROW
EXECUTE FUNCTION public.enforce_evidence_immutability();