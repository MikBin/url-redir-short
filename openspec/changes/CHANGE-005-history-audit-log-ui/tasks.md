# Implementation Tasks: History and Audit Log UI

## Task 1: Database Schema
**File:** `admin-service/supabase/schema.sql`
- [ ] Add `link_audit_log` table with columns: id, link_id, action, actor_id, changes (JSONB), created_at
- [ ] Create `audit_link_changes()` trigger function
- [ ] Attach trigger to `links` table for INSERT, UPDATE, DELETE
- [ ] Add indexes on link_id and created_at
- [ ] Test: INSERT link → audit row created with action='create'
- [ ] Test: UPDATE link → audit row with field diffs
- [ ] Test: DELETE link → audit row with snapshot

## Task 2: History API Endpoint
**File:** `admin-service/supabase/server/api/links/[id]/history.get.ts`
- [ ] Query `link_audit_log` by link_id, ordered by created_at DESC
- [ ] Pagination: `page` and `perPage` query params
- [ ] Filter by `action` query param (optional)
- [ ] Join actor_id with auth.users for display name
- [ ] Zod validation for query params
- [ ] Integration tests: pagination, filtering, empty results

## Task 3: AuditLog Vue Component
**File:** `admin-service/supabase/app/components/AuditLog.vue`
- [ ] Timeline layout with chronological entries
- [ ] Action badge: green (create), yellow (update), red (delete)
- [ ] Diff view: show changed fields with before/after values
- [ ] Filter buttons: All | Created | Updated | Deleted
- [ ] Pagination controls at bottom
- [ ] Empty state: "No history recorded"

## Task 4: Link Detail Integration
**File:** `admin-service/supabase/app/pages/index.vue`
- [ ] Add "History" tab to link detail panel
- [ ] Render AuditLog component with link ID prop
- [ ] Fetch history on tab activation
- [ ] E2E test: create link → edit → view history tab → verify entries