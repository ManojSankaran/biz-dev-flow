
-- Table to store DevOps configuration per project
CREATE TABLE public.project_devops_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'github',
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  auth_token TEXT,
  username TEXT,
  project_structure TEXT NOT NULL DEFAULT 'sfdx',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.project_devops_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project devops config"
  ON public.project_devops_config FOR SELECT
  USING (is_project_owner(project_id));

CREATE POLICY "Users can insert own project devops config"
  ON public.project_devops_config FOR INSERT
  WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Users can update own project devops config"
  ON public.project_devops_config FOR UPDATE
  USING (is_project_owner(project_id));

CREATE POLICY "Users can delete own project devops config"
  ON public.project_devops_config FOR DELETE
  USING (is_project_owner(project_id));

CREATE TRIGGER update_project_devops_config_updated_at
  BEFORE UPDATE ON public.project_devops_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
