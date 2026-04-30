-- Disable the trigger temporarily to prevent recursion/conflict during manual setup
ALTER TABLE public.organizations DISABLE TRIGGER on_org_created;

-- Create the organization if it doesn't exist
INSERT INTO public.organizations (name, slug)
VALUES ('Cortex Forense', 'cortex-forense')
ON CONFLICT (slug) DO NOTHING;

-- Re-enable the trigger
ALTER TABLE public.organizations ENABLE TRIGGER on_org_created;

-- Create a helper function to setup admin roles for a specific email
-- This will be triggered once the user signs up
CREATE OR REPLACE FUNCTION public.setup_admin_by_email()
RETURNS trigger AS $$
BEGIN
  IF NEW.email = 'sidney@analysisti.com.br' THEN
    -- Find the organization
    DECLARE
      v_org_id UUID;
    BEGIN
      SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'cortex-forense' LIMIT 1;
      
      IF v_org_id IS NOT NULL THEN
        -- Add to organization as admin
        INSERT INTO public.org_members (org_id, user_id, role)
        VALUES (v_org_id, NEW.id, 'admin')
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a trigger to auth.users if possible (we do it on profiles for safety)
CREATE OR REPLACE TRIGGER on_profile_created_admin_setup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.setup_admin_by_email();
