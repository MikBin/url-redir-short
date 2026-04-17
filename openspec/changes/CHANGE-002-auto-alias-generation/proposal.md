# Change Proposal: Auto-Generated Aliases

## Problem
Users must manually enter a slug/alias for every link they create (FR-27). This slows down the link creation workflow and can lead to naming collisions or unfriendly slugs.

## Opportunity
Auto-generate short, random, collision-resistant aliases when the user leaves the slug field empty. This enables a "create and go" workflow where users only need to provide a destination URL.

## Success Metrics
- Zero collision rate for generated aliases (probabilistically negligible)
- Generated aliases are 6-8 characters, URL-safe
- Link creation workflow reduced from 2 fields to 1 (destination only)
- Existing custom alias workflow unchanged

## Scope
- Create alias generation utility
- Integrate into link creation API (auto-generate when slug is empty)
- Update UI to indicate auto-generation with a "Generate" button or placeholder