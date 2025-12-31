# Track Specification: Complete PDF Generation & Navigation System

## Overview

This track completes the core PDF generation functionality for RapidInk, transforming the existing skeleton into a fully functional planner generator with rich hyperlinked navigation.

## Goals

1. **Implement Internal PDF Links** - Add clickable navigation links using pdf-lib annotations
2. **Complete Page Generators** - Finish all page type implementations (cover, index, monthly, weekly, daily, etc.)
3. **Year-Aware Formatting** - Display dates with single-letter day abbreviations (e.g., "1 M", "2 T")
4. **CI/CD Pipeline** - Set up GitHub Actions for automated builds and deployment

## Detailed Requirements

### 1. PDF Link Annotations

pdf-lib supports link annotations via `page.doc.context.register()` and `PDFAnnotation`. Each navigation link must:
- Be clickable and navigate to the correct page
- Have appropriate hit-box sizing for stylus/touch interaction
- Work across all target devices (reMarkable, Supernote, Kindle, Boox, iPad)

**Navigation Links Required:**
- Header navigation bar on every page (configurable links)
- Monthly calendar → specific daily pages
- Weekly overview → daily pages for that week
- Index → all major sections
- Collection index → individual collection pages

### 2. Page Type Generators

Each page generator must:
- Respect device dimensions and toolbar offset
- Apply configured dot/grid/line background pattern
- Include navigation header
- Handle left/right-handed layouts

**Page Types:**
| Page Type | Status | Key Features |
|-----------|--------|--------------|
| Cover | Skeleton exists | Year display, minimal design |
| Index | Skeleton exists | Alphabetical sections A-Z, page links |
| Guide/Legend | New | Icon explanations, navigation tips |
| Intention | Skeleton exists | Free-form writing area |
| Goals | Skeleton exists | Goal tracking sections |
| Future Log | Skeleton exists | 12-month overview |
| Monthly | Skeleton exists | Calendar grid, habit tracker sidebar |
| Weekly | Skeleton exists | 7-day layout, reflection section |
| Daily | Skeleton exists | Date header, time blocks or freeform |
| Habit Tracker | Skeleton exists | Monthly grid, habit names |
| Collection Index | Skeleton exists | Write-in slots for user collections |
| Collection Pages | New | Template-based (blank, dotgrid, lined, etc.) |
| Notes Pages | New | Blank/dotgrid pages at end |

### 3. Year-Aware Date Formatting

Dates must display with single-letter day abbreviations:
- Format: `{date} {dayLetter}` (e.g., "1 M", "15 F", "28 S")
- Day letters: M, T, W, T, F, S, S
- Apply to: Daily page headers, monthly calendar cells, weekly overviews

### 4. GitHub Actions CI/CD

**CI Workflow (`.github/workflows/ci.yml`):**
- Trigger: Push to any branch, Pull requests
- Steps: Install deps, run svelte-check, build

**Deploy Workflow (`.github/workflows/deploy.yml`):**
- Trigger: Push to main
- Steps: Build, deploy to GitHub Pages

## Technical Constraints

- All PDF generation happens client-side (no server)
- Must work in modern browsers (ES2020+)
- Bundle size should remain reasonable (<500KB gzipped for main chunk)
- PDF generation should complete within 30 seconds for a full-year planner

## Acceptance Criteria

- [ ] Generated PDFs have working internal navigation links
- [ ] All page types render correctly with configured settings
- [ ] Dates display with single-letter day abbreviations
- [ ] Navigation works on reMarkable, Supernote, and iPad/GoodNotes
- [ ] GitHub Actions CI passes on all PRs
- [ ] Main branch auto-deploys to GitHub Pages
