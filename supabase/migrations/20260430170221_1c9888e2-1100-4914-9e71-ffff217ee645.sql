-- Recreate handle_new_user to also assign admin role for sidney's email, in one trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  -- If this is the designated admin email, attach to Cortex Forense org as admin
  IF NEW.email = 'sidney@analysisti.com.br' THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'cortex-forense' LIMIT 1;
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org_id, NEW.id, 'admin')
      ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup if anything goes wrong here
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure org_members has unique constraint for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_members_org_user_unique'
  ) THEN
    ALTER TABLE public.org_members
      ADD CONSTRAINT org_members_org_user_unique UNIQUE (org_id, user_id);
  END IF;
END $$;

-- Drop the now-redundant standalone function (no trigger was attached anyway)
DROP FUNCTION IF EXISTS public.setup_admin_by_email() CASCADE;