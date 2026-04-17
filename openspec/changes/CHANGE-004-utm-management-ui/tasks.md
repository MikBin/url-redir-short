# Implementation Tasks: UTM Parameter Management UI

## Task 1: UTM Builder Vue Component
**File:** `admin-service/supabase/app/components/UtmBuilder.vue`
- [ ] Create component with 5 input fields (source, medium, campaign, term, content)
- [ ] Live URL preview computed property
- [ ] Validation: required fields marked, charset enforcement, max length
- [ ] Auto-replace spaces with underscores on blur
- [ ] "Copy URL" button
- [ ] Component tests

## Task 2: UTM Template Manager
**File:** `admin-service/supabase/app/composables/useUtmTemplates.ts`
- [ ] `saveTemplate(name, params)` — localStorage, max 20
- [ ] `loadTemplates()` — list all saved templates
- [ ] `applyTemplate(name)` — populate fields
- [ ] `deleteTemplate(name)` — remove from storage
- [ ] Template dropdown in UtmBuilder component

## Task 3: Link Form Integration
**File:** `admin-service/supabase/app/pages/index.vue`
- [ ] Add collapsible "UTM Parameters" section in create form
- [ ] Add same section in edit form
- [ ] On submit: merge UTM params into destination URL
- [ ] On edit: parse existing UTM params from URL into builder fields
- [ ] Test: create link with UTM, verify destination includes params
- [ ] Test: edit link, UTM fields pre-populated from existing URL