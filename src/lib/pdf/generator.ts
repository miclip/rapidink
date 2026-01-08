import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont, PDFImage } from 'pdf-lib';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import type { RapidInkConfig, Collection } from '../config';
import { DEVICES, pxToPoints, getContentWidth } from '../devices';
import { PageRegistry, createInternalLink } from './links';
import { getHolidaysForYear, type Holiday } from '../holidays';

// Navigation icon mappings (short labels for nav bar)
const NAV_ICONS: Record<string, string> = {
	'guide': 'Gu',
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

// Scale a value based on context scale factor
function s(ctx: GeneratorContext, value: number): number {
	return value * ctx.scale;
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
	// Flow diagram image for guide page
	flowDiagramImage?: PDFImage;
	// Scale factor for responsive layouts (1.0 = Paper Pro reference size)
	scale: number;
}

// Reference device for scaling calculations (Paper Pro in portrait)
const REFERENCE_HEIGHT_PT = 679; // Paper Pro: 2160px at 229dpi ≈ 679pt

export interface GeneratorProgress {
	phase: string;
	current: number;
	total: number;
	message: string;
}

export type ProgressCallback = (progress: GeneratorProgress) => void;

export async function generatePDF(
	config: RapidInkConfig,
	onProgress?: ProgressCallback,
	basePath: string = ''
): Promise<Uint8Array> {
	const doc = await PDFDocument.create();

	const device = DEVICES[config.device] || DEVICES['remarkable-1-2'];

	// Handle orientation - swap dimensions to match requested orientation
	const isNaturallyLandscape = device.width > device.height;
	// Swap if: naturally portrait but want landscape, OR naturally landscape but want portrait
	const shouldSwap = (isNaturallyLandscape && config.orientation === 'portrait') ||
		(!isNaturallyLandscape && config.orientation === 'landscape');

	const deviceWidth = shouldSwap ? device.height : device.width;
	const deviceHeight = shouldSwap ? device.width : device.height;
	// Use toolbar in the device's native orientation, disable when swapped
	const toolbarWidth = shouldSwap ? 0 : device.toolbarWidth;

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

	// Calculate scale factor early so we can use it for margins
	const scale = pageHeight / REFERENCE_HEIGHT_PT;

	const toolbarPadding = pxToPoints(toolbarWidth, device.dpi);
	const extraBuffer = 15 * scale; // Extra space to prevent toolbar overlap
	const baseMarginV = 40 * scale;
	const baseMarginH = 20 * scale;
	const margins = {
		top: config.toolbarPosition === 'top' ? toolbarPadding + baseMarginV + extraBuffer : baseMarginV,
		right: config.toolbarPosition === 'right' ? toolbarPadding + baseMarginH + extraBuffer : baseMarginH,
		bottom: config.toolbarPosition === 'bottom' ? toolbarPadding + baseMarginV + extraBuffer : baseMarginV,
		left: config.toolbarPosition === 'left' ? toolbarPadding + baseMarginH + extraBuffer : baseMarginH
	};

	// Load flow diagram image for guide page
	let flowDiagramImage: PDFImage | undefined;
	try {
		const imageResponse = await fetch(`${basePath}/bujo-flow.png`);
		if (imageResponse.ok) {
			const imageBytes = await imageResponse.arrayBuffer();
			flowDiagramImage = await doc.embedPng(imageBytes);
		}
	} catch {
		// Image not available, will fall back to text
	}

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
		holidays: holidaysMap,
		flowDiagramImage,
		scale
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
			const { month: actualMonth, year: actualYear } = getActualMonthYear(month, config.year, config.startMonth || 0);
			report('monthly', month + 1, monthCount, `Generating ${dayjs(`${actualYear}-${actualMonth + 1}-01`).format('MMMM')}...`);
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
			await addCollectionPages(ctx, collection);
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

// Navigation link sets for different page types (ordered by workflow)
const REFERENCE_NAV_IDS = ['guide', 'index', 'intention', 'goals', 'future-log', 'collections'];
const CALENDAR_NAV_IDS = ['index', 'monthly', 'habits', 'weekly', 'collections'];

function drawHeader(
	page: PDFPage,
	ctx: GeneratorContext,
	title: string,
	navLinks: Array<{ label: string; anchor: string }>,
	options?: {
		linkOverrides?: Record<string, string>; // Override link targets (e.g., { habits: 'habits-3' })
		showNav?: boolean; // Whether to show the navigation bar (default: true)
		navType?: 'reference' | 'calendar'; // Which nav links to show (default: 'calendar')
	}
) {
	const { font, boldFont, margins, pageWidth, pageHeight, config } = ctx;
	const y = pageHeight - margins.top;
	const navFontSize = s(ctx, 9);
	const titleSize = s(ctx, 16);
	const linkHeight = s(ctx, 20); // Touch-friendly height
	const navGap = s(ctx, 1);
	const minLinkWidth = s(ctx, 22);
	const showNav = options?.showNav !== false;
	const navType = options?.navType || 'calendar';
	const allowedIds = navType === 'reference' ? REFERENCE_NAV_IDS : CALENDAR_NAV_IDS;

	// Calculate nav width first to reserve space
	// Reference pages use 'enabled', calendar pages use 'enabledOnCalendar'
	const enabledLinks = showNav
		? config.navigationLinks.filter(l => {
			const isEnabled = navType === 'reference' ? l.enabled : l.enabledOnCalendar;
			return isEnabled && allowedIds.includes(l.id);
		})
		: [];
	let totalNavWidth = 0;
	for (const link of enabledLinks) {
		const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
		const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + s(ctx, 4), minLinkWidth);
		totalNavWidth += linkWidth + navGap;
	}

	// Title (left side, with max width to avoid overlap)
	const maxTitleWidth = pageWidth - margins.left - margins.right - totalNavWidth - s(ctx, 20);
	let displayTitle = title;
	let titleWidth = boldFont.widthOfTextAtSize(displayTitle, titleSize);

	// Truncate title if too long
	while (titleWidth > maxTitleWidth && displayTitle.length > 10) {
		displayTitle = displayTitle.substring(0, displayTitle.length - 4) + '...';
		titleWidth = boldFont.widthOfTextAtSize(displayTitle, titleSize);
	}

	page.drawText(displayTitle, {
		x: margins.left,
		y,
		size: titleSize,
		font: boldFont,
		color: textColor(ctx)
	});

	// Navigation icons (right-aligned) - store pending links for second pass
	if (showNav) {
		let navX = pageWidth - margins.right;

		for (let i = enabledLinks.length - 1; i >= 0; i--) {
			const link = enabledLinks[i];
			const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
			const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + s(ctx, 4), minLinkWidth);
			navX -= linkWidth;

			// Draw icon text
			page.drawText(icon, {
				x: navX + s(ctx, 2),
				y: y + s(ctx, 2),
				size: navFontSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});

			// Store pending link for second pass (after all pages exist)
			// Use override target if provided, otherwise use the link id
			const targetAnchor = options?.linkOverrides?.[link.id] || link.id;
			ctx.pendingLinks.push({
				page,
				x: navX,
				y: y - s(ctx, 5),
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

	const titleSize = s(ctx, 48);
	const subtitleSize = s(ctx, 24);

	const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
	const subtitleWidth = boldFont.widthOfTextAtSize(subtitle, subtitleSize);

	page.drawText(title, {
		x: (pageWidth - titleWidth) / 2,
		y: pageHeight / 2 + s(ctx, 40),
		size: titleSize,
		font: boldFont,
		color: textColor(ctx)
	});

	page.drawText(subtitle, {
		x: (pageWidth - subtitleWidth) / 2,
		y: pageHeight / 2 - s(ctx, 20),
		size: subtitleSize,
		font: boldFont,
		color: mutedTextColor(ctx, 0.85)
	});

	// Fine print at bottom of cover
	const { font, margins } = ctx;
	const finePrintSize = s(ctx, 7);
	const finePrintLines = [
		'This planner uses the Bullet Journal® method. Bullet Journal® is a registered trademark of Lightcage, LLC.',
		'This project is not affiliated with or endorsed by Bullet Journal® or Ryder Carroll. Learn more at bulletjournal.com'
	];
	let finePrintY = margins.bottom + s(ctx, 20);
	for (const line of finePrintLines.reverse()) {
		const lineWidth = font.widthOfTextAtSize(line, finePrintSize);
		page.drawText(line, {
			x: (pageWidth - lineWidth) / 2,
			y: finePrintY,
			size: finePrintSize,
			font,
			color: mutedTextColor(ctx, 0.85)
		});
		finePrintY += s(ctx, 10);
	}
}

function addIndexPages(ctx: GeneratorContext) {
	let page = addPage(ctx, 'index');

	// Build nav links from enabled sections
	const navLinks: Array<{ label: string; anchor: string }> = [];
	if (ctx.config.enableGuide) navLinks.push({ label: 'Guide', anchor: 'guide' });
	if (ctx.config.enableIntention) navLinks.push({ label: 'Int', anchor: 'intention' });
	if (ctx.config.enableGoals) navLinks.push({ label: 'Goals', anchor: 'goals' });
	if (ctx.config.enableFutureLog) navLinks.push({ label: 'Fut', anchor: 'future-log' });
	if (ctx.config.enableHabitTracker) navLinks.push({ label: 'Hab', anchor: 'habits' });
	if (ctx.config.enableCollections) navLinks.push({ label: 'Col', anchor: 'collections' });

	drawHeader(page, ctx, 'Index', navLinks, { navType: 'reference' });

	const { font, boldFont, margins, pageHeight, pageWidth, config } = ctx;
	let y = pageHeight - margins.top - s(ctx, 40); // Extra space after header before first month
	const lineHeight = s(ctx, 13);
	const fontSize = s(ctx, 12);
	const smallFontSize = s(ctx, 10);
	const tinyFontSize = s(ctx, 9);
	const monthCount = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount : 12;
	const contentWidth = pageWidth - margins.left - margins.right;

	// Unified calendar index - one layout for monthly, weekly, daily
	const monthBlockHeight = lineHeight * 3.5; // Month name + day letters + days + week indicators
	const dayWidth = contentWidth / 31;

	for (let month = 0; month < monthCount; month++) {
		const { month: actualMonth, year: actualYear } = getActualMonthYear(month, config.year, config.startMonth || 0);
		const monthDate = dayjs(`${actualYear}-${actualMonth + 1}-01`);
		const monthName = monthDate.format('MMMM');
		const daysInMonth = monthDate.daysInMonth();

		// Check if we need a new page
		if (y - monthBlockHeight < margins.bottom + s(ctx, 10)) {
			page = addPage(ctx, `index-${month}`);
			drawHeader(page, ctx, 'Index', navLinks, { navType: 'reference' });
			y = pageHeight - margins.top - s(ctx, 25);
		}

		// Month name (clickable to monthly page)
		const monthTextWidth = boldFont.widthOfTextAtSize(monthName, fontSize);
		let xPos = margins.left;

		page.drawText(monthName, {
			x: xPos,
			y,
			size: fontSize,
			font: boldFont,
			color: textColor(ctx)
		});

		if (config.enableMonthlyPages) {
			ctx.pendingLinks.push({
				page,
				x: xPos,
				y: y - s(ctx, 4),
				width: monthTextWidth,
				height: lineHeight,
				targetAnchor: `month-${month}-timeline`
			});
		}
		xPos += monthTextWidth;

		// Habit tracker link inline with separator
		if (config.enableHabitTracker) {
			const separator = ' | ';
			const habText = 'Monthly Habit Tracker';
			const separatorWidth = font.widthOfTextAtSize(separator, tinyFontSize);
			const habTextWidth = font.widthOfTextAtSize(habText, tinyFontSize);

			page.drawText(separator, {
				x: xPos,
				y,
				size: tinyFontSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});
			xPos += separatorWidth;

			page.drawText(habText, {
				x: xPos,
				y,
				size: tinyFontSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});

			// Use correct anchor: 'habits' for month 0, 'habits-N' for others
			const habitAnchor = month === 0 ? 'habits' : `habits-${month}`;
			ctx.pendingLinks.push({
				page,
				x: xPos - s(ctx, 2),
				y: y - s(ctx, 4),
				width: habTextWidth + s(ctx, 4),
				height: lineHeight,
				targetAnchor: habitAnchor
			});
		}

		y -= lineHeight * 0.9;

		// Day of week letters above each day number
		const microFontSize = s(ctx, 6);
		const miniDaySize = s(ctx, 8);
		const weekNumSize = s(ctx, 7);
		for (let day = 1; day <= daysInMonth; day++) {
			const date = monthDate.date(day);
			const dayOfWeek = date.format('dd')[0]; // First letter: M, T, W, T, F, S, S
			const xPos = margins.left + (day - 1) * dayWidth;

			page.drawText(dayOfWeek, {
				x: xPos,
				y,
				size: microFontSize,
				font,
				color: mutedTextColor(ctx, 0.85)
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
				size: miniDaySize,
				font,
				color: textColor(ctx)
			});

			if (config.enableDailyPages) {
				ctx.pendingLinks.push({
					page,
					x: xPos - s(ctx, 2),
					y: y - s(ctx, 4),
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
			const endX = margins.left + weekEndDay * dayWidth - s(ctx, 2);
			const weekNumText = `${weekNum}`;
			const weekNumWidth = font.widthOfTextAtSize(weekNumText, weekNumSize);

			// Week number
			page.drawText(weekNumText, {
				x: startX,
				y,
				size: weekNumSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});

			// Underline spanning the week
			page.drawLine({
				start: { x: startX + weekNumWidth + s(ctx, 2), y: y + s(ctx, 3) },
				end: { x: endX, y: y + s(ctx, 3) },
				thickness: s(ctx, 0.5),
				color: lineColor(ctx)
			});

			// Add link to weekly page
			if (config.enableWeeklyPages) {
				ctx.pendingLinks.push({
					page,
					x: startX,
					y: y - s(ctx, 4),
					width: endX - startX,
					height: lineHeight,
					targetAnchor: `week-${weekNum}-action`
				});
			}

			currentDay = weekEndDay + 1;
		}

		y -= lineHeight * 1.2;
	}
}

function addGuidePage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'guide');
	drawHeader(page, ctx, 'Guide & Legend', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });
	drawDotGrid(page, ctx);

	const { font, boldFont, margins, pageHeight } = ctx;
	let y = pageHeight - margins.top - s(ctx, 40);
	const lineHeight = s(ctx, 18);
	const headingSize = s(ctx, 14);
	const textSize = s(ctx, 12);
	const smallTextSize = s(ctx, 11);

	// Symbol Key
	page.drawText('Rapid Logging Symbols', {
		x: margins.left,
		y,
		size: headingSize,
		font: boldFont,
		color: textColor(ctx)
	});
	y -= lineHeight * 1.5;

	const symbols = [
		{ symbol: '.', meaning: 'Task (incomplete)' },
		{ symbol: 'x', meaning: 'Task (complete)' },
		{ symbol: '>', meaning: 'Task (migrated forward)' },
		{ symbol: '<', meaning: 'Task (scheduled to future)' },
		{ symbol: '.', meaning: 'Task (irrelevant)', strikethrough: true },
		{ symbol: '-', meaning: 'Note' },
		{ symbol: 'o', meaning: 'Event' },
		{ symbol: '=', meaning: 'Mood / Feeling' }
	];

	for (const item of symbols) {
		const { symbol, meaning } = item;
		const hasStrikethrough = 'strikethrough' in item && item.strikethrough;

		page.drawText(symbol, {
			x: margins.left + s(ctx, 20),
			y,
			size: headingSize,
			font: boldFont,
			color: textColor(ctx)
		});
		page.drawText(meaning, {
			x: margins.left + s(ctx, 50),
			y,
			size: textSize,
			font,
			color: textColor(ctx)
		});

		// Draw strikethrough line if needed (only through the meaning text)
		if (hasStrikethrough) {
			const textWidth = font.widthOfTextAtSize(meaning, textSize);
			page.drawLine({
				start: { x: margins.left + s(ctx, 50), y: y + s(ctx, 4) },
				end: { x: margins.left + s(ctx, 50) + textWidth, y: y + s(ctx, 4) },
				thickness: s(ctx, 1),
				color: textColor(ctx)
			});
		}

		y -= lineHeight;
	}

	y -= lineHeight;

	// Flow diagram - use image if available, otherwise text fallback
	page.drawText('Planning Flow', {
		x: margins.left,
		y,
		size: headingSize,
		font: boldFont,
		color: textColor(ctx)
	});
	y -= lineHeight * 1.5;

	if (ctx.flowDiagramImage) {
		// Draw the flow diagram image
		const imgWidth = ctx.flowDiagramImage.width;
		const imgHeight = ctx.flowDiagramImage.height;
		const availableWidth = ctx.contentWidth - margins.left - margins.right;
		const maxHeight = s(ctx, 220); // Limit height to leave room for T.A.M.E. section

		// Scale to fit available space
		const imgScale = Math.min(availableWidth / imgWidth, maxHeight / imgHeight);
		const drawWidth = imgWidth * imgScale;
		const drawHeight = imgHeight * imgScale;

		// Center the image horizontally
		const centerX = margins.left + (availableWidth - drawWidth) / 2;

		page.drawImage(ctx.flowDiagramImage, {
			x: centerX,
			y: y - drawHeight,
			width: drawWidth,
			height: drawHeight
		});

		y -= drawHeight + lineHeight;
	} else {
		// Fallback to text version if image not available
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
				x: margins.left + s(ctx, 20),
				y,
				size: smallTextSize,
				font,
				color: textColor(ctx)
			});
			y -= lineHeight * 0.9;
		}

		y -= lineHeight;
	}

	// T.A.M.E. Reflection
	page.drawText('Reflection (T.A.M.E.)', {
		x: margins.left,
		y,
		size: headingSize,
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
			x: margins.left + s(ctx, 20),
			y,
			size: smallTextSize,
			font,
			color: textColor(ctx)
		});
		y -= lineHeight;
	}
}

function addIntentionPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'intention');
	drawHeader(page, ctx, 'Intention', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });
	drawDotGrid(page, ctx);

	const { font, margins } = ctx;

	page.drawText(
		'An intention is a commitment to a process. Set your compass for the year.',
		{
			x: margins.left,
			y: margins.bottom + s(ctx, 10),
			size: s(ctx, 10),
			font,
			color: mutedTextColor(ctx, 0.8)
		}
	);
}

function addGoalsPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'goals');
	drawHeader(page, ctx, 'Goals', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });
	drawDotGrid(page, ctx);

	const { font, margins } = ctx;

	page.drawText(
		'Goals define outcomes. Transform dreams into tangible targets.',
		{
			x: margins.left,
			y: margins.bottom + s(ctx, 10),
			size: s(ctx, 10),
			font,
			color: mutedTextColor(ctx, 0.8)
		}
	);
}

function addFutureLogPages(ctx: GeneratorContext) {
	// Page 1: Jan-Jun
	const page1 = addPage(ctx, 'future-log');
	drawHeader(page1, ctx, 'Future Log', [], { navType: 'reference' });
	drawDotGrid(page1, ctx);

	const { font, boldFont, margins, pageWidth, pageHeight } = ctx;
	const colWidth = (pageWidth - margins.left - margins.right) / 2;
	let y = pageHeight - margins.top - s(ctx, 40);
	const monthHeight = (pageHeight - margins.top - margins.bottom - s(ctx, 40)) / 3;
	const futureLogFontSize = s(ctx, 12);

	for (let i = 0; i < 6; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const x = margins.left + col * colWidth;
		const yPos = y - row * monthHeight;

		const monthName = dayjs().month(i).format('MMMM');
		const textWidth = boldFont.widthOfTextAtSize(monthName, futureLogFontSize);

		page1.drawText(monthName, {
			x,
			y: yPos,
			size: futureLogFontSize,
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
	drawHeader(page2, ctx, 'Future Log', [], { navType: 'reference' });
	drawDotGrid(page2, ctx);
	y = pageHeight - margins.top - s(ctx, 40);

	for (let i = 6; i < 12; i++) {
		const col = (i - 6) % 2;
		const row = Math.floor((i - 6) / 2);
		const x = margins.left + col * colWidth;
		const yPos = y - row * monthHeight;

		const monthName = dayjs().month(i).format('MMMM');
		const monthFontSize = s(ctx, 12);
		const textWidth = boldFont.widthOfTextAtSize(monthName, monthFontSize);

		page2.drawText(monthName, {
			x,
			y: yPos,
			size: monthFontSize,
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
	const { month: actualMonth, year: actualYear } = getActualMonthYear(month, config.year, config.startMonth || 0);
	const monthDate = dayjs(`${actualYear}-${actualMonth + 1}-01`);
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

	// Draw background pattern based on user's visibility setting (dots/grid/lines/blank)
	drawDotGrid(timelinePage, ctx);

	const { font, margins, pageHeight } = ctx;
	const daysInMonth = monthDate.daysInMonth();

	// Use scaled line height for consistent spacing across devices
	const lineHeight = s(ctx, 14); // Base ~5mm spacing, scaled for device

	// Start content at consistent position like other pages
	let y = pageHeight - margins.top - s(ctx, 40);

	let lastWeekNum = -1;

	for (let day = 1; day <= daysInMonth; day++) {
		const date = monthDate.date(day);
		const dayOfWeek = date.format('ddd')[0]; // First letter: M, T, W, etc.
		const isWeekend = date.day() === 0 || date.day() === 6;
		const dayText = `${day}`;
		const dateStr = date.format('YYYY-MM-DD');
		const holiday = ctx.holidays.get(dateStr);
		const weekNum = config.weekStart === 'monday' ? date.isoWeek() : date.week();

		// Day number
		const dayFontSize = s(ctx, 10);
		timelinePage.drawText(dayText, {
			x: margins.left,
			y,
			size: dayFontSize,
			font,
			color: isWeekend ? mutedTextColor(ctx, 0.85) : textColor(ctx)
		});

		// Add pending link to daily page (only if daily pages enabled) - just day number
		if (config.enableDailyPages) {
			ctx.pendingLinks.push({
				page: timelinePage,
				x: margins.left,
				y: y - 4,
				width: 14,
				height: lineHeight,
				targetAnchor: `day-${dateStr}`
			});
		}

		// Week number indicator between day and weekday letter (at start of each week)
		if (weekNum !== lastWeekNum) {
			const weekNumText = `${weekNum}`;
			const weekNumFontSize = s(ctx, 8);
			const weekNumWidth = font.widthOfTextAtSize(weekNumText, weekNumFontSize);
			const weekIndicatorX = margins.left + s(ctx, 15);

			timelinePage.drawText(weekNumText, {
				x: weekIndicatorX,
				y,
				size: weekNumFontSize,
				font,
				color: mutedTextColor(ctx, 0.85)
			});

			// Add link to weekly page
			if (config.enableWeeklyPages) {
				ctx.pendingLinks.push({
					page: timelinePage,
					x: weekIndicatorX - 2,
					y: y - 4,
					width: weekNumWidth + 4,
					height: lineHeight,
					targetAnchor: `week-${weekNum}-action`
				});
			}

			lastWeekNum = weekNum;
		}

		// Day of week letter
		timelinePage.drawText(dayOfWeek, {
			x: margins.left + s(ctx, 28),
			y,
			size: dayFontSize,
			font,
			color: isWeekend ? mutedTextColor(ctx, 0.85) : textColor(ctx)
		});

		// Show holiday name if present
		if (holiday) {
			timelinePage.drawText(holiday.name, {
				x: margins.left + s(ctx, 42),
				y,
				size: s(ctx, 8),
				font,
				color: mutedTextColor(ctx, 0.8)
			});
		}

		y -= lineHeight;
	}

	// Action plan page
	const actionPage = addPage(ctx, `month-${month}-action`);
	drawHeader(actionPage, ctx, `${monthName} - Action Plan`, headerLinks, { linkOverrides: { habits: habitAnchor } });
	drawDotGrid(actionPage, ctx);
}

function addHabitTrackerPage(ctx: GeneratorContext, month: number) {
	const { config } = ctx;
	const { month: actualMonth, year: actualYear } = getActualMonthYear(month, config.year, config.startMonth || 0);
	const monthDate = dayjs(`${actualYear}-${actualMonth + 1}-01`);
	const monthName = monthDate.format('MMMM');
	const daysInMonth = monthDate.daysInMonth();

	// First month gets the 'habits' anchor for navigation
	const anchor = month === 0 ? 'habits' : `habits-${month}`;
	const page = addPage(ctx, anchor);

	// Override nav links to point to current month
	const linkOverrides: Record<string, string> = {
		monthly: `month-${month}-timeline`
	};

	drawHeader(page, ctx, `Habit Tracker ${monthName}`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${month}-timeline` }
	], { linkOverrides });

	const { font, boldFont, margins, pageWidth, pageHeight } = ctx;
	let y = pageHeight - margins.top - s(ctx, 40);

	const habitColWidth = s(ctx, 120);
	const dayWidth = (pageWidth - margins.left - margins.right - habitColWidth) / daysInMonth;
	const rowHeight = s(ctx, 20);
	const habitLabelSize = s(ctx, 10);
	const dayLetterSize = s(ctx, 6);
	const dayNumSize = s(ctx, 7);
	const habitNameSize = s(ctx, 9);

	// Header row - day letters
	page.drawText('Habit', {
		x: margins.left,
		y,
		size: habitLabelSize,
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
			size: dayLetterSize,
			font,
			color: mutedTextColor(ctx, 0.85)
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
			size: dayNumSize,
			font,
			color: textColor(ctx)
		});

		// Add pending link to daily page (if daily pages enabled)
		if (config.enableDailyPages) {
			ctx.pendingLinks.push({
				page,
				x: xPos,
				y: y - s(ctx, 4),
				width: dayWidth,
				height: rowHeight,
				targetAnchor: `day-${dateStr}`
			});
		}
	}
	y -= rowHeight;

	// Habit rows
	const radius = Math.min(dayWidth / 2 - s(ctx, 2), s(ctx, 6));

	for (const habit of config.habits) {
		const textY = y - s(ctx, 3); // Align text baseline with circle center
		const circleY = y - s(ctx, 3);

		// Draw habit name or placeholder line
		if (habit.name) {
			page.drawText(habit.name, {
				x: margins.left,
				y: textY,
				size: habitNameSize,
				font,
				color: textColor(ctx)
			});
		} else {
			// Draw a blank line for write-in habits
			page.drawLine({
				start: { x: margins.left, y: circleY },
				end: { x: margins.left + habitColWidth - s(ctx, 10), y: circleY },
				thickness: s(ctx, 0.5),
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
				borderWidth: s(ctx, 0.5)
			});
		}
		y -= rowHeight;
	}
}

function addWeeklyPages(ctx: GeneratorContext, weekNumber: number) {
	const { config } = ctx;
	const weekStart = getWeekStartDate(config.year, weekNumber, config.weekStart);

	// Find the month to link to - use first day of week that's in the configured year
	let monthToLink = weekStart.month();
	for (let i = 0; i < 7; i++) {
		const day = weekStart.add(i, 'day');
		if (day.year() === config.year) {
			monthToLink = day.month();
			break;
		}
	}

	// Override nav links to point to current month/week
	const linkOverrides: Record<string, string> = {
		monthly: `month-${monthToLink}-timeline`,
		weekly: `week-${weekNumber}-action`
	};

	// Action plan page
	const actionPage = addPage(ctx, `week-${weekNumber}-action`);
	drawHeader(actionPage, ctx, `Weekly Action Plan`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${weekStart.month()}-timeline` }
	], { linkOverrides });

	const { font, margins, pageHeight } = ctx;
	const subheadingY = pageHeight - margins.top - s(ctx, 40);

	// Draw week number and day links
	drawWeekDayLinks(actionPage, ctx, weekNumber, weekStart, subheadingY);

	drawDotGrid(actionPage, ctx);

	// Reflection page
	if (config.weeklyReflectionEnabled) {
		const reflectionPage = addPage(ctx, `week-${weekNumber}-reflection`);
		drawHeader(reflectionPage, ctx, `Weekly Reflection`, [], { linkOverrides });

		drawDotGrid(reflectionPage, ctx);
	}
}

function drawWeekDayLinks(page: PDFPage, ctx: GeneratorContext, weekNumber: number, weekStart: dayjs.Dayjs, y: number) {
	const { font, margins, config } = ctx;
	let xPos = margins.left;
	const weekPrefixSize = s(ctx, 11);
	const dayFontSize = s(ctx, 9);

	// Week number prefix
	const weekPrefix = `Week ${weekNumber}: `;
	page.drawText(weekPrefix, {
		x: xPos,
		y,
		size: weekPrefixSize,
		font,
		color: textColor(ctx)
	});
	xPos += font.widthOfTextAtSize(weekPrefix, weekPrefixSize);

	// Draw each day: "6 M, 7 T, 8 W, 9 T, 10 F, 11 S, 12 S"
	for (let i = 0; i < 7; i++) {
		const date = weekStart.add(i, 'day');
		const dayNum = date.date();
		const dayLetter = date.format('dd')[0]; // M, T, W, T, F, S, S
		const dayText = `${dayNum} ${dayLetter}`;
		const dayTextWidth = font.widthOfTextAtSize(dayText, dayFontSize);
		const isWeekend = date.day() === 0 || date.day() === 6;
		const isInYear = date.year() === config.year;

		// Color: not in year = very muted, weekend = muted, weekday = normal
		let dayColor;
		if (!isInYear) {
			dayColor = mutedTextColor(ctx, 0.85); // Muted for days outside year
		} else if (isWeekend) {
			dayColor = mutedTextColor(ctx, 0.85); // Muted for weekends
		} else {
			dayColor = config.enableDailyPages ? textColor(ctx) : mutedTextColor(ctx, 0.8);
		}

		page.drawText(dayText, {
			x: xPos,
			y,
			size: dayFontSize,
			font,
			color: dayColor
		});

		// Add link to daily page if enabled AND day is in the configured year
		if (config.enableDailyPages && isInYear) {
			const dateStr = date.format('YYYY-MM-DD');
			ctx.pendingLinks.push({
				page,
				x: xPos - s(ctx, 2),
				y: y - s(ctx, 4),
				width: dayTextWidth + s(ctx, 4),
				height: s(ctx, 14),
				targetAnchor: `day-${dateStr}`
			});
		}

		xPos += dayTextWidth;

		// Add comma separator (except after last day)
		if (i < 6) {
			page.drawText(', ', {
				x: xPos,
				y,
				size: weekPrefixSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});
			xPos += font.widthOfTextAtSize(', ', weekPrefixSize);
		}
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

	// Override nav links to point to current month/week
	const linkOverrides: Record<string, string> = {
		monthly: `month-${date.month()}-timeline`,
		weekly: `week-${weekNumber}-action`
	};

	drawHeader(page, ctx, `${displayDate} ${dayOfWeek}`, headerLinks, { linkOverrides });

	const { font, margins, pageHeight } = ctx;

	// Show holiday and events at top (right after header)
	const holiday = ctx.holidays.get(dateStr);
	const dayEvents = config.events.filter(e => e.date === dateStr);
	let eventY = pageHeight - margins.top - s(ctx, 35);
	const eventLineHeight = s(ctx, 14);
	const eventFontSize = s(ctx, 11);
	const eventIndent = s(ctx, 20);

	if (holiday) {
		page.drawText(`o ${holiday.name}`, {
			x: margins.left + eventIndent,
			y: eventY,
			size: eventFontSize,
			font,
			color: textColor(ctx)
		});
		eventY -= eventLineHeight;
	}

	for (const event of dayEvents.slice(0, 3)) {
		page.drawText(`o ${event.title}`, {
			x: margins.left + eventIndent,
			y: eventY,
			size: eventFontSize,
			font,
			color: textColor(ctx)
		});
		eventY -= eventLineHeight;
	}

	drawDotGrid(page, ctx);
}

function addCollectionIndexPages(ctx: GeneratorContext) {
	const page = addPage(ctx, 'collections');
	drawHeader(page, ctx, 'Collections', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });

	const { font, boldFont, margins, pageHeight, pageWidth, config } = ctx;
	let y = pageHeight - margins.top - s(ctx, 40);
	const lineHeight = s(ctx, 18);
	const sectionFontSize = s(ctx, 14);
	const collectionFontSize = s(ctx, 12);
	const pageCountFontSize = s(ctx, 9);
	const indent = s(ctx, 10);

	// Pre-defined collections (no chevron, name is clickable)
	if (config.collections.length > 0) {
		page.drawText('Collections', {
			x: margins.left,
			y,
			size: sectionFontSize,
			font: boldFont,
			color: textColor(ctx)
		});
		y -= lineHeight * 1.5;

		for (const collection of config.collections) {
			const nameText = collection.name || 'Untitled';
			const nameWidth = font.widthOfTextAtSize(nameText, collectionFontSize);

			// Collection name (clickable)
			page.drawText(nameText, {
				x: margins.left + indent,
				y,
				size: collectionFontSize,
				font,
				color: textColor(ctx)
			});

			// Page count indicator if multiple pages
			if (collection.pages > 1) {
				const pageCountText = `(${collection.pages} pages)`;
				page.drawText(pageCountText, {
					x: margins.left + s(ctx, 15) + nameWidth,
					y,
					size: pageCountFontSize,
					font,
					color: mutedTextColor(ctx, 0.85)
				});
			}

			// Add pending link on the name only
			ctx.pendingLinks.push({
				page,
				x: margins.left + indent,
				y: y - s(ctx, 4),
				width: nameWidth + s(ctx, 5),
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
		const chevronWidth = font.widthOfTextAtSize(chevron, collectionFontSize);
		const chevronX = pageWidth - margins.right - chevronWidth;
		let currentPage = page;

		for (let i = 0; i < config.writeInCollectionSlots; i++) {
			// Check if we need a new page
			if (y < margins.bottom + lineHeight * 2) {
				currentPage = addPage(ctx, `collections-${i}`);
				drawHeader(currentPage, ctx, 'Collections', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });
				y = pageHeight - margins.top - s(ctx, 40);
			}

			// Line for writing collection name
			currentPage.drawLine({
				start: { x: margins.left + indent, y },
				end: { x: chevronX - indent, y },
				thickness: s(ctx, 0.5),
				color: lineColor(ctx)
			});

			// Chevron link
			currentPage.drawText(chevron, {
				x: chevronX,
				y,
				size: collectionFontSize,
				font,
				color: mutedTextColor(ctx, 0.8)
			});

			// Add link covering end of line and chevron (larger tap target)
			const linkWidth = indent * 2 + chevronWidth;
			ctx.pendingLinks.push({
				page: currentPage,
				x: chevronX - indent - s(ctx, 5),
				y: y - s(ctx, 2),
				width: linkWidth + s(ctx, 10),
				height: lineHeight,
				targetAnchor: `write-in-collection-${i}`
			});

			y -= lineHeight;
		}
	}
}

async function addCollectionPages(ctx: GeneratorContext, collection: Collection) {
	// Handle PDF template collections
	if (collection.template === 'pdf' && collection.pdfData) {
		await addPdfCollectionPages(ctx, collection);
		return;
	}

	// Standard template handling
	for (let i = 0; i < collection.pages; i++) {
		const anchor = i === 0 ? `collection-${collection.id}` : `collection-${collection.id}-${i + 1}`;
		const page = addPage(ctx, anchor);

		drawHeader(page, ctx, collection.name, [
			{ label: 'Index', anchor: 'index' },
			{ label: 'Collections', anchor: 'collections' }
		], { navType: 'reference' });

		if (collection.template === 'checklist') {
			// Draw checklist with checkboxes
			drawChecklist(page, ctx);
		} else if (collection.template !== 'blank') {
			drawDotGrid(page, ctx);
		}
	}
}

async function addPdfCollectionPages(ctx: GeneratorContext, collection: Collection) {
	const { doc, registry, pageWidth, pageHeight } = ctx;

	// Decode base64 PDF data
	const pdfBytes = Uint8Array.from(atob(collection.pdfData!), c => c.charCodeAt(0));
	const sourcePdf = await PDFDocument.load(pdfBytes);
	const sourcePageCount = sourcePdf.getPageCount();
	const copies = collection.pdfCopies || 1;

	// Embed all pages from source PDF for drawing (allows scaling)
	const embeddedPages = await doc.embedPdf(sourcePdf, Array.from({ length: sourcePageCount }, (_, i) => i));

	let pageIndex = 0;
	for (let copy = 0; copy < copies; copy++) {
		for (let i = 0; i < embeddedPages.length; i++) {
			const embeddedPage = embeddedPages[i];
			const anchor = pageIndex === 0 ? `collection-${collection.id}` : `collection-${collection.id}-${pageIndex + 1}`;

			// Create a new page at target device dimensions
			const page = doc.addPage([pageWidth, pageHeight]);
			registry.registerPage(anchor, page, ctx.currentPageIndex);
			ctx.currentPageIndex++;

			// Calculate scaling to fit the embedded page into target dimensions
			const embeddedDims = embeddedPage.size();
			const scaleX = pageWidth / embeddedDims.width;
			const scaleY = pageHeight / embeddedDims.height;
			const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

			// Center the scaled page
			const scaledWidth = embeddedDims.width * scale;
			const scaledHeight = embeddedDims.height * scale;
			const x = (pageWidth - scaledWidth) / 2;
			const y = (pageHeight - scaledHeight) / 2;

			// Draw the embedded page scaled to fit
			page.drawPage(embeddedPage, {
				x,
				y,
				width: scaledWidth,
				height: scaledHeight
			});

			// Draw overlay nav links if configured
			if (collection.pdfNavLinks && collection.pdfNavLinks.length > 0) {
				drawOverlayNavLinks(page, ctx, collection);
			}

			pageIndex++;
		}
	}

	// Update collection page count to match actual generated pages
	collection.pages = pageIndex;
}

function drawOverlayNavLinks(page: PDFPage, ctx: GeneratorContext, collection: Collection) {
	const { font } = ctx;
	const { width, height } = page.getSize();
	const navLinks = collection.pdfNavLinks || [];
	const position = collection.pdfNavPosition || 'top-right';

	if (navLinks.length === 0) return;

	const navFontSize = s(ctx, 9);
	const padding = s(ctx, 10);
	const navGap = s(ctx, 8); // Gap between links (like regular nav)
	const minLinkWidth = s(ctx, 22);

	// Build nav text parts with anchors
	const navParts: { text: string; anchor: string; width: number }[] = [];
	for (const linkId of navLinks) {
		const label = NAV_ICONS[linkId] || linkId.substring(0, 3);
		const linkWidth = Math.max(font.widthOfTextAtSize(label, navFontSize) + s(ctx, 4), minLinkWidth);
		navParts.push({ text: label, anchor: linkId, width: linkWidth });
	}

	// Calculate total width
	let totalWidth = navParts.reduce((sum, p) => sum + p.width, 0);
	totalWidth += navGap * (navParts.length - 1);

	// Determine position
	let x: number, y: number;
	if (position === 'top-left') {
		x = padding;
		y = height - padding - navFontSize;
	} else if (position === 'top-right') {
		x = width - padding - totalWidth;
		y = height - padding - navFontSize;
	} else if (position === 'bottom-left') {
		x = padding;
		y = padding;
	} else { // bottom-right
		x = width - padding - totalWidth;
		y = padding;
	}

	// Draw nav links (no separator, just spacing like regular nav)
	let currentX = x;

	for (let i = 0; i < navParts.length; i++) {
		const part = navParts[i];

		page.drawText(part.text, {
			x: currentX + s(ctx, 2),
			y,
			size: navFontSize,
			font,
			color: mutedTextColor(ctx, 0.8)
		});

		// Add link
		ctx.pendingLinks.push({
			page,
			x: currentX,
			y: y - s(ctx, 2),
			width: part.width,
			height: navFontSize + s(ctx, 4),
			targetAnchor: part.anchor
		});

		currentX += part.width + navGap;
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
		], { navType: 'reference' });

		drawDotGrid(page, ctx);
	}
}

function drawChecklist(page: PDFPage, ctx: GeneratorContext) {
	const { margins, pageHeight, pageWidth } = ctx;
	const startY = pageHeight - margins.top - s(ctx, 40);
	const lineHeight = s(ctx, 22);
	const checkboxSize = s(ctx, 10);
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
	drawHeader(page, ctx, 'Notes', [{ label: 'Index', anchor: 'index' }], { navType: 'reference' });
	drawDotGrid(page, ctx);
}

// Helper functions

/**
 * Convert planner month index to actual calendar month and year.
 * Handles year wrapping when startMonth > 0.
 * @param plannerMonth - Month index in the planner (0-11)
 * @param baseYear - The configured year
 * @param startMonth - The month to start from (0-11)
 * @returns { month: 0-11, year: number }
 */
function getActualMonthYear(plannerMonth: number, baseYear: number, startMonth: number): { month: number; year: number } {
	const actualMonth = (startMonth + plannerMonth) % 12;
	const yearOffset = Math.floor((startMonth + plannerMonth) / 12);
	return { month: actualMonth, year: baseYear + yearOffset };
}

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
		case 'short-intl':
			return date.format('D/M');
		case 'medium-intl':
			return date.format('D MMM');
		case 'long-intl':
			return date.format('D MMMM');
		default:
			return date.format('MMM D');
	}
}
