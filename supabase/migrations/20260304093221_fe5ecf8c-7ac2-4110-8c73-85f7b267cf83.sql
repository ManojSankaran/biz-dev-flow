
-- Enums for Salesforce-specific categorization
CREATE TYPE public.salesforce_cloud AS ENUM (
  'sales_cloud', 'service_cloud', 'experience_cloud', 'marketing_cloud',
  'commerce_cloud', 'analytics_cloud', 'platform', 'other'
);

CREATE TYPE public.component_type AS ENUM (
  'apex_class', 'apex_trigger', 'lwc', 'aura', 'flow',
  'validation_rule', 'custom_object', 'custom_field',
  'integration', 'report_dashboard', 'permission_set', 'other'
);

CREATE TYPE public.effort_size AS ENUM ('xs', 's', 'm', 'l', 'xl');

CREATE TYPE public.salesforce_edition AS ENUM (
  'developer', 'professional', 'enterprise', 'unlimited', 'performance'
);

CREATE TYPE public.org_type AS ENUM (
  'production', 'full_sandbox', 'partial_sandbox', 'developer_sandbox', 'scratch_org', 'developer_org'
);

-- Add new columns to requirements
ALTER TABLE public.requirements
  ADD COLUMN sf_cloud public.salesforce_cloud DEFAULT NULL,
  ADD COLUMN module_name TEXT DEFAULT NULL,
  ADD COLUMN component_type public.component_type DEFAULT NULL,
  ADD COLUMN effort_estimate public.effort_size DEFAULT NULL,
  ADD COLUMN depends_on UUID[] DEFAULT '{}';

-- Add new columns to projects
ALTER TABLE public.projects
  ADD COLUMN target_go_live DATE DEFAULT NULL,
  ADD COLUMN salesforce_edition public.salesforce_edition DEFAULT NULL,
  ADD COLUMN org_type public.org_type DEFAULT NULL,
  ADD COLUMN sandbox_url TEXT DEFAULT NULL;
