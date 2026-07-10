UPDATE public.evidences
SET verification_url = 'https://forense360.cortexbinario.com.br/verify?id=' || id
WHERE verification_url IS NULL
   OR verification_url = ''
   OR verification_url LIKE '%cortexforense.app%'
   OR verification_url LIKE '%digital-truth-uncovered%'
   OR verification_url LIKE '%lovable.app%'
   OR verification_url LIKE '%lovable.dev%';