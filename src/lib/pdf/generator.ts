import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import type { RapidInkConfig } from '../config';
import { DEVICES, pxToPoints, getContentWidth } from '../devices';
import { PageRegistry, createInternalLink } from './links';

// Navigation icon mappings (short labels for nav bar)
const NAV_ICONS: Record<string, string> = {
	'index': 'Idx',
	'monthly': 'Mo',
	'weekly': 'Wk',
	'intention': 'Int',
	'goals': 'Go',
	'habits': 'Hab',
	'collections': 'Col'
};

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(dayOfYear);

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
	const pageWidth = pxToPoints(device.width, device.dpi);
	const pageHeight = pxToPoints(device.height, device.dpi);
	const contentWidth = pxToPoints(getContentWidth(device), device.dpi);

	const font = await doc.embedFont(StandardFonts.Helvetica);
	const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

	const margins = {
		top: 40,
		right: config.handedness === 'left' ? pxToPoints(device.toolbarWidth, device.dpi) + 20 : 20,
		bottom: 40,
		left: config.handedness === 'right' ? pxToPoints(device.toolbarWidth, device.dpi) + 20 : 20
	};

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
		pendingLinks: []
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
		const weeksInYear = getWeeksInYear(config.year, config.weekStart);
		report('weekly', 0, weeksInYear, 'Generating weekly pages...');
		for (let week = 1; week <= weeksInYear; week++) {
			report('weekly', week, weeksInYear, `Generating week ${week}...`);
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
		const daysInYear = dayjs(`${config.year}-12-31`).dayOfYear();
		report('daily', 0, daysInYear, 'Generating daily pages...');
		for (let day = 1; day <= daysInYear; day++) {
			const date = dayjs(`${config.year}-01-01`).dayOfYear(day);
			if (day % 30 === 0) {
				report('daily', day, daysInYear, `Generating ${date.format('MMM D')}...`);
			}
			addDailyPage(ctx, date);
		}
	}

	if (config.enableCollections) {
		addCollectionIndexPages(ctx);
		for (const collection of config.collections) {
			addCollectionPages(ctx, collection);
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
	const dotColor = rgb(0, 0, 0);

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
	navLinks: Array<{ label: string; anchor: string }>
) {
	const { font, boldFont, margins, pageWidth, pageHeight, config } = ctx;
	const y = pageHeight - margins.top;
	const navFontSize = 9;
	const linkHeight = 20; // Touch-friendly height
	const navGap = 3;

	// Calculate nav width first to reserve space
	const enabledLinks = config.navigationLinks.filter(l => l.enabled);
	let totalNavWidth = 0;
	for (const link of enabledLinks) {
		const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
		const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + 8, 30);
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
		color: rgb(0, 0, 0)
	});

	// Navigation icons (right-aligned) - store pending links for second pass
	let navX = pageWidth - margins.right;

	for (let i = enabledLinks.length - 1; i >= 0; i--) {
		const link = enabledLinks[i];
		const icon = NAV_ICONS[link.id] || link.label.substring(0, 3);
		const linkWidth = Math.max(font.widthOfTextAtSize(icon, navFontSize) + 8, 30);
		navX -= linkWidth;

		// Draw icon text
		page.drawText(icon, {
			x: navX + 4,
			y: y + 2,
			size: navFontSize,
			font,
			color: rgb(0.4, 0.4, 0.4)
		});

		// Store pending link for second pass (after all pages exist)
		ctx.pendingLinks.push({
			page,
			x: navX,
			y: y - 5,
			width: linkWidth,
			height: linkHeight,
			targetAnchor: link.id
		});

		navX -= navGap;
	}

	// Draw separator line below header
	page.drawLine({
		start: { x: margins.left, y: y - 12 },
		end: { x: pageWidth - margins.right, y: y - 12 },
		thickness: 0.5,
		color: rgb(0.8, 0.8, 0.8)
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
		color: rgb(0, 0, 0)
	});

	page.drawText(subtitle, {
		x: (pageWidth - subtitleWidth) / 2,
		y: pageHeight / 2 - 20,
		size: subtitleSize,
		font: boldFont,
		color: rgb(0.3, 0.3, 0.3)
	});
}

function addIndexPages(ctx: GeneratorContext) {
	const page = addPage(ctx, 'index');
	drawHeader(page, ctx, 'Index', []);

	const { font, boldFont, margins, pageHeight, config } = ctx;
	let y = pageHeight - margins.top - 50;
	const lineHeight = 20;

	// Index A - Main sections
	page.drawText('Quick Navigation', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont
	});
	y -= lineHeight * 1.5;

	const sections = [
		{ label: 'Guide & Legend', anchor: 'guide', enabled: config.enableGuide },
		{ label: 'Intention', anchor: 'intention', enabled: config.enableIntention },
		{ label: 'Goals', anchor: 'goals', enabled: config.enableGoals },
		{ label: 'Future Log', anchor: 'future-log', enabled: config.enableFutureLog },
		{ label: 'Habit Tracker', anchor: 'habits', enabled: config.enableHabitTracker },
		{ label: 'Collections', anchor: 'collections', enabled: config.enableCollections }
	];

	for (const section of sections) {
		if (section.enabled) {
			const linkText = `> ${section.label}`;
			const textWidth = font.widthOfTextAtSize(linkText, 12);

			page.drawText(linkText, {
				x: margins.left + 10,
				y,
				size: 12,
				font
			});

			// Add pending link to section
			ctx.pendingLinks.push({
				page,
				x: margins.left + 10,
				y: y - 4,
				width: textWidth,
				height: lineHeight,
				targetAnchor: section.anchor
			});

			y -= lineHeight;
		}
	}

	y -= lineHeight;

	// Monthly links
	page.drawText('Monthly', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont
	});
	y -= lineHeight * 1.5;

	for (let month = 0; month < 12; month++) {
		const monthName = dayjs().month(month).format('MMMM');
		const linkText = `> ${monthName}`;
		const textWidth = font.widthOfTextAtSize(linkText, 12);
		const xPos = margins.left + 10 + (month % 3) * 120;
		const yPos = y - Math.floor(month / 3) * lineHeight;

		page.drawText(linkText, {
			x: xPos,
			y: yPos,
			size: 12,
			font
		});

		// Add pending link to month page
		ctx.pendingLinks.push({
			page,
			x: xPos,
			y: yPos - 4,
			width: textWidth,
			height: lineHeight,
			targetAnchor: `month-${month}-timeline`
		});
	}
	y -= Math.ceil(12 / 3) * lineHeight + lineHeight;

	// Weekly links (abbreviated)
	page.drawText('Weekly', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont
	});
	y -= lineHeight * 1.5;

	const weeksInYear = getWeeksInYear(config.year, config.weekStart);
	const cols = 10;
	for (let week = 1; week <= weeksInYear; week++) {
		const col = (week - 1) % cols;
		const row = Math.floor((week - 1) / cols);
		const weekText = `${week}`;
		const textWidth = font.widthOfTextAtSize(weekText, 10);
		const xPos = margins.left + 10 + col * 40;
		const yPos = y - row * lineHeight;

		page.drawText(weekText, {
			x: xPos,
			y: yPos,
			size: 10,
			font
		});

		// Add pending link to week page
		ctx.pendingLinks.push({
			page,
			x: xPos,
			y: yPos - 4,
			width: Math.max(textWidth, 20), // Min touch target width
			height: lineHeight,
			targetAnchor: `week-${week}-action`
		});
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
		font: boldFont
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
			font: boldFont
		});
		page.drawText(meaning, {
			x: margins.left + 50,
			y,
			size: 12,
			font
		});
		y -= lineHeight;
	}

	y -= lineHeight;

	// Flow diagram (simplified text version)
	page.drawText('Planning Flow', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont
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
			font
		});
		y -= lineHeight * 0.9;
	}

	y -= lineHeight;

	// T.A.M.E. Reflection
	page.drawText('Reflection (T.A.M.E.)', {
		x: margins.left,
		y,
		size: 14,
		font: boldFont
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
			font
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
			color: rgb(0.4, 0.4, 0.4)
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
			color: rgb(0.4, 0.4, 0.4)
		}
	);
}

function addFutureLogPages(ctx: GeneratorContext) {
	// Page 1: Jan-Jun
	const page1 = addPage(ctx, 'future-log');
	drawHeader(page1, ctx, 'Future Log', [{ label: 'Index', anchor: 'index' }]);

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
			font: boldFont
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
			color: rgb(0, 0, 0)
		});
	}

	// Page 2: Jul-Dec
	const page2 = addPage(ctx, 'future-log-2');
	drawHeader(page2, ctx, 'Future Log', [{ label: 'Index', anchor: 'index' }]);
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
			font: boldFont
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
			color: rgb(0, 0, 0)
		});
	}
}

function addMonthlyPages(ctx: GeneratorContext, month: number) {
	const { config } = ctx;
	const monthDate = dayjs(`${config.year}-${month + 1}-01`);
	const monthName = monthDate.format('MMMM');

	// Timeline page
	const timelinePage = addPage(ctx, `month-${month}-timeline`);
	drawHeader(timelinePage, ctx, monthName, [{ label: 'Index', anchor: 'index' }]);

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

		timelinePage.drawText(dayText, {
			x: margins.left,
			y,
			size: 10,
			font,
			color: isWeekend ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0)
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
			color: isWeekend ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0)
		});

		timelinePage.drawLine({
			start: { x: margins.left + 40, y: y - 2 },
			end: { x: ctx.pageWidth - margins.right, y: y - 2 },
			thickness: 0.25,
			color: rgb(0.8, 0.8, 0.8)
		});

		y -= lineHeight;
	}

	// Action plan page
	const actionPage = addPage(ctx, `month-${month}-action`);
	drawHeader(actionPage, ctx, `${monthName} - Action Plan`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${month}-timeline` }
	]);
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

	drawHeader(page, ctx, `${monthName} Habits`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${month}-timeline` }
	]);

	const { font, boldFont, margins, pageWidth, pageHeight } = ctx;
	let y = pageHeight - margins.top - 60;

	const habitColWidth = 120;
	const dayWidth = (pageWidth - margins.left - margins.right - habitColWidth) / daysInMonth;
	const rowHeight = 20;

	// Header row with days
	page.drawText('Habit', {
		x: margins.left,
		y,
		size: 10,
		font: boldFont
	});

	for (let day = 1; day <= daysInMonth; day++) {
		page.drawText(`${day}`, {
			x: margins.left + habitColWidth + (day - 1) * dayWidth,
			y,
			size: 7,
			font
		});
	}
	y -= rowHeight;

	// Habit rows
	for (const habit of config.habits) {
		page.drawText(habit.name || '_______________', {
			x: margins.left,
			y,
			size: 9,
			font
		});

		// Checkboxes for each day
		for (let day = 1; day <= daysInMonth; day++) {
			page.drawRectangle({
				x: margins.left + habitColWidth + (day - 1) * dayWidth,
				y: y - 3,
				width: dayWidth - 2,
				height: rowHeight - 4,
				borderColor: rgb(0.7, 0.7, 0.7),
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
		font
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
			font
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

	drawHeader(page, ctx, `${displayDate} ${dayOfWeek}`, [
		{ label: 'Index', anchor: 'index' },
		{ label: 'Month', anchor: `month-${date.month()}-timeline` },
		{ label: 'Week', anchor: `week-${weekNumber}-action` }
	]);

	drawDotGrid(page, ctx);

	// Add events for this day
	const dayEvents = config.events.filter(e => e.date === dateStr);
	if (dayEvents.length > 0) {
		const { font, margins, pageHeight } = ctx;
		let y = pageHeight - margins.top - 60;

		for (const event of dayEvents.slice(0, 3)) {
			page.drawText(`o ${event.title}`, {
				x: margins.left,
				y,
				size: 10,
				font,
				color: rgb(0.3, 0.3, 0.3)
			});
			y -= 15;
		}
	}
}

function addCollectionIndexPages(ctx: GeneratorContext) {
	const page = addPage(ctx, 'collections');
	drawHeader(page, ctx, 'Collections', [{ label: 'Index', anchor: 'index' }]);

	const { font, boldFont, margins, pageHeight, config } = ctx;
	let y = pageHeight - margins.top - 60;
	const lineHeight = 22;

	// Pre-defined collections
	if (config.collections.length > 0) {
		page.drawText('Collections', {
			x: margins.left,
			y,
			size: 14,
			font: boldFont
		});
		y -= lineHeight * 1.5;

		for (const collection of config.collections) {
			const linkText = `> ${collection.name}`;
			const textWidth = font.widthOfTextAtSize(linkText, 12);

			page.drawText(linkText, {
				x: margins.left + 10,
				y,
				size: 12,
				font
			});

			// Add pending link to collection page
			ctx.pendingLinks.push({
				page,
				x: margins.left + 10,
				y: y - 4,
				width: textWidth,
				height: lineHeight,
				targetAnchor: `collection-${collection.id}`
			});

			y -= lineHeight;
		}
		y -= lineHeight;
	}

	// Write-in slots
	if (config.writeInCollectionSlots > 0) {
		page.drawText('Add Your Collections', {
			x: margins.left,
			y,
			size: 14,
			font: boldFont
		});
		y -= lineHeight * 1.5;

		for (let i = 0; i < Math.min(config.writeInCollectionSlots, 20); i++) {
			page.drawLine({
				start: { x: margins.left + 10, y },
				end: { x: ctx.pageWidth - margins.right, y },
				thickness: 0.5,
				color: rgb(0.8, 0.8, 0.8)
			});
			y -= lineHeight;
		}
	}
}

function addCollectionPages(ctx: GeneratorContext, collection: { id: string; name: string; pages: number; template: string }) {
	for (let i = 0; i < collection.pages; i++) {
		const anchor = i === 0 ? `collection-${collection.id}` : undefined;
		const page = addPage(ctx, anchor);

		drawHeader(page, ctx, collection.name, [
			{ label: 'Index', anchor: 'index' },
			{ label: 'Collections', anchor: 'collections' }
		]);

		if (collection.template !== 'blank') {
			drawDotGrid(page, ctx);
		}
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
