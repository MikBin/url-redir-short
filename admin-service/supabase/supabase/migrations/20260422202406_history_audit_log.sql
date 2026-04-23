-- Migration: history_audit_log
-- Description: Adds audit logging for link operations

-- ==============================================================================
-- UP MIGRATION
-- ==============================================================================

CREATE TABLE public.link_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES public.links(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  actor_id UUID REFERENCES auth.users(id),
  changes JSONB,  -- { field: { before: old, after: new } }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_link_id ON public.link_audit_log(link_id);
CREATE INDEX idx_audit_log_created_at ON public.link_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.link_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for link_audit_log
CREATE POLICY "Users can view audit logs for their links"
ON public.link_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.links
    WHERE id = link_audit_log.link_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage audit logs"
ON public.link_audit_log FOR ALL
USING (auth.role() = 'service_role');

-- Automatic Trigger
CREATE OR REPLACE FUNCTION public.audit_link_changes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.link_audit_log (link_id, action, actor_id, changes)
    VALUES (NEW.id, 'create', NEW.owner_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.link_audit_log (link_id, action, actor_id, changes)
    VALUES (NEW.id, 'update', NEW.owner_id,
      (SELECT jsonb_object_agg(key, jsonb_build_object('before', old_val, 'after', new_val))
       FROM jsonb_each_text(to_jsonb(OLD)) AS t(key, old_val)
       JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, new_val)
       USING (key) WHERE old_val IS DISTINCT FROM new_val));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.link_audit_log (link_id, action, actor_id, changes)
    VALUES (OLD.id, 'delete', OLD.owner_id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_links_trigger
BEFORE DELETE OR AFTER INSERT OR UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.audit_link_changes();

-- ==============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- ==============================================================================
/*
-- Rollback instructions:
-- Put the SQL to revert the above changes here.

DROP TRIGGER IF EXISTS audit_links_trigger ON public.links;
DROP FUNCTION IF EXISTS public.audit_link_changes();
DROP TABLE IF EXISTS public.link_audit_log;

*/
