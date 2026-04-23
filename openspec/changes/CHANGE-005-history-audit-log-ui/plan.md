# Implementation Plan: History and Audit Log UI

## Phase 1: Database Schema (Day 1)
- [x] Add `link_audit_log` table to `schema.sql`
- [x] Create audit trigger function on `links` table
- [x] Attach trigger to INSERT, UPDATE, DELETE on `links`
- [x] Verify trigger fires correctly with manual SQL test

## Phase 2: API Endpoint (Day 1)
- [x] Create `admin-service/supabase/server/api/links/[id]/history.get.ts`
- [x] Query `link_audit_log` filtered by `link_id`
- [x] Pagination support (page, perPage)
- [x] Action type filtering
- [x] Join actor_id with auth.users for display name
- [x] API integration tests

## Phase 3: UI Component (Day 2)
- [x] Create `admin-service/supabase/app/components/AuditLog.vue`
- [x] Timeline view with color-coded action badges
- [x] Diff display for field changes
- [x] Filter buttons (All/Created/Updated/Deleted)
- [x] Pagination controls

## Phase 4: Integration (Day 2)
- [x] Add "History" tab to link detail view
- [x] Wire up to history API endpoint
- [x] Test full flow: edit link → see entry in audit log
- [x] E2E test: create, update, delete link, verify audit trail