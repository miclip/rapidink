# RapidInk

Customizable bullet journal PDF generator for e-ink devices. Create personalized planners with monthly, weekly, and daily pages, habit trackers, collections, and more. Optimized for reMarkable, Supernote, and Kindle Scribe. 100% client-side - no server required.

## Features

- **Device Optimized** - Presets for reMarkable Paper Pro, Supernote, Kindle Scribe, and more
- **Flexible Layouts** - Monthly timelines, weekly spreads, daily pages with multiple layout options
- **Habit Tracking** - Built-in monthly habit tracker with customizable habits
- **Collections** - Create custom collections with various templates (dot grid, lined, checklist, blank)
- **Future Log** - Plan ahead with quarterly future log pages
- **Holiday Support** - Automatically includes holidays for your country/region
- **iCal Import** - Import events from calendar files
- **Fully Configurable** - Customize fonts, colors, dot spacing, date formats, and more
- **Config Embedding** - Your settings are saved in the PDF for easy re-import and editing
- **Privacy First** - Everything runs in your browser, nothing is uploaded

## Getting Started

### Online

Visit the hosted version at [miclip.github.io/rapidink](https://miclip.github.io/rapidink)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Supported Devices

Devices marked with a checkbox have been tested.

- [x] reMarkable Paper Pro
- [ ] reMarkable Paper Pro Move
- [ ] reMarkable 2
- [ ] reMarkable 1
- [ ] Supernote A5X / A6X
- [ ] Kindle Scribe
- [ ] Custom dimensions

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) - Web framework
- [pdf-lib](https://pdf-lib.js.org/) - PDF generation
- [Day.js](https://day-js.dev/) - Date manipulation
- [date-holidays](https://github.com/commenthol/date-holidays) - Holiday data

## See Also

Looking for a traditional planner instead of bullet journal style? Check out [ReCalendarJS](https://github.com/nicolaracco/recalendarjs) - an excellent customizable calendar generator for e-ink devices with classic planner layouts.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License. See [LICENSE](LICENSE) for details.

You are free to use, share, and adapt this work for non-commercial purposes with attribution.
