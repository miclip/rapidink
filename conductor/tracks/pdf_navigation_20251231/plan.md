# Plan: Complete PDF Generation & Navigation System

## Phase 1: PDF Link Annotations Infrastructure

### Task 1.1: Create Link Annotation Utility
- [ ] Task: Write tests for PDF link annotation helper functions
- [ ] Task: Implement `createInternalLink()` function using pdf-lib annotations
- [ ] Task: Implement `createPageAnchor()` function to register named destinations

### Task 1.2: Navigation Header Component
- [ ] Task: Write tests for navigation header generation
- [ ] Task: Implement `drawNavigationHeader()` with configurable links
- [ ] Task: Add touch-friendly hit-box sizing (minimum 44x44pt targets)

### Task 1.3: Page Reference System
- [ ] Task: Write tests for page reference tracking
- [ ] Task: Implement page index registry to track page numbers during generation
- [ ] Task: Update all page generators to register their page indices

- [ ] Task: Conductor - User Manual Verification 'Phase 1: PDF Link Annotations Infrastructure' (Protocol in workflow.md)

## Phase 2: Complete Page Generators

### Task 2.1: Cover Page
- [ ] Task: Write tests for cover page generation
- [ ] Task: Implement cover page with year display and minimal design
- [ ] Task: Add optional user title/subtitle from config

### Task 2.2: Index Pages
- [ ] Task: Write tests for index page generation
- [ ] Task: Implement alphabetical index sections (A-Z)
- [ ] Task: Add page number links to each section

### Task 2.3: Guide/Legend Page
- [ ] Task: Write tests for guide page generation
- [ ] Task: Implement guide page with navigation tips and icon legend

### Task 2.4: Future Log Pages
- [ ] Task: Write tests for future log generation
- [ ] Task: Implement 12-month future log overview (3 months per page)

### Task 2.5: Monthly Pages
- [ ] Task: Write tests for monthly page generation
- [ ] Task: Implement monthly calendar grid with day links
- [ ] Task: Add habit tracker sidebar if enabled
- [ ] Task: Implement monthly reflection section if enabled

### Task 2.6: Weekly Pages
- [ ] Task: Write tests for weekly page generation
- [ ] Task: Implement 7-day weekly layout
- [ ] Task: Add daily page links for each day
- [ ] Task: Implement weekly reflection section if enabled

### Task 2.7: Daily Pages
- [ ] Task: Write tests for daily page generation
- [ ] Task: Implement year-aware date header with single-letter day abbreviation
- [ ] Task: Implement freeform layout (dot grid only)
- [ ] Task: Implement time-blocked layout with configurable hours
- [ ] Task: Display events from iCal import on relevant days

### Task 2.8: Habit Tracker Pages
- [ ] Task: Write tests for habit tracker generation
- [ ] Task: Implement monthly habit grid with habit names from config

### Task 2.9: Collection Pages
- [ ] Task: Write tests for collection index and pages
- [ ] Task: Implement collection index with write-in slots
- [ ] Task: Implement collection page templates (blank, dotgrid, lined, checklist, grid)

### Task 2.10: Notes Pages
- [ ] Task: Write tests for notes page generation
- [ ] Task: Implement configurable number of notes pages at end

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Complete Page Generators' (Protocol in workflow.md)

## Phase 3: Navigation Wiring

### Task 3.1: Wire All Navigation Links
- [ ] Task: Write integration tests for navigation link functionality
- [ ] Task: Connect header navigation to section pages
- [ ] Task: Connect monthly calendar dates to daily pages
- [ ] Task: Connect weekly days to daily pages
- [ ] Task: Connect index entries to respective pages
- [ ] Task: Connect collection index to collection pages

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
