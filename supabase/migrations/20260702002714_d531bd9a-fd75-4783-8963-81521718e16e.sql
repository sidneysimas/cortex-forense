CREATE OR REPLACE FUNCTION public.enforce_evidence_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.file_hash IS DISTINCT FROM OLD.file_hash
     OR NEW.input_content IS DISTINCT FROM OLD.input_content
     OR NEW.result_content IS DISTINCT FROM OLD.result_content
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.module IS DISTINCT FROM OLD.module
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Evidência imutável (ISO/IEC 27037): conteúdo evidencial não pode ser alterado após o registro.'
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
$$;

DROP TRIGGER IF EXISTS trg_evidence_immutability ON public.evidences;
CREATE TRIGGER trg_evidence_immutability
BEFORE UPDATE ON public.evidences
FOR EACH ROW
EXECUTE FUNCTION public.enforce_evidence_immutability();