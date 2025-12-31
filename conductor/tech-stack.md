# RapidInk Technology Stack

## Overview

RapidInk is a client-side single-page application (SPA) that generates PDF planners entirely in the browser. No server-side processing is required.

## Frontend Framework

### SvelteKit 2.0 + Svelte 5
- **Why:** Lightweight, fast, excellent developer experience
- **Adapter:** `@sveltejs/adapter-static` for pure static site generation
- **SSR:** Disabled - runs entirely client-side

### TypeScript 5
- Strict type checking for configuration objects and PDF generation
- Enhanced IDE support and refactoring capabilities

### Vite 6
- Fast HMR during development
- Optimized production builds
- Native ES modules

## PDF Generation

### pdf-lib 1.17.x
- **Why:** Pure JavaScript, runs in browser without Node.js polyfills
- **Capabilities:** Create documents, add pages, embed fonts, draw shapes, add text
- **Limitation:** No native internal link annotations (requires manual implementation)

## Utilities

### dayjs 1.11.x
- Lightweight date manipulation
- Plugins: `weekOfYear`, `isoWeek`, `dayOfYear`
- Locale support for internationalization

### ical.js 2.1.x
- Parse .ics/.ical calendar files
- Extract events for pre-populating daily pages

### @fontsource/inter 5.x
- Self-hosted Inter font family
- No external font requests (privacy)

## Build & Deployment

### Static Site Generation
- Output: Pure static HTML/CSS/JS
- Hosting: GitHub Pages (or any static host)
- No server required

### Bundle Optimization
- pdf-lib excluded from Vite's dependency pre-bundling
- Tree-shaking for minimal bundle size

## Browser Requirements

- Modern browsers with ES2020+ support
- Blob API for PDF generation and download
- File API for iCal import
