
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create project_stakeholders table
CREATE TABLE public.project_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create project_artifacts table
CREATE TABLE public.project_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent status enum
CREATE TYPE public.agent_status AS ENUM ('pending', 'in-progress', 'completed', 'failed');

-- Create priority enum
CREATE TYPE public.requirement_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create requirements table
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority requirement_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create requirement_agents table
CREATE TABLE public.requirement_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_icon TEXT NOT NULL DEFAULT 'Code',
  status agent_status NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_agents ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user owns a project
CREATE OR REPLACE FUNCTION public.is_project_owner(project_id_input UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_id_input AND owner_id = auth.uid()
  )
$$;

-- Helper function: check if user can access a requirement
CREATE OR REPLACE FUNCTION public.can_access_requirement(requirement_id_input UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requirements r
    JOIN public.projects p ON p.id = r.project_id
    WHERE r.id = requirement_id_input AND p.owner_id = auth.uid()
  )
$$;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth_id = auth.uid());

-- Projects RLS
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (owner_id = auth.uid());

-- Stakeholders RLS
CREATE POLICY "Users can view project stakeholders" ON public.project_stakeholders FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Users can add project stakeholders" ON public.project_stakeholders FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Users can update project stakeholders" ON public.project_stakeholders FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Users can delete project stakeholders" ON public.project_stakeholders FOR DELETE USING (public.is_project_owner(project_id));

-- Artifacts RLS
CREATE POLICY "Users can view project artifacts" ON public.project_artifacts FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Users can add project artifacts" ON public.project_artifacts FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Users can update project artifacts" ON public.project_artifacts FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Users can delete project artifacts" ON public.project_artifacts FOR DELETE USING (public.is_project_owner(project_id));

-- Requirements RLS
CREATE POLICY "Users can view project requirements" ON public.requirements FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Users can add project requirements" ON public.requirements FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Users can update project requirements" ON public.requirements FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Users can delete project requirements" ON public.requirements FOR DELETE USING (public.is_project_owner(project_id));

-- Requirement Agents RLS
CREATE POLICY "Users can view requirement agents" ON public.requirement_agents FOR SELECT USING (public.can_access_requirement(requirement_id));
CREATE POLICY "Users can add requirement agents" ON public.requirement_agents FOR INSERT WITH CHECK (public.can_access_requirement(requirement_id));
CREATE POLICY "Users can update requirement agents" ON public.requirement_agents FOR UPDATE USING (public.can_access_requirement(requirement_id));
CREATE POLICY "Users can delete requirement agents" ON public.requirement_agents FOR DELETE USING (public.can_access_requirement(requirement_id));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON public.requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requirement_agents_updated_at BEFORE UPDATE ON public.requirement_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for artifacts (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('project-artifacts', 'project-artifacts', false);

-- Storage policies
CREATE POLICY "Users can upload artifacts to own projects"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own project artifacts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own project artifacts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);
