
-- Workflow status enum for requirements
CREATE TYPE public.workflow_status AS ENUM (
  'pending_ba_approval',
  'ba_approved',
  'generating_design',
  'pending_architect_approval',
  'architect_approved',
  'in_development',
  'completed'
);

-- Add workflow_status to requirements
ALTER TABLE public.requirements
ADD COLUMN workflow_status public.workflow_status NOT NULL DEFAULT 'pending_ba_approval';

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ba_approval_needed', 'architect_approval_needed', 'approved', 'design_ready'
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

-- Service role inserts notifications, but also allow project owners
CREATE POLICY "Users can insert notifications for own projects"
ON public.notifications FOR INSERT
WITH CHECK (is_project_owner(project_id));

-- Technical designs table
CREATE TABLE public.technical_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view technical designs"
ON public.technical_designs FOR SELECT
USING (can_access_requirement(requirement_id));

CREATE POLICY "Users can insert technical designs"
ON public.technical_designs FOR INSERT
WITH CHECK (can_access_requirement(requirement_id));

CREATE POLICY "Users can update technical designs"
ON public.technical_designs FOR UPDATE
USING (can_access_requirement(requirement_id));

-- Trigger for updated_at on technical_designs
CREATE TRIGGER update_technical_designs_updated_at
BEFORE UPDATE ON public.technical_designs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
