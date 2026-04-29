---
name: arc42-documentation
description: arc42 architecture documentation template and guidance
allowed-tools: Read, Glob, Grep, Write, Edit
---

# arc42 Documentation Skill

## When to Use This Skill

Use this skill when:

- **Arc42 Documentation tasks** - Working on arc42 architecture documentation template and guidance
- **Planning or design** - Need guidance on Arc42 Documentation approaches
- **Best practices** - Want to follow established patterns and standards

## Overview

Create comprehensive architecture documentation using the arc42 template.

## MANDATORY: Documentation-First Approach

Before creating arc42 documentation:

1. **Invoke `docs-management` skill** for architecture documentation patterns
2. **Verify arc42 current version** via MCP servers (perplexity)
3. **Base guidance on official arc42 template**

## arc42 Template Structure

```text
arc42 Template (12 Sections):

┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Introduction and Goals                                                   │
│     Requirements overview, quality goals, stakeholders                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. Architecture Constraints                                                 │
│     Technical, organizational, and convention constraints                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. System Scope and Context                                                 │
│     Business context, technical context                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. Solution Strategy                                                        │
│     Technology decisions, top-level decomposition, quality approaches        │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. Building Block View                                                      │
│     Static decomposition: whitebox/blackbox at multiple levels               │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. Runtime View                                                             │
│     Important scenarios, interactions, behaviors                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  7. Deployment View                                                          │
│     Technical infrastructure, mapping of building blocks                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  8. Cross-cutting Concepts                                                   │
│     Recurring patterns, approaches, principles                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  9. Architecture Decisions                                                   │
│     Important decisions with rationale (may link to ADRs)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 10. Quality Requirements                                                     │
│     Quality tree, quality scenarios                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 11. Risks and Technical Debt                                                 │
│     Known risks, technical debt items                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 12. Glossary                                                                 │
│     Important domain and technical terms                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Complete arc42 Template

```markdown
# Architecture Documentation: [System Name]

**Version:** 1.0
**Date:** [Date]
**Status:** Draft | Review | Final

---

## 1. Introduction and Goals

### 1.1 Requirements Overview
[Brief description...]

### 1.2 Quality Goals
| Priority | Quality Goal | Description |
|----------|--------------|-------------|
| 1 | [Goal] | [Description] |

### 1.3 Stakeholders
| Role | Name/Team | Expectations |
|------|-----------|--------------|

---

## 2. Architecture Constraints
[Technical, Organizational, Conventions...]

---

## 3. System Scope and Context
### 3.1 Business Context
```mermaid
C4Context
    title System Context Diagram
    ...
```

---

## 4. Solution Strategy
[Technology Decisions, Decomposition, Quality Approaches...]

---

## 5. Building Block View
### 5.1 Level 1: Whitebox Overall System
```mermaid
C4Container
    title Container Diagram
    ...
```

---

## 6. Runtime View
[Scenarios and Sequence Diagrams...]

---

## 7. Deployment View
[Infrastructure and Deployment Diagrams...]

---

## 8. Cross-cutting Concepts
[Domain Model, Security, Error Handling, Testability...]

---

## 9. Architecture Decisions
[Link to ADRs...]

---

## 10. Quality Requirements
[Quality Tree and Scenarios...]

---

## 11. Risks and Technical Debt
[Known risks, technical debt items...]

---

## 12. Glossary
[Important domain and technical terms...]
```

## Workflow
1. Start with context (Sections 1-3)
2. Document decisions (Section 4)
3. Detail structure (Section 5)
4. Show behavior (Section 6)
5. Map to infrastructure (Section 7)
6. Capture patterns (Section 8)
7. Record decisions (Section 9)
8. Define quality (Section 10)
9. Acknowledge risks (Section 11)
10. Define terms (Section 12)

---
**Last Updated:** 2025-12-26
