import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import type { RapidInkConfig } from '../config';
import { DEVICES, pxToPoints, getContentWidth } from '../devices';
import { PageRegistry, createInternalLink } from './links';
import { getHolidaysForYear, type Holiday } from '../holidays';

// Navigation icon mappings (short labels for nav bar)
const NAV_ICONS: Record<string, string> = {
	'index': 'Idx',
	'monthly': 'Mo',
	'weekly': 'Wk',
	'future-log': 'Fut',
	'intention': 'Int',
	'goals': 'Go',
	'habits': 'Hab',
	'collections': 'Col',
	'notes': 'Not'
};

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(dayOfYear);

// Parse hex color to RGB values (0-1 range)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (result) {
		return {
			r: parseInt(result[1], 16) / 255,
			g: parseInt(result[2], 16) / 255,
			b: parseInt(result[3], 16) / 255
		};
	}
	return { r: 0, g: 0, b: 0 }; // Default to black
}

// Color helpers using context colors
function textColor(ctx: GeneratorContext) {
	const c = ctx.textColor;
	return rgb(c.r, c.g, c.b);
}

function lineColor(ctx: GeneratorContext) {
	const c = ctx.lineColor;
	return rgb(c.r * ctx.lineOpacity, c.g * ctx.lineOpacity, c.b * ctx.lineOpacity);
}

function mutedTextColor(ctx: GeneratorContext, opacity: number = 0.5) {
	const c = ctx.textColor;
	// Blend toward white based on opacity
	return rgb(1 - (1 - c.r) * opacity, 1 - (1 - c.g) * opacity, 1 - (1 - c.b) * opacity);
}

interface PendingLink {
	page: PDFPage;
	x: number;
	y: number;
	width: number;
	height: number;
	targetAnchor: string;
}

interface GeneratorContext {
	doc: PDFDocument;
	config: RapidInkConfig;
	font: PDFFont;
	boldFont: PDFFont;
	pageWidth: number;
	pageHeight: number;
	contentWidth: number;
	margins: { top: number; right: number; bottom: number; left: number };
	registry: PageRegistry;
	currentPageIndex: number;
	pendingLinks: PendingLink[];
	// Parsed colors for rendering
	textColor: { r: number; g: number; b: number };
	lineColor: { r: number; g: number; b: number };
	lineOpacity: number;
	// Holidays for the year (keyed by date YYYY-MM-DD)
	holidays: Map<string, Holiday>;
}

export interface GeneratorProgress {
	phase: string;
	current: number;
	total: number;
	message: string;
}

export type ProgressCallback = (progress: GeneratorProgress) => void;

export async function generatePDF(
	config: RapidInkConfig,
	onProgress?: ProgressCallback
): Promise<Uint8Array> {
	const doc = await PDFDocument.create();

	const device = DEVICES[config.device] || DEVICES['remarkable-1-2'];

	// Handle orientation - swap dimensions if landscape is selected
	// For devices that are naturally landscape (width > height), orientation is ignored
	const isNaturallyLandscape = device.width > device.height;
	const shouldSwap = !isNaturallyLandscape && config.orientation === 'landscape';

	const deviceWidth = shouldSwap ? device.height : device.width;
	const deviceHeight = shouldSwap ? device.width : device.height;
	const toolbarWidth = shouldSwap ? 0 : device.toolbarWidth; // No toolbar in landscape

	const pageWidth = pxToPoints(deviceWidth, device.dpi);
	const pageHeight = pxToPoints(deviceHeight, device.dpi);
	const contentWidth = pxToPoints(deviceWidth - toolbarWidth, device.dpi);

	// Select font based on config
	let font: PDFFont;
	let boldFont: PDFFont;
	switch (config.fontFamily) {
		case 'times':
			font = await doc.embedFont(StandardFonts.TimesRoman);
			boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
			break;
		case 'courier':
			font = await doc.embedFont(StandardFonts.Courier);
			boldFont = await doc.embedFont(StandardFonts.CourierBold);
			break;
		case 'helvetica':
		default:
			font = await doc.embedFont(StandardFonts.Helvetica);
			boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
			break;
	}

	const margins = {
		top: 40,
		right: config.handedness === 'left' ? pxToPoints(toolbarWidth, device.dpi) + 20 : 20,
		bottom: 40,
		left: config.handedness === 'right' ? pxToPoints(toolbarWidth, device.dpi) + 20 : 20
	};

	// Load holidays for the year
	const holidaysMap = new Map<string, Holiday>();
	if (config.holidays?.enabled) {
		const holidayList = getHolidaysForYear(
			config.year,
			config.holidays.country,
			config.holidays.state || undefined
		);
		for (const h of holidayList) {
			holidaysMap.set(h.date, h);
		}
	}

	const ctx: GeneratorContext = {
		doc,
		config,
		font,
		boldFont,
		pageWidth,
		pageHeight,
		contentWidth,
		margins,
		registry: new PageRegistry(),
		currentPageIndex: 0,
		pendingLinks: [],
		textColor: hexToRgb(config.textColor || '#000000'),
		lineColor: hexToRgb(config.lineColor || '#666666'),
		lineOpacity: config.lineOpacity ?? 0.8,
		holidays: holidaysMap
	};

	const report = (phase: string, current: number, total: number, message: string) => {
		onProgress?.({ phase, current, total, message });
	};

	// Phase 1: Generate all pages and collect references
	report('setup', 0, 1, 'Setting up document...');

	if (config.enableCover) {
		addCoverPage(ctx);
	}

	if (config.enableIndex) {
		addIndexPages(ctx);
	}

	if (config.enableGuide) {
		addGuidePage(ctx);
	}

	if (config.enableIntention) {
		addIntentionPage(ctx);
	}

	if (config.enableGoals) {
		addGoalsPage(ctx);
	}

	if (config.enableFutureLog) {
		addFutureLogPages(ctx);
	}

	if (config.enableMonthlyPages) {
		const monthCount = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount : 12;
		report('monthly', 0, monthCount, 'Generating monthly pages...');
		for (let month = 0; month < monthCount; month++) {
			report('monthly', month + 1, monthCount, `Generating ${dayjs().month(month).format('MMMM')}...`);
			addMonthlyPages(ctx, month);
			// Register 'monthly' alias pointing to first month
			if (month === 0) {
				const firstMonthPage = ctx.registry.getPage('month-0-timeline');
				if (firstMonthPage) {
					ctx.registry.registerPage('monthly', firstMonthPage, ctx.registry.getPageIndex('month-0-timeline')!);
				}
			}
		}
	}

	if (config.enableHabitTracker) {
		const habitMonthCount = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount : 12;
		for (let month = 0; month < habitMonthCount; month++) {
			addHabitTrackerPage(ctx, month);
		}
	}

	if (config.enableWeeklyPages) {
		// In sample mode, only generate weeks that fall within the sample months
		const maxMonth = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount - 1 : 11;
		const lastSampleDate = dayjs(`${config.year}-${maxMonth + 1}-01`).endOf('month');
		const lastWeekInSample = config.weekStart === 'monday' ? lastSampleDate.isoWeek() : lastSampleDate.week();

		const weeksInYear = getWeeksInYear(config.year, config.weekStart);
		const maxWeek = config.sampleMonthCount && config.sampleMonthCount > 0 ? lastWeekInSample : weeksInYear;

		report('weekly', 0, maxWeek, 'Generating weekly pages...');
		for (let week = 1; week <= maxWeek; week++) {
			report('weekly', week, maxWeek, `Generating week ${week}...`);
			addWeeklyPages(ctx, week);
			// Register 'weekly' alias pointing to first week
			if (week === 1) {
				const firstWeekPage = ctx.registry.getPage('week-1-action');
				if (firstWeekPage) {
					ctx.registry.registerPage('weekly', firstWeekPage, ctx.registry.getPageIndex('week-1-action')!);
				}
			}
		}
	}

	if (config.enableDailyPages) {
		// In sample mode, only generate daily pages for the sample months
		const maxMonth = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount - 1 : 11;
		const lastDate = dayjs(`${config.year}-${maxMonth + 1}-01`).endOf('month');
		const totalDays = lastDate.dayOfYear();

		report('daily', 0, totalDays, 'Generating daily pages...');
		for (let day = 1; day <= totalDays; day++) {
			const date = dayjs(`${config.year}-01-01`).dayOfYear(day);
			if (day % 30 === 0 || totalDays < 60) {
				report('daily', day, totalDays, `Generating ${date.format('MMM D')}...`);
			}
			addDailyPage(ctx, date);
		}
	}

	if (config.enableCollections) {
		addCollectionIndexPages(ctx);
		for (const collection of config.collections) {
			addCollectionPages(ctx, collection);
		}
		// Generate pages for write-in collection slots
		for (let i = 0; i < config.writeInCollectionSlots; i++) {
			addWriteInCollectionPages(ctx, i);
		}
	}

	if (config.enableNotesPages && config.notesPageCount > 0) {
		report('notes', 0, config.notesPageCount, 'Generating notes pages...');
		for (let i = 0; i < config.notesPageCount; i++) {
			addNotesPage(ctx, i + 1);
		}
	}

	// Phase 2: Add navigation links (second pass - now all pages exist)
	report('links', 0, 1, 'Adding navigation links...');
	for (const pendingLink of ctx.pendingLinks) {
		const targetPage = ctx.registry.getPage(pendingLink.targetAnchor);
		if (targetPage) {
			await createInternalLink(doc, pendingLink.page, {
				x: pendingLink.x,
				y: pendingLink.y,
				width: pendingLink.width,
				height: pendingLink.height,
				targetAnchor: pendingLink.targetAnchor,
				registry: ctx.registry
			});
		}
	}

	// Embed config as attachment
	report('finalize', 0, 1, 'Embedding configuration...');
	const configJson = JSON.stringify(config, null, 2);
	const configBytes = new TextEncoder().encode(configJson);
	// Create a clean Uint8Array to ensure pdf-lib compatibility
	const attachment = new Uint8Array(configBytes.length);
	attachment.set(configBytes);
	await doc.attach(
		attachment,
		'rapidink-config.json',
		{
			mimeType: 'application/json',
			description: 'RapidInk planner configuration'
		}
	);

	report('finalize', 1, 1, 'Saving PDF...');
	return await doc.save();
}

function addPage(ctx: GeneratorContext, anchor?: string): PDFPage {
	const page = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
	if (anchor) {
		ctx.registry.registerPage(anchor, page, ctx.currentPageIndex);
	}
	ctx.currentPageIndex++;
	return page;
}

function drawDotGrid(page: PDFPage, ctx: GeneratorContext) {
	const { config, margins, pageWidth, pageHeight } = ctx;
	if (config.dotStyle === 'blank') return;

	const spacing = (config.dotSpacing / 25.4) * 72; // mm to points
	const dotColor = textColor(ctx);

	const startX = margins.left;
	const startY = margins.bottom;
	const endX = pageWidth - margins.right;
	const endY = pageHeight - margins.top - 30; // Leave room for header

	if (config.dotStyle === 'dots') {
		for (let x = startX; x <= endX; x += spacing) {
			for (let y = startY; y <= endY; y += spacing) {
				page.drawCircle({
					x,
					y,
					size: config.dotSize * 0.5,
					color: dotColor,
					opacity: config.dotOpacity
				});
			}
		}
	} else if (config.dotStyle === 'grid') {
		for (let x = startX; x <= endX; x += spacing) {
			page.drawLine({
				start: { x, y: startY },
				end: { x, y: endY },
				thickness: 0.25,
				color: dotColor,
				opacity: config.dotOpacity
			});
		}
		for (let y = startY; y <= endY; y += spacing) {
			page.drawLine({
				start: { x: startX, y },
				end: { x: endX, y },
				thickness: 0.25,
				color: dotColor,
				opacity: config.dotOpacity
			});
		}
	} else if (config.dotStyle === 'lines') {
		for (let y = startY; y <= endY; y += spacing) {
			page.drawLine({
				start: { x: startX, y },
				end: { x: endX, y },
				thickness: 0.25,
				color: dotColor,
				opacity: config.dotOpacity
			});
		}
	}
}

function drawHeader(
	page: PDFPage,
	ctx: GeneratorContext,
	title: string,
	navLinks: Array<{ label: string; anchor: string }>,
	options?: {
		linkOverrides?: Record<string, string>; // Override link targets (e.g., { habits: 'habits-3' })
		showNav?: boolean; // Whether to show the navigation bar (default: true)
	}
) {
	const { font, boldFont, margins, pageWidth, pageHeight, config } = ctx;
	const y = pageHeight - margins.top;
	const navFontSize = 9;
	const linkHeight = 20; // Touch-friendly height
	const navGap = 1;
	const showNav = options?.showNav !== false;

	// Calculate nav width first to reserve space
	const enabledLinks = showNav ? config.navigationLinks.filter(l => l.enabled) : [];
	let totalNavWidth = 0;
	for (const link of enabledLinks) {
		const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
		const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + 4, 22);
		totalNavWidth += linkWidth + navGap;
	}

	// Title (left side, with max width to avoid overlap)
	const maxTitleWidth = pageWidth - margins.left - margins.right - totalNavWidth - 20;
	let displayTitle = title;
	let titleWidth = boldFont.widthOfTextAtSize(displayTitle, 16);

	// Truncate title if too long
	while (titleWidth > maxTitleWidth && displayTitle.length > 10) {
		displayTitle = displayTitle.substring(0, displayTitle.length - 4) + '...';
		titleWidth = boldFont.widthOfTextAtSize(displayTitle, 16);
	}

	page.drawText(displayTitle, {
		x: margins.left,
		y,
		size: 16,
		font: boldFont,
		color: textColor(ctx)
	});

	// Navigation icons (right-aligned) - store pending links for second pass
	if (showNav) {
		let navX = pageWidth - margins.right;

		for (let i = enabledLinks.length - 1; i >= 0; i--) {
			const link = enabledLinks[i];
			const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
			const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + 4, 22);
			navX -= linkWidth;

			// Draw icon text
			page.drawText(icon, {
				x: navX + 2,
				y: y + 2,
				size: navFontSize,
				font,
				color: mutedTextColor(ctx, 0.6)
			});

			// Store pending link for second pass (after all pages exist)
			// Use override target if provided, otherwise use the link id
			const targetAnchor = options?.linkOverrides?.[link.id] || link.id;
			ctx.pendingLinks.push({
				page,
				x: navX,
				y: y - 5,
				width: linkWidth,
				height: linkHeight,
				targetAnchor
			});

			navX -= navGap;
		}
	}

	// Draw separator line below header
	page.drawLine({
		start: { x: margins.left, y: y - 12 },
		end: { x: pageWidth - margins.right, y: y - 12 },
		thickness: 0.5,
		color: lineColor(ctx)
	});
}

function addCoverPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'cover');
	const { boldFont, pageWidth, pageHeight, config } = ctx;

	// Use custom title or default to year
	const title = config.coverTitle || `${config.year}`;
	// Use custom subtitle or default to "Planner" (no branding)
	const subtitle = config.coverSubtitle || 'Planner';

	const titleSize = 48;
	const subtitleSize = 24;

	const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
	const subtitleWidth = boldFont.widthOfTextAtSize(subtitle, subtitleSize);

	page.drawText(title, {
		x: (pageWidth - titleWidth) / 2,
		y: pageHeight / 2 + 40,
		size: titleSize,
		font: boldFont,
		color: textColor(ctx)
	});

	page.drawText(subtitle, {
		x: (pageWidth - subtitleWidth) / 2,
		y: pageHeight / 2 - 20,
		size: subtitleSize,
		font: boldFont,
		color: mutedTextColor(ctx, 0.7)
	});
}

function addIndexPages(ctx: GeneratorContext) {
	let page = addPage(ctx, 'index');
	drawHeader(page, ctx, 'Index', [], { showNav: false });

	const { font, boldFont, margins, pageHeight, pageWidth, config } = ctx;
	let y = pageHeight - margins.top - 50;
	const lineHeight = 16;
	const monthCount = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount : 12;
	const contentWidth = pageWidth - margins.left - margins.right;

	// Quick Navigation - Main sections (compact horizontal layout)
	const sections = [
		{ label: 'Guide', anchor: 'guide', enabled: config.enableGuide },
		{ label: 'Intention', anchor: 'intention', enabled: config.enableIntention },
		{ label: 'Goals', anchor: 'goals', enabled: config.enableGoals },
		{ label: 'Future Log', anchor: 'future-log', enabled: config.enableFutureLog },
		{ label: 'Habits', anchor: 'habits', enabled: config.enableHabitTracker },
		{ label: 'Collections', anchor: 'collections', enabled: config.enableCollections }
	];

	let linkX = margins.left;
	for (const section of sections) {
		if (section.enabled) {
			const textWidth = font.widthOfTextAtSize(section.label, 10);

			page.drawText(section.label, {
				x: linkX,
				y,
				size: 10,
				font,
				color: textColor(ctx)
			});

			ctx.pendingLinks.push({
				page,
				x: linkX,
				y: y - 4,
				width: textWidth,
				height: lineHeight,
				targetAnchor: section.anchor
			});

			linkX += textWidth + 15;
		}
	}

	y -= lineHeight * 2;

	// Separator
	page.drawLine({
		start: { x: margins.left, y: y + lineHeight * 0.5 },
		end: { x: pageWidth - margins.right, y: y + lineHeight * 0.5 },
		thickness: 0.5,
		color: lineColor(ctx)
	});
	y -= lineHeight;

	// Unified calendar index - one layout for monthly, weekly, daily
	const monthBlockHeight = lineHeight * 4; // Month name + day letters + days + week indicators
	const dayWidth = contentWidth / 31;

	for (let month = 0; month < monthCount; month++) {
		const monthDate = dayjs(`${config.year}-${month + 1}-01`);
		const monthName = monthDate.format('MMMM');
		const daysInMonth = monthDate.daysInMonth();

		// Check if we need a new page
		if (y - monthBlockHeight < margins.bottom + 20) {
			page = addPage(ctx, `index-${month}`);
			drawHeader(page, ctx, 'Index', [], { showNav: false });
			y = pageHeight - margins.top - 50;
		}

		// Month name (clickable to monthly page)
		const monthTextWidth = boldFont.widthOfTextAtSize(monthName, 12);
		page.drawText(monthName, {
			x: margins.left,
			y,
			size: 12,
			font: boldFont,
			color: textColor(ctx)
		});

		if (config.enableMonthlyPages) {
			ctx.pendingLinks.push({
				page,
				x: margins.left,
				y: y - 4,
				width: monthTextWidth,
				height: lineHeight,
				targetAnchor: `month-${month}-timeline`
			});
		}

		// Habit tracker link on right side
		if (config.enableHabitTracker) {
			const habText = 'Hab';
			const habTextWidth = font.widthOfTextAtSize(habText, 10);
			const habX = pageWidth - margins.right - habTextWidth;

			page.drawText(habText, {
				x: habX,
				y,
				size: 10,
				font,
				color: mutedTextColor(ctx, 0.6)
			});

			// Use correct anchor: 'habits' for month 0, 'habits-N' for others
			const habitAnchor = month === 0 ? 'habits' : `habits-${month}`;
			ctx.pendingLinks.push({
				page,
				x: habX - 2,
				y: y - 4,
				width: habTextWidth + 4,
				height: lineHeight,
				targetAnchor: habitAnchor
			});
		}

		y -= lineHeight * 0.9;

		// Day of week letters above each day number
		for (let day = 1; day <= daysInMonth; day++) {
			const date = monthDate.date(day);
			const dayOfWeek = date.format('dd')[0]; // First letter: M, T, W, T, F, S, S
			const xPos = margins.left + (day - 1) * dayWidth;

			page.drawText(dayOfWeek, {
				x: xPos,
				y,
				size: 6,
				font,
				color: mutedTextColor(ctx, 0.5)
			});
		}

		y -= lineHeight * 0.7;

		// Day numbers on one line (clickable to daily pages)
		for (let day = 1; day <= daysInMonth; day++) {
			const date = monthDate.date(day);
			const dateStr = date.format('YYYY-MM-DD');
			const xPos = margins.left + (day - 1) * dayWidth;
			const dayText = `${day}`;

			page.drawText(dayText, {
				x: xPos,
				y,
				size: 8,
				font,
				color: textColor(ctx)
			});

			if (config.enableDailyPages) {
				ctx.pendingLinks.push({
					page,
					x: xPos - 2,
					y: y - 4,
					width: dayWidth,
					height: lineHeight,
					targetAnchor: `day-${dateStr}`
				});
			}
		}

		y -= lineHeight * 0.7;

		// Week indicators below the days (clickable to weekly pages)
		let currentDay = 1;
		while (currentDay <= daysInMonth) {
			const currentDate = monthDate.date(currentDay);
			const weekNum = config.weekStart === 'monday' ? currentDate.isoWeek() : currentDate.week();
			const weekStartDay = currentDay;

			// Find end of this week in this month
			let weekEndDay = currentDay;
			while (weekEndDay < daysInMonth) {
				const nextDate = monthDate.date(weekEndDay + 1);
				const nextWeek = config.weekStart === 'monday' ? nextDate.isoWeek() : nextDate.week();
				if (nextWeek !== weekNum) break;
				weekEndDay++;
			}

			// Draw week indicator with vertical bar, week number, and underline
			const startX = margins.left + (weekStartDay - 1) * dayWidth;
			const endX = margins.left + weekEndDay * dayWidth - 2;
			const weekNumText = `${weekNum}`;
			const weekNumWidth = font.widthOfTextAtSize(weekNumText, 7);

			// Vertical bar at start of week
			page.drawLine({
				start: { x: startX - 1, y: y + 8 },
				end: { x: startX - 1, y: y - 2 },
				thickness: 0.75,
				color: mutedTextColor(ctx, 0.5)
			});

			// Week number right after the bar
			page.drawText(weekNumText, {
				x: startX + 2,
				y,
				size: 7,
				font,
				color: mutedTextColor(ctx, 0.6)
			});

			// Underline spanning the week
			page.drawLine({
				start: { x: startX + weekNumWidth + 4, y: y + 3 },
				end: { x: endX, y: y + 3 },
				thickness: 0.5,
				color: lineColor(ctx)
			});

			// Add link to weekly page
			if (config.enableWeeklyPages) {
				ctx.pendingLinks.push({
					page,
					x: startX,
					y: y - 4,
					width: endX - startX,
					height: lineHeight,
					targetAnchor: `week-${weekNum}-action`
				});
			}

			currentDay = weekEndDay + 1;
		}

		y -= lineHeight * 0.9;

		// Separator line
		page.drawLine({
			start: { x: margins.left, y: y + lineHeight * 0.3 },
			end: { x: pageWidth - margins.right, y: y + lineHeight * 0.3 },
			thickness: 0.5,
			color: lineColor(ctx)
		});

		y -= lineHeight * 0.6;
	}
}

function addGuidePage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'guide');
	drawHeader(page, ctx, 'Guide & Legend', [{ label: 'Index', anchor: 'index' }]);
	drawDotGrid(page, ctx);

	const { font, boldFont, margins, pageHeight } = ctx;
	let y = pageHeight - margins.top - 60;
	const lineHeight = 18;

	// Symbol Key
	page.drawText('Rapid Logging Symbols', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont,
		color: textColor(ctx)
	});
	y -= lineHeight * 1.5;

	const symbols = [
		{ symbol: '.', meaning: 'Task (incomplete)' },
		{ symbol: 'x', meaning: 'Task (complete)' },
		{ symbol: '>', meaning: 'Task (migrated forward)' },
		{ symbol: '<', meaning: 'Task (scheduled to future)' },
		{ symbol: '-', meaning: 'Note' },
		{ symbol: 'o', meaning: 'Event' },
		{ symbol: '=', meaning: 'Mood / Feeling' }
	];

	for (const { symbol, meaning } of symbols) {
		page.drawText(symbol, {
			x: margins.left + 20,
			y,
			size: 14,
			font: boldFont,
			color: textColor(ctx)
		});
		page.drawText(meaning, {
			x: margins.left + 50,
			y,
			size: 12,
			font,
			color: textColor(ctx)
		});
		y -= lineHeight;
	}

	y -= lineHeight;

	// Flow diagram (simplified text version)
	page.drawText('Planning Flow', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont,
		color: textColor(ctx)
	});
	y -= lineHeight * 1.5;

	const flow = [
		'Intention - What matters to you',
		'    |',
		'Goals - Define outcomes',
		'    |',
		'Future Log - Capture future events/tasks',
		'    |',
		'Monthly Log - Plan the month',
		'    |',
		'Weekly Log - Plan & reflect weekly',
		'    |',
		'Daily Log - Capture daily thoughts'
	];

	for (const line of flow) {
		page.drawText(line, {
			x: margins.left + 20,
			y,
			size: 11,
			font,
			color: textColor(ctx)
		});
		y -= lineHeight * 0.9;
	}

	y -= lineHeight;

	// T.A.M.E. Reflection
	page.drawText('Reflection (T.A.M.E.)', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont,
		color: textColor(ctx)
	});
	y -= lineHeight * 1.5;

	const tame = [
		'T - Tidy: Cross off completed, declutter',
		'A - Acknowledge: What moved you toward/away from goals?',
		'M - Migrate: Move unfinished tasks forward',
		'E - Enact: Turn insights into actions'
	];

	for (const line of tame) {
		page.drawText(line, {
			x: margins.left + 20,
			y,
			size: 11,
			font,
			color: textColor(ctx)
		});
		y -= lineHeight;
	}
}

function addIntentionPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'intention');
	drawHeader(page, ctx, 'Intention', [{ label: 'Index', anchor: 'index' }]);
	drawDotGrid(page, ctx);

	const { font, margins, pageHeight } = ctx;
	const y = pageHeight - margins.top - 60;

	page.drawText(
		'An intention is a commitment to a process. Set your compass for the year.',
		{
			x: margins.left,
			y,
			size: 10,
			font,
			color: mutedTextColor(ctx, 0.6)
		}
	);
}

function addGoalsPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'goals');
	drawHeader(page, ctx, 'Goals', [{ label: 'Index', anchor: 'index' }]);
	drawDotGrid(page, ctx);

	const { font, margins, pageHeight } = ctx;
	const y = pageHeight - margins.top - 60;

	page.drawText(
		'Goals define outcomes. Transform dreams into tangible targets.',
		{
			x: margins.left,
			y,
			size: 10,
			font,
			color: mutedTextColor(ctx, 0.6)
		}
	);
}

function addFutureLogPages(ctx: GeneratorContext) {
	// Page 1: Jan-Jun
	const page1 = addPage(ctx, 'future-log');
	drawHeader(page1, ctx, 'Future Log', [], { showNav: false });

	const { font, boldFont, margins, pageWidth, pageHeight } = ctx;
	const colWidth = (pageWidth - margins.left - margins.right) / 2;
	let y = pageHeight - margins.top - 60;
	const monthHeight = (pageHeight - margins.top - margins.bottom - 60) / 3;

	for (let i = 0; i < 6; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const x = margins.left + col * colWidth;
		const yPos = y - row * monthHeight;

		const monthName = dayjs().month(i).format('MMMM');
		const textWidth = boldFont.widthOfTextAtSize(monthName, 12);

		page1.drawText(monthName, {
			x,
			y: yPos,
			size: 12,
			font: boldFont,
			color: textColor(ctx)
		});

		// Add pending link to month page
		ctx.pendingLinks.push({
			page: page1,
			x,
			y: yPos - 4,
			width: textWidth,
			height: 20,
			targetAnchor: `month-${i}-timeline`
		});

		page1.drawLine({
			start: { x, y: yPos - 5 },
			end: { x: x + colWidth - 20, y: yPos - 5 },
			thickness: 0.5,
			color: lineColor(ctx)
		});
	}

	// Page 2: Jul-Dec
	const page2 = addPage(ctx, 'future-log-2');
	drawHeader(page2, ctx, 'Future Log', [], { showNav: false });
	y = pageHeight - margins.top - 60;

	for (let i = 6; i < 12; i++) {
		const col = (i - 6) % 2;
		const row = Math.floor((i - 6) / 2);
		const x = margins.left + col * colWidth;
		const yPos = y - row * monthHeight;

		const monthName = dayjs().month(i).format('MMMM');
		const textWidth = boldFont.widthOfTextAtSize(monthName, 12);

		page2.drawText(monthName, {
			x,
			y: yPos,
			size: 12,
			font: boldFont,
			color: textColor(ctx)
		});

		// Add pending link to month page
		ctx.pendingLinks.push({
			page: page2,
			x,
			y: yPos - 4,
			width: textWidth,
			height: 20,
			targetAnchor: `month-${i}-timeline`
		});

		page2.drawLine({
			start: { x, y: yPos - 5 },
			end: { x: x + colWidth - 20, y: yPos - 5 },
			thickness: 0.5,
			color: lineColor(ctx)
		});
	}
}

function addMonthlyPages(ctx: GeneratorContext, month: number) {
	const { config } = ctx;
	const monthDate = dayjs(`${config.year}-${month + 1}-01`);
	const monthName = monthDate.format('MMMM');

	// Get week number for first day of month
	const firstWeekOfMonth = config.weekStart === 'monday' ? monthDate.isoWeek() : monthDate.week();

	// Timeline page
	const timelinePage = addPage(ctx, `month-${month}-timeline`);
	const habitAnchor = month === 0 ? 'habits' : `habits-${month}`;
	const headerLinks = [{ label: 'Index', anchor: 'index' }];
	if (config.enableWeeklyPages) {
		headerLinks.push({ label: 'Week', anchor: `week-${firstWeekOfMonth}-action` });
	}
	drawHeader(timelinePage, ctx, monthName, headerLinks, { linkOverrides: { habits: habitAnchor } });

	// Apply user's chosen page background
	drawDotGrid(timelinePage, ctx);

	const { font, margins, pageHeight } = ctx;
	const daysInMonth = monthDate.daysInMonth();
	let y = pageHeight - margins.top - 60;
	const lineHeight = (pageHeight - margins.top - margins.bottom - 80) / 31;

	for (let day = 1; day <= daysInMonth; day++) {
		const date = monthDate.date(day);
		const dayOfWeek = date.format('ddd')[0]; // First letter: M, T, W, etc.
		const isWeekend = date.day() === 0 || date.day() === 6;
		const dayText = `${day}`;
		const dateStr = date.format('YYYY-MM-DD');
		const holiday = ctx.holidays.get(dateStr);

		timelinePage.drawText(dayText, {
			x: margins.left,
			y,
			size: 10,
			font,
			color: isWeekend ? mutedTextColor(ctx, 0.5) : textColor(ctx)
		});

		// Add pending link to daily page (only if daily pages enabled)
		if (config.enableDailyPages) {
			ctx.pendingLinks.push({
				page: timelinePage,
				x: margins.left,
				y: y - 4,
				width: 40, // Cover day number and day letter
				height: lineHeight,
				targetAnchor: `day-${dateStr}`
			});
		}

		timelinePage.drawText(dayOfWeek, {
			x: margins.left + 25,
			y,
			size: 10,
			font,
			color: isWeekend ? mutedTextColor(ctx, 0.5) : textColor(ctx)
		});

		// Show holiday name if present
		if (holiday) {
			timelinePage.drawText(holiday.name, {
				x: margins.left + 45,
				y,
				size: 8,
				font,
				color: mutedTextColor(ctx, 0.6)
			});
		}

		timelinePage.drawLine({
			start: { x: margins.left + 40, y: y - 2 },
			end: { x: ctx.pageWidth - margins.right, y: y - 2 },
			thickness: 0.25,
			color: lineColor(ctx)
		});

		y -= lineHeight;
	}

	// Action plan page
	const actionPage = addPage(ctx, `month-${month}-action`);
	drawHeader(actionPage, ctx, `${monthName} - Action Plan`, headerLinks, { linkOverrides: { habits: habitAnchor } });
	drawDotGrid(actionPage, ctx);
}

function addHabitTrackerPage(ctx: GeneratorContext, month: number) {
	const { config } = ctx;
	const monthDate = dayjs(`${config.year}-${month + 1}-01`);
	const monthName = monthDate.format('MMMM');
	const daysInMonth = monthDate.daysInMonth();

	// First month gets the 'habits' anchor for navigation
	const anchor = month === 0 ? 'habits' : `habits-${month}`;
	const page = addPage(ctx, anchor);

	drawHeader(page, ctx, `Habit Tracker ${monthName}`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${month}-timeline` }
	]);

	const { font, boldFont, margins, pageWidth, pageHeight } = ctx;
	let y = pageHeight - margins.top - 60;

	const habitColWidth = 120;
	const dayWidth = (pageWidth - margins.left - margins.right - habitColWidth) / daysInMonth;
	const rowHeight = 20;

	// Header row - day letters
	page.drawText('Habit', {
		x: margins.left,
		y,
		size: 10,
		font: boldFont,
		color: textColor(ctx)
	});

	// Draw day of week letters
	for (let day = 1; day <= daysInMonth; day++) {
		const dayDate = monthDate.date(day);
		const dayLetter = dayDate.format('dd')[0]; // First letter: M, T, W, T, F, S, S
		const xPos = margins.left + habitColWidth + (day - 1) * dayWidth;

		page.drawText(dayLetter, {
			x: xPos,
			y,
			size: 6,
			font,
			color: mutedTextColor(ctx, 0.5)
		});
	}
	y -= rowHeight * 0.6;

	// Header row - day numbers
	for (let day = 1; day <= daysInMonth; day++) {
		const dayDate = monthDate.date(day);
		const dateStr = dayDate.format('YYYY-MM-DD');
		const xPos = margins.left + habitColWidth + (day - 1) * dayWidth;

		page.drawText(`${day}`, {
			x: xPos,
			y,
			size: 7,
			font,
			color: textColor(ctx)
		});

		// Add pending link to daily page (if daily pages enabled)
		if (config.enableDailyPages) {
			ctx.pendingLinks.push({
				page,
				x: xPos,
				y: y - 4,
				width: dayWidth,
				height: rowHeight,
				targetAnchor: `day-${dateStr}`
			});
		}
	}
	y -= rowHeight;

	// Habit rows
	const radius = Math.min(dayWidth / 2 - 2, 6);

	for (const habit of config.habits) {
		const textY = y - 3; // Align text baseline with circle center
		const circleY = y - 3;

		// Draw habit name or placeholder line
		if (habit.name) {
			page.drawText(habit.name, {
				x: margins.left,
				y: textY,
				size: 9,
				font,
				color: textColor(ctx)
			});
		} else {
			// Draw a blank line for write-in habits
			page.drawLine({
				start: { x: margins.left, y: circleY },
				end: { x: margins.left + habitColWidth - 10, y: circleY },
				thickness: 0.5,
				color: lineColor(ctx)
			});
		}

		// Circles for each day
		for (let day = 1; day <= daysInMonth; day++) {
			const circleX = margins.left + habitColWidth + (day - 1) * dayWidth + dayWidth / 2;
			page.drawEllipse({
				x: circleX,
				y: circleY,
				xScale: radius,
				yScale: radius,
				borderColor: lineColor(ctx),
				borderWidth: 0.5
			});
		}
		y -= rowHeight;
	}
}

function addWeeklyPages(ctx: GeneratorContext, weekNumber: number) {
	const { config } = ctx;
	const weekStart = getWeekStartDate(config.year, weekNumber, config.weekStart);
	const weekEnd = weekStart.add(6, 'day');
	const weekLabel = `Week ${weekNumber}: ${weekStart.format('MMM D')} - ${weekEnd.format('MMM D')}`;

	// Action plan page
	const actionPage = addPage(ctx, `week-${weekNumber}-action`);
	drawHeader(actionPage, ctx, `Weekly Action Plan`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${weekStart.month()}-timeline` }
	]);

	const { font, margins, pageHeight } = ctx;

	actionPage.drawText(weekLabel, {
		x: margins.left,
		y: pageHeight - margins.top - 50,
		size: 12,
		font,
		color: textColor(ctx)
	});

	drawDotGrid(actionPage, ctx);

	// Reflection page
	if (config.weeklyReflectionEnabled) {
		const reflectionPage = addPage(ctx, `week-${weekNumber}-reflection`);
		drawHeader(reflectionPage, ctx, `Weekly Reflection`, [
			{ label: 'Index', anchor: 'index' },
			{ label: 'Week', anchor: `week-${weekNumber}-action` }
		]);

		reflectionPage.drawText(weekLabel, {
			x: margins.left,
			y: pageHeight - margins.top - 50,
			size: 12,
			font,
			color: textColor(ctx)
		});

		drawDotGrid(reflectionPage, ctx);
	}
}

function addDailyPage(ctx: GeneratorContext, date: dayjs.Dayjs) {
	const { config } = ctx;
	const dateStr = date.format('YYYY-MM-DD');
	const displayDate = formatDate(date, config.dateFormat);
	const dayOfWeek = date.format('dddd');

	const page = addPage(ctx, `day-${dateStr}`);

	const weekNumber = config.weekStart === 'monday' ? date.isoWeek() : date.week();

	const headerLinks = [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${date.month()}-timeline` }
	];
	if (config.enableWeeklyPages) {
		headerLinks.push({ label: 'Week', anchor: `week-${weekNumber}-action` });
	}

	drawHeader(page, ctx, `${displayDate} ${dayOfWeek}`, headerLinks);

	drawDotGrid(page, ctx);

	const { font, margins, pageHeight } = ctx;
	let y = pageHeight - margins.top - 60;

	// Show holiday if present
	const holiday = ctx.holidays.get(dateStr);
	if (holiday) {
		page.drawText(`* ${holiday.name}`, {
			x: margins.left,
			y,
			size: 10,
			font,
			color: mutedTextColor(ctx, 0.6)
		});
		y -= 15;
	}

	// Add events for this day
	const dayEvents = config.events.filter(e => e.date === dateStr);
	for (const event of dayEvents.slice(0, 3)) {
		page.drawText(`o ${event.title}`, {
			x: margins.left,
			y,
			size: 10,
			font,
			color: mutedTextColor(ctx, 0.7)
		});
		y -= 15;
	}
}

function addCollectionIndexPages(ctx: GeneratorContext) {
	const page = addPage(ctx, 'collections');
	drawHeader(page, ctx, 'Collections', [{ label: 'Index', anchor: 'index' }]);

	const { font, boldFont, margins, pageHeight, pageWidth, config } = ctx;
	let y = pageHeight - margins.top - 60;
	const lineHeight = 22;

	// Pre-defined collections (no chevron, name is clickable)
	if (config.collections.length > 0) {
		page.drawText('Collections', {
			x: margins.left,
			y,
			size: 14,
			font: boldFont,
			color: textColor(ctx)
		});
		y -= lineHeight * 1.5;

		for (const collection of config.collections) {
			const nameText = collection.name || 'Untitled';
			const nameWidth = font.widthOfTextAtSize(nameText, 12);

			// Collection name (clickable)
			page.drawText(nameText, {
				x: margins.left + 10,
				y,
				size: 12,
				font,
				color: textColor(ctx)
			});

			// Page count indicator if multiple pages
			if (collection.pages > 1) {
				const pageCountText = `(${collection.pages} pages)`;
				page.drawText(pageCountText, {
					x: margins.left + 15 + nameWidth,
					y,
					size: 9,
					font,
					color: mutedTextColor(ctx, 0.5)
				});
			}

			// Add pending link on the name only
			ctx.pendingLinks.push({
				page,
				x: margins.left + 10,
				y: y - 4,
				width: nameWidth + 5,
				height: lineHeight,
				targetAnchor: `collection-${collection.id}`
			});

			y -= lineHeight;
		}
		y -= lineHeight;
	}

	// Write-in slots with chevron links
	if (config.writeInCollectionSlots > 0) {
		const chevron = '>';
		const chevronWidth = font.widthOfTextAtSize(chevron, 12);
		const chevronX = pageWidth - margins.right - chevronWidth;
		let currentPage = page;

		for (let i = 0; i < config.writeInCollectionSlots; i++) {
			// Check if we need a new page
			if (y < margins.bottom + lineHeight * 2) {
				currentPage = addPage(ctx, `collections-${i}`);
				drawHeader(currentPage, ctx, 'Collections', [{ label: 'Index', anchor: 'index' }]);
				y = pageHeight - margins.top - 60;
			}

			// Line for writing collection name
			currentPage.drawLine({
				start: { x: margins.left + 10, y },
				end: { x: chevronX - 10, y },
				thickness: 0.5,
				color: lineColor(ctx)
			});

			// Chevron link
			currentPage.drawText(chevron, {
				x: chevronX,
				y,
				size: 12,
				font,
				color: mutedTextColor(ctx, 0.6)
			});

			// Add link on chevron only
			ctx.pendingLinks.push({
				page: currentPage,
				x: chevronX - 5,
				y: y - 4,
				width: chevronWidth + 10,
				height: lineHeight,
				targetAnchor: `write-in-collection-${i}`
			});

			y -= lineHeight;
		}
	}
}

function addCollectionPages(ctx: GeneratorContext, collection: { id: string; name: string; pages: number; template: string }) {
	for (let i = 0; i < collection.pages; i++) {
		const anchor = i === 0 ? `collection-${collection.id}` : `collection-${collection.id}-${i + 1}`;
		const page = addPage(ctx, anchor);

		drawHeader(page, ctx, collection.name, [
			{ label: 'Index', anchor: 'index' },
			{ label: 'Collections', anchor: 'collections' }
		]);

		if (collection.template === 'checklist') {
			// Draw checklist with checkboxes
			drawChecklist(page, ctx);
		} else if (collection.template !== 'blank') {
			drawDotGrid(page, ctx);
		}
	}
}

function addWriteInCollectionPages(ctx: GeneratorContext, slotIndex: number) {
	const { config } = ctx;
	const pagesPerSlot = config.writeInCollectionPages || 1;

	for (let i = 0; i < pagesPerSlot; i++) {
		// First page gets the anchor for linking
		const anchor = i === 0 ? `write-in-collection-${slotIndex}` : undefined;
		const page = addPage(ctx, anchor);

		// Generic title - user can write their own
		drawHeader(page, ctx, 'Collection', [
			{ label: 'Index', anchor: 'index' },
			{ label: 'Collections', anchor: 'collections' }
		]);

		drawDotGrid(page, ctx);
	}
}

function drawChecklist(page: PDFPage, ctx: GeneratorContext) {
	const { margins, pageHeight, pageWidth } = ctx;
	const startY = pageHeight - margins.top - 50;
	const lineHeight = 22;
	const checkboxSize = 10;
	const checkboxX = margins.left;

	let y = startY;

	while (y > margins.bottom + lineHeight) {
		// Draw checkbox square
		page.drawRectangle({
			x: checkboxX,
			y: y - checkboxSize + 2,
			width: checkboxSize,
			height: checkboxSize,
			borderWidth: 0.75,
			borderColor: lineColor(ctx),
			color: rgb(1, 1, 1)
		});

		// Draw line for text
		page.drawLine({
			start: { x: checkboxX + checkboxSize + 8, y: y - 2 },
			end: { x: pageWidth - margins.right, y: y - 2 },
			thickness: 0.5,
			color: lineColor(ctx)
		});

		y -= lineHeight;
	}
}

function addNotesPage(ctx: GeneratorContext, pageNum: number) {
	const anchor = pageNum === 1 ? 'notes' : undefined;
	const page = addPage(ctx, anchor);
	drawHeader(page, ctx, 'Notes', [{ label: 'Index', anchor: 'index' }]);
	drawDotGrid(page, ctx);
}

// Helper functions

function getWeeksInYear(year: number, weekStart: 'sunday' | 'monday'): number {
	const lastDay = dayjs(`${year}-12-31`);
	return weekStart === 'monday' ? lastDay.isoWeek() : lastDay.week();
}

function getWeekStartDate(year: number, weekNumber: number, weekStart: 'sunday' | 'monday'): dayjs.Dayjs {
	if (weekStart === 'monday') {
		return dayjs().year(year).isoWeek(weekNumber).startOf('isoWeek');
	}
	return dayjs().year(year).week(weekNumber).startOf('week');
}

function formatDate(date: dayjs.Dayjs, format: string): string {
	switch (format) {
		case 'short':
			return date.format('M/D');
		case 'medium':
			return date.format('MMM D');
		case 'long':
			return date.format('MMMM D');
		case 'numeric':
			return date.format('D');
		default:
			return date.format('MMM D');
	}
}
