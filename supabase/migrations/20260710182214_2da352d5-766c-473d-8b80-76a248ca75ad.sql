UPDATE public.evidences
SET verification_url = replace(verification_url, '/verify?id=', '/verificar?id=')
WHERE verification_url LIKE '%/verify?id=%';