# Implementation Plan: UTM Parameter Management UI

## Phase 1: UTM Builder Component (Day 1)
- [ ] Create `admin-service/supabase/app/components/UtmBuilder.vue`
- [ ] Input fields for source, medium, campaign, term, content
- [ ] Live URL preview with UTM params appended
- [ ] Validation (required fields, charset, length)
- [ ] Auto-replace spaces with underscores on blur

## Phase 2: UTM Templates (Day 1)
- [ ] Template save/load from localStorage
- [ ] Template dropdown in builder
- [ ] Save/delete template UI
- [ ] Max 20 templates stored locally

## Phase 3: Integration with Link Forms (Day 2)
- [ ] Add collapsible "UTM Parameters" section to link create form
- [ ] Add same section to link edit form
- [ ] On submit, merge UTM params into destination URL
- [ ] On edit load, parse existing UTM params from URL into fields
- [ ] Test create + edit flows with UTM params

## Phase 4: Testing (Day 2)
- [ ] Unit tests: UTM validation, URL building, template save/load
- [ ] Component test: UtmBuilder renders, validates, previews
- [ ] Integration test: create link with UTM, verify stored URL