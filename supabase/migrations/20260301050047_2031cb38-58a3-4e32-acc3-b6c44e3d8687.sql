
-- Create project_conversations table for scoping chat
CREATE TABLE public.project_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track whether scoping is finalized
ALTER TABLE public.projects ADD COLUMN scoping_status TEXT NOT NULL DEFAULT 'not_started' CHECK (scoping_status IN ('not_started', 'in_progress', 'completed'));

-- Enable RLS
ALTER TABLE public.project_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project conversations"
  ON public.project_conversations FOR SELECT
  USING (is_project_owner(project_id));

CREATE POLICY "Users can insert own project conversations"
  ON public.project_conversations FOR INSERT
  WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Users can delete own project conversations"
  ON public.project_conversations FOR DELETE
  USING (is_project_owner(project_id));

-- Index for fast lookups
CREATE INDEX idx_project_conversations_project_id ON public.project_conversations(project_id, created_at);
