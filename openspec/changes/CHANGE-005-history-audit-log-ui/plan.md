# Implementation Plan: History and Audit Log UI

## Phase 1: Database Schema (Day 1)
- [ ] Add `link_audit_log` table to `schema.sql`
- [ ] Create audit trigger function on `links` table
- [ ] Attach trigger to INSERT, UPDATE, DELETE on `links`
- [ ] Verify trigger fires correctly with manual SQL test

## Phase 2: API Endpoint (Day 1)
- [ ] Create `admin-service/supabase/server/api/links/[id]/history.get.ts`
- [ ] Query `link_audit_log` filtered by `link_id`
- [ ] Pagination support (page, perPage)
- [ ] Action type filtering
- [ ] Join actor_id with auth.users for display name
- [ ] API integration tests

## Phase 3: UI Component (Day 2)
- [ ] Create `admin-service/supabase/app/components/AuditLog.vue`
- [ ] Timeline view with color-coded action badges
- [ ] Diff display for field changes
- [ ] Filter buttons (All/Created/Updated/Deleted)
- [ ] Pagination controls

## Phase 4: Integration (Day 2)
- [ ] Add "History" tab to link detail view
- [ ] Wire up to history API endpoint
- [ ] Test full flow: edit link → see entry in audit log
- [ ] E2E test: create, update, delete link, verify audit trail