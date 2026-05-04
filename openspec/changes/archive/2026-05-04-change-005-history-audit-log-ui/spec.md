# Specification: History and Audit Log UI

## Database Schema

### `link_audit_log` Table
```sql
CREATE TABLE link_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  actor_id UUID REFERENCES auth.users(id),
  changes JSONB,  -- { field: { before: old, after: new } }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_link_id ON link_audit_log(link_id);
CREATE INDEX idx_audit_log_created_at ON link_audit_log(created_at DESC);
```

### Automatic Trigger
```sql
CREATE OR REPLACE FUNCTION audit_link_changes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO link_audit_log (link_id, action, changes)
    VALUES (NEW.id, 'create', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO link_audit_log (link_id, action, changes)
    VALUES (NEW.id, 'update',
      (SELECT jsonb_object_agg(key, jsonb_build_object('before', old_val, 'after', new_val))
       FROM jsonb_each_text(to_jsonb(OLD)) AS t(key, old_val)
       JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, new_val)
       USING (key) WHERE old_val IS DISTINCT FROM new_val));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO link_audit_log (link_id, action, changes)
    VALUES (OLD.id, 'delete', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## API Endpoint

### `GET /api/links/:id/history`
- Returns paginated audit log entries for a link
- Query params: `page`, `perPage` (default 20), `action` (filter)
- Response: `{ entries: AuditEntry[], total: number }`

### Audit Entry Shape
```typescript
interface AuditEntry {
  id: string
  action: 'create' | 'update' | 'delete'
  actorId: string | null
  changes: Record<string, { before: any; after: any }>
  createdAt: string
}
```

## UI Component

### History Tab on Link Detail
- Tab: "History" alongside "Settings", "Analytics"
- Chronological list (newest first)
- Each entry: timestamp, action badge, actor name, changed fields diff
- Color-coded: green=create, yellow=update, red=delete
- Diff view: strikethrough old value, underline new value
- Filter buttons: All | Created | Updated | Deleted