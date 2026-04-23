# Implementation Tasks: History and Audit Log UI

## Task 1: Database Schema
**File:** `admin-service/supabase/schema.sql`
- [x] Add `link_audit_log` table with columns: id, link_id, action, actor_id, changes (JSONB), created_at
- [x] Create `audit_link_changes()` trigger function
- [x] Attach trigger to `links` table for INSERT, UPDATE, DELETE
- [x] Add indexes on link_id and created_at
- [x] Test: INSERT link → audit row created with action='create'
- [x] Test: UPDATE link → audit row with field diffs
- [x] Test: DELETE link → audit row with snapshot

## Task 2: History API Endpoint
**File:** `admin-service/supabase/server/api/links/[id]/history.get.ts`
- [x] Query `link_audit_log` by link_id, ordered by created_at DESC
- [x] Pagination: `page` and `perPage` query params
- [x] Filter by `action` query param (optional)
- [x] Join actor_id with auth.users for display name
- [x] Zod validation for query params
- [x] Integration tests: pagination, filtering, empty results

## Task 3: AuditLog Vue Component
**File:** `admin-service/supabase/app/components/AuditLog.vue`
- [x] Timeline layout with chronological entries
- [x] Action badge: green (create), yellow (update), red (delete)
- [x] Diff view: show changed fields with before/after values
- [x] Filter buttons: All | Created | Updated | Deleted
- [x] Pagination controls at bottom
- [x] Empty state: "No history recorded"

## Task 4: Link Detail Integration
**File:** `admin-service/supabase/app/pages/index.vue`
- [x] Add "History" tab to link detail panel
- [x] Render AuditLog component with link ID prop
- [x] Fetch history on tab activation
- [x] E2E test: create link → edit → view history tab → verify entries