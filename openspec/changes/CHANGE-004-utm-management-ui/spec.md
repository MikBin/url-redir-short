# Specification: UTM Parameter Management UI

## UTM Parameters
| Parameter | Required | Description | Example |
|---|---|---|---|
| `utm_source` | Yes | Traffic source | `google`, `newsletter` |
| `utm_medium` | Yes | Marketing medium | `cpc`, `email`, `social` |
| `utm_campaign` | Yes | Campaign name | `spring_sale_2025` |
| `utm_term` | No | Paid search keywords | `running+shoes` |
| `utm_content` | No | Content differentiator | `header_banner`, `sidebar_link` |

## UTM Builder Component
```
┌─────────────────────────────────┐
│ UTM Builder          [Template ▼]│
├─────────────────────────────────┤
│ Source*:   [google          ]    │
│ Medium*:   [cpc             ]    │
│ Campaign*: [spring_sale     ]    │
│ Term:      [                ]    │
│ Content:   [                ]    │
├─────────────────────────────────┤
│ Preview:                        │
│ https://example.com?            │
│   utm_source=google&            │
│   utm_medium=cpc&               │
│   utm_campaign=spring_sale      │
│                     [Copy URL]  │
└─────────────────────────────────┘
```

## Validation Rules
1. Required fields: source, medium, campaign
2. No spaces allowed (auto-replace with underscores)
3. Only alphanumeric, hyphens, underscores
4. Max length: 100 chars per parameter
5. Live validation with inline error messages

## UTM Templates
- Save current UTM combo as named template
- Templates stored in localStorage (client-side)
- Load template populates all fields
- Delete template option

## Integration
- Collapsible "UTM Parameters" section in link create/edit form
- When expanded, appends UTM params to destination URL before submission
- On edit, parses existing UTM params from destination URL into fields