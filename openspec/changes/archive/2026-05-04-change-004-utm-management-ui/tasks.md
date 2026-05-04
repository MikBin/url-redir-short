# Implementation Tasks: UTM Parameter Management UI

## Task 1: UTM Builder Vue Component
**File:** `admin-service/supabase/app/components/UtmBuilder.vue`
- [x] Create component with 5 input fields (source, medium, campaign, term, content)
- [x] Live URL preview computed property
- [x] Validation: required fields marked, charset enforcement, max length
- [x] Auto-replace spaces with underscores on blur
- [x] "Copy URL" button
- [x] Component tests

## Task 2: UTM Template Manager
**File:** `admin-service/supabase/app/composables/useUtmTemplates.ts`
- [x] `saveTemplate(name, params)` — localStorage, max 20
- [x] `loadTemplates()` — list all saved templates
- [x] `applyTemplate(name)` — populate fields
- [x] `deleteTemplate(name)` — remove from storage
- [x] Template dropdown in UtmBuilder component

## Task 3: Link Form Integration
**File:** `admin-service/supabase/app/pages/index.vue`
- [x] Add collapsible "UTM Parameters" section in create form
- [x] Add same section in edit form
- [x] On submit: merge UTM params into destination URL
- [x] On edit: parse existing UTM params from URL into builder fields
- [x] Test: create link with UTM, verify destination includes params
- [x] Test: edit link, UTM fields pre-populated from existing URL