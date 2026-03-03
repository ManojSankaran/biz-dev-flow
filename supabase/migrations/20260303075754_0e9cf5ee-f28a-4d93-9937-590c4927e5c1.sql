
-- Fix: allow changed_by to be null or use a fallback in the trigger
CREATE OR REPLACE FUNCTION public.version_requirement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    VALUES (OLD.id, next_version, OLD.title, OLD.description, OLD.priority::text, OLD.workflow_status::text, 
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object('title', OLD.title, 'description', OLD.description, 'priority', OLD.priority, 'workflow_status', OLD.workflow_status));
  END IF;
  RETURN NEW;
END;
$$;
