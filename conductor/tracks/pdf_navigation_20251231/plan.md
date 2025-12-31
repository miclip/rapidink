# Plan: Complete PDF Generation & Navigation System

## Phase 1: PDF Link Annotations Infrastructure [checkpoint: 5f8c31b]

### Task 1.1: Create Link Annotation Utility
- [x] Task: Write tests for PDF link annotation helper functions `93b65f5`
- [x] Task: Implement `createInternalLink()` function using pdf-lib annotations `93b65f5`
- [x] Task: Implement `createPageAnchor()` function to register named destinations `93b65f5`

### Task 1.2: Navigation Header Component
- [x] Task: Write tests for navigation header generation `0f3f640`
- [x] Task: Implement `drawNavigationHeader()` with configurable links `0f3f640`
- [x] Task: Add touch-friendly hit-box sizing (minimum 44x44pt targets) `0f3f640`

### Task 1.3: Page Reference System
- [x] Task: Write tests for page reference tracking `15985d7`
- [x] Task: Implement page index registry to track page numbers during generation `32dc8d8`
- [x] Task: Update all page generators to register their page indices `32dc8d8`

- [x] Task: Conductor - User Manual Verification 'Phase 1: PDF Link Annotations Infrastructure' (Protocol in workflow.md) `5f8c31b`

## Phase 2: Complete Page Generators

### Task 2.1: Cover Page
- [x] Task: Write tests for cover page generation `f36c522`
- [x] Task: Implement cover page with year display and minimal design `f36c522`
- [x] Task: Add optional user title/subtitle from config `f36c522`

### Task 2.2: Index Pages
- [x] Task: Write tests for index page generation `37b1d98`
- [x] Task: Implement alphabetical index sections (A-Z) `37b1d98`
- [ ] Task: Add page number links to each section (Phase 3)

### Task 2.3: Guide/Legend Page
- [x] Task: Write tests for guide page generation (guide.test.ts)
- [x] Task: Implement guide page with navigation tips and icon legend (existing implementation)

### Task 2.4: Future Log Pages
- [x] Task: Write tests for future log generation (pages.test.ts)
- [x] Task: Implement 12-month future log overview (6 months per page, 2 pages total)

### Task 2.5: Monthly Pages
- [x] Task: Write tests for monthly page generation (pages.test.ts)
- [x] Task: Implement monthly calendar grid with day links
- [~] Task: Add habit tracker sidebar if enabled (Phase 3)
- [~] Task: Implement monthly reflection section if enabled (Phase 3)

### Task 2.6: Weekly Pages
- [x] Task: Write tests for weekly page generation (pages.test.ts)
- [x] Task: Implement 7-day weekly layout
- [~] Task: Add daily page links for each day (Phase 3)
- [x] Task: Implement weekly reflection section if enabled

### Task 2.7: Daily Pages
- [x] Task: Write tests for daily page generation (pages.test.ts, memory-intensive tests skipped)
- [x] Task: Implement year-aware date header with single-letter day abbreviation
- [x] Task: Implement freeform layout (dot grid only)
- [x] Task: Implement time-blocked layout with configurable hours
- [x] Task: Display events from iCal import on relevant days

### Task 2.8: Habit Tracker Pages
- [x] Task: Write tests for habit tracker generation (pages.test.ts)
- [x] Task: Implement monthly habit grid with habit names from config

### Task 2.9: Collection Pages
- [x] Task: Write tests for collection index and pages (pages.test.ts)
- [x] Task: Implement collection index with write-in slots
- [x] Task: Implement collection page templates (blank, dotgrid, lined, checklist, grid)

### Task 2.10: Notes Pages
- [x] Task: Write tests for notes page generation (pages.test.ts)
- [x] Task: Implement configurable number of notes pages at end

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Complete Page Generators' (Protocol in workflow.md)

## Phase 3: Navigation Wiring

### Task 3.1: Wire All Navigation Links
- [~] Task: Write integration tests for navigation link functionality (deferred - manual testing)
- [x] Task: Connect header navigation to section pages `4555388`
- [x] Task: Connect monthly calendar dates to daily pages `814fa26`
- [~] Task: Connect weekly days to daily pages (deferred - weekly pages don't show individual days)
- [x] Task: Connect index entries to respective pages `13ce157`
- [x] Task: Connect collection index to collection pages `13ce157`

### Task 3.2: Navigation Testing
- [ ] Task: Test navigation on exported PDF in browser
- [ ] Task: Document any device-specific navigation quirks

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Navigation Wiring' (Protocol in workflow.md)

## Phase 4: GitHub Actions CI/CD

### Task 4.1: CI Workflow
- [ ] Task: Create `.github/workflows/ci.yml`
- [ ] Task: Configure Node.js setup and dependency installation
- [ ] Task: Add svelte-check step for type checking
- [ ] Task: Add build step to verify production build

### Task 4.2: Deploy Workflow
- [ ] Task: Create `.github/workflows/deploy.yml`
- [ ] Task: Configure GitHub Pages deployment
- [ ] Task: Set up automatic deployment on push to main

### Task 4.3: Repository Configuration
- [ ] Task: Initialize git repository
- [ ] Task: Create initial commit with all existing code
- [ ] Task: Push to GitHub and verify workflows run

- [ ] Task: Conductor - User Manual Verification 'Phase 4: GitHub Actions CI/CD' (Protocol in workflow.md)

## Phase 5: Polish & Documentation

### Task 5.1: UI Improvements
- [ ] Task: Add privacy notice to footer ("Runs entirely in your browser")
- [ ] Task: Fix accessibility warnings (label associations)
- [ ] Task: Add loading states and error handling for PDF generation

### Task 5.2: Documentation
- [ ] Task: Create README.md with project overview and usage instructions
- [ ] Task: Add LICENSE file (choose appropriate open-source license)
- [ ] Task: Document configuration options

- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Documentation' (Protocol in workflow.md)
