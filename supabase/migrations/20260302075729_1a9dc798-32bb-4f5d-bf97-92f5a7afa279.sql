
-- 1. RBAC: Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'business_analyst', 'architect', 'developer', 'viewer');

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND owner_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(p_project_id UUID)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1
$$;

CREATE POLICY "Owner and members can view project members"
  ON public.project_members FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Owner can manage project members"
  ON public.project_members FOR INSERT
  WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Owner can update project members"
  ON public.project_members FOR UPDATE
  USING (is_project_owner(project_id));

CREATE POLICY "Owner can delete project members"
  ON public.project_members FOR DELETE
  USING (is_project_owner(project_id));

-- 2. AUDIT TRAIL
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_project ON public.audit_logs(project_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_project_member(project_id) OR is_project_owner(project_id));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (is_project_member(project_id) OR is_project_owner(project_id));

-- 3. CHANGE CONTROL & VERSIONING
CREATE TABLE public.requirement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL,
  workflow_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, version_number)
);

CREATE INDEX idx_req_versions ON public.requirement_versions(requirement_id, version_number DESC);

ALTER TABLE public.requirement_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view requirement versions"
  ON public.requirement_versions FOR SELECT
  USING (can_access_requirement(requirement_id));

CREATE POLICY "Members can insert requirement versions"
  ON public.requirement_versions FOR INSERT
  WITH CHECK (can_access_requirement(requirement_id));

-- Trigger to auto-version requirements on update
CREATE OR REPLACE FUNCTION public.version_requirement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_version INT;
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.description IS DISTINCT FROM NEW.description
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.requirement_versions WHERE requirement_id = OLD.id;

    INSERT INTO public.requirement_versions (requirement_id, version_number, title, description, priority, workflow_status, changed_by, snapshot)
    VALUES (OLD.id, next_version, OLD.title, OLD.description, OLD.priority::text, OLD.workflow_status::text, auth.uid(),
      jsonb_build_object('title', OLD.title, 'description', OLD.description, 'priority', OLD.priority, 'workflow_status', OLD.workflow_status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_version_requirement
  BEFORE UPDATE ON public.requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.version_requirement();
