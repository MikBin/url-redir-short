# Change Proposal: UTM Parameter Management UI

## Problem
UTM parameters are essential for campaign tracking but must be manually constructed. Users need a structured interface to add, validate, and preview UTM-tagged URLs rather than editing query strings by hand (FR-30).

## Opportunity
A dedicated UTM builder in the link creation/edit flow eliminates manual URL construction errors and ensures consistent UTM tagging across campaigns.

## Success Metrics
- UTM builder accessible from link creation and edit forms
- Live preview of final URL with UTM parameters
- Validation of UTM values (no spaces, special chars)
- Saved UTM templates for reuse across links

## Scope
- UTM parameter builder component (source, medium, campaign, term, content)
- Live URL preview with UTM appended
- UTM template save/load
- Integration into link create/edit forms