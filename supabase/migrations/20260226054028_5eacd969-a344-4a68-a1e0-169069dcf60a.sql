
-- Create agent_outputs table to store AI-generated content per agent per requirement
CREATE TABLE public.agent_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  content TEXT NOT NULL,
  output_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper function
CREATE POLICY "Users can view agent outputs" ON public.agent_outputs
  FOR SELECT USING (can_access_requirement(requirement_id));

CREATE POLICY "Users can insert agent outputs" ON public.agent_outputs
  FOR INSERT WITH CHECK (can_access_requirement(requirement_id));

CREATE POLICY "Users can update agent outputs" ON public.agent_outputs
  FOR UPDATE USING (can_access_requirement(requirement_id));

-- Timestamp trigger
CREATE TRIGGER update_agent_outputs_updated_at
  BEFORE UPDATE ON public.agent_outputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_agent_outputs_requirement ON public.agent_outputs(requirement_id, agent_name);
