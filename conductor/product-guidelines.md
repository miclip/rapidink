# RapidInk Product Guidelines

## Brand Voice

### Tone
Clean, minimal, and straightforward. Let the product speak for itself. Avoid marketing fluff - users are here to generate a planner, not read sales copy.

**Do:**
- Use direct, action-oriented language ("Select your device", "Generate PDF")
- Keep instructions concise
- Provide helpful hints without being patronizing

**Don't:**
- Use exclamation marks excessively
- Add unnecessary encouragement ("Great choice!")
- Over-explain obvious UI elements

### Privacy-First Messaging

RapidInk runs entirely in the browser. This is a core value that should be clearly communicated:

- **No server-side processing** - All PDF generation happens client-side
- **No data collection** - No analytics, no tracking, no cookies
- **No accounts required** - No sign-up, no login, no email capture
- **Your data stays yours** - Configuration and calendars never leave your device

This should be stated clearly in the UI (e.g., footer or about section) and documentation.

## Visual Identity

### UI Design Principles
- **Utility-focused:** Every element serves a purpose
- **High contrast:** Optimized for readability, reflecting the e-paper target devices
- **Minimal chrome:** Reduce visual noise, maximize content area
- **Responsive:** Works on desktop browsers where users configure their planners

### Color Palette
- Primary: Functional blues for interactive elements
- Background: Light grays and whites
- Text: High-contrast dark grays/black
- Accent: Minimal use, only for key actions (Generate button)

## Generated PDF Guidelines

### No Branding
Generated PDFs contain zero RapidInk branding. The planner belongs entirely to the user. No watermarks, no "Made with" text, no logos.

### Accessibility
- Sufficient contrast for e-paper displays (typically grayscale)
- Clear visual hierarchy in navigation elements
- Touch-friendly link target sizes for stylus/finger interaction

## Documentation Style

- Write for users who want to get things done quickly
- Lead with the action, follow with explanation if needed
- Use code-style formatting for specific values (e.g., `5mm` spacing)
- Avoid jargon - not all users are technical
