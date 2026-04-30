-- Perfil do perito
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  registration_number TEXT DEFAULT '',
  area_of_expertise TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cases
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_number text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  court text DEFAULT '',
  status text NOT NULL DEFAULT 'em_andamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cases" ON public.cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cases" ON public.cases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cases" ON public.cases FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Evidences
CREATE TABLE public.evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  input_content TEXT DEFAULT '',
  result_content TEXT DEFAULT '',
  file_hash TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  tsa_timestamp text DEFAULT '',
  tsa_token text DEFAULT '',
  blockchain_tx text DEFAULT '',
  blockchain_network text DEFAULT '',
  verification_url text DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evidences" ON public.evidences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evidences" ON public.evidences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own evidences" ON public.evidences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view evidence for verification" ON public.evidences FOR SELECT TO anon USING (true);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('forensic-files', 'forensic-files', false);
CREATE POLICY "Users can upload own files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'forensic-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'forensic-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'forensic-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Evidence versions
CREATE TABLE public.evidence_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_id UUID NOT NULL REFERENCES public.evidences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  input_content TEXT DEFAULT '',
  result_content TEXT DEFAULT '',
  file_hash TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  change_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evidence versions" ON public.evidence_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evidence versions" ON public.evidence_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Shared links
CREATE TABLE public.shared_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES public.evidences(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  max_views INTEGER DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own shared links" ON public.shared_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view active shared links by token" ON public.shared_links FOR SELECT TO anon USING (is_active = true AND expires_at > now());

-- SMTP config
CREATE TABLE public.smtp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT '',
  smtp_pass TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT 'Cortex Forense',
  use_tls BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own smtp config" ON public.smtp_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own smtp config" ON public.smtp_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own smtp config" ON public.smtp_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notification queue
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  evidence_id UUID REFERENCES public.evidences(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  error_message TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notification_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notification_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Evidence access log (ISO 27037)
CREATE TABLE public.evidence_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID REFERENCES public.evidences(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL DEFAULT 'view',
  ip_address TEXT,
  user_agent TEXT,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view access logs of their own evidences" ON public.evidence_access_log FOR SELECT TO authenticated USING (user_id = auth.uid() OR evidence_id IN (SELECT id FROM public.evidences WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert access logs" ON public.evidence_access_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Multi-tenancy: organizations
CREATE TYPE public.org_role AS ENUM ('admin', 'perito', 'assistente');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'perito',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'perito',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cases ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.evidences ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id)
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_role(_user_id uuid, _org_id uuid, _role org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = _org_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.org_members WHERE user_id = _user_id
$$;

CREATE POLICY "Members can view their orgs" ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Admins can update their org" ON public.organizations FOR UPDATE TO authenticated USING (public.user_has_org_role(auth.uid(), id, 'admin')) WITH CHECK (public.user_has_org_role(auth.uid(), id, 'admin'));
CREATE POLICY "Authenticated users can create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Members can view org members" ON public.org_members FOR SELECT TO authenticated USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Admins can insert members" ON public.org_members FOR INSERT TO authenticated WITH CHECK (public.user_has_org_role(auth.uid(), org_id, 'admin') OR user_id = auth.uid());
CREATE POLICY "Admins can update members" ON public.org_members FOR UPDATE TO authenticated USING (public.user_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "Admins can delete members" ON public.org_members FOR DELETE TO authenticated USING (public.user_has_org_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Org members can view invites" ON public.org_invites FOR SELECT TO authenticated USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Admins can create invites" ON public.org_invites FOR INSERT TO authenticated WITH CHECK (public.user_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "Admins can delete invites" ON public.org_invites FOR DELETE TO authenticated USING (public.user_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "Anyone can view invite by token" ON public.org_invites FOR SELECT TO anon USING (accepted_at IS NULL AND expires_at > now());

CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (NEW.id, auth.uid(), 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_org_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();