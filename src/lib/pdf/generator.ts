import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import type { RapidInkConfig } from '../config';
import { DEVICES, pxToPoints, getContentWidth } from '../devices';
import { PageRegistry } from './links';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(dayOfYear);

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
		currentPageIndex: 0
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
		report('monthly', 0, 12, 'Generating monthly pages...');
		for (let month = 0; month < 12; month++) {
			report('monthly', month + 1, 12, `Generating ${dayjs().month(month).format('MMMM')}...`);
			addMonthlyPages(ctx, month);
		}
	}

	if (config.enableHabitTracker) {
		addHabitTrackerPage(ctx);
	}

	if (config.enableWeeklyPages) {
		const weeksInYear = getWeeksInYear(config.year, config.weekStart);
		report('weekly', 0, weeksInYear, 'Generating weekly pages...');
		for (let week = 1; week <= weeksInYear; week++) {
			report('weekly', week, weeksInYear, `Generating week ${week}...`);
			addWeeklyPages(ctx, week);
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

	// Phase 2: Add navigation links (second pass)
	report('links', 0, 1, 'Adding navigation links...');
	// Links are added inline during page generation using pageRefs

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

	// Title
	page.drawText(title, {
		x: margins.left,
		y,
		size: 18,
		font: boldFont,
		color: rgb(0, 0, 0)
	});

	// Navigation links (right side)
	let navX = pageWidth - margins.right;
	const enabledLinks = config.navigationLinks.filter(l => l.enabled);

	for (let i = enabledLinks.length - 1; i >= 0; i--) {
		const link = enabledLinks[i];
		const linkWidth = font.widthOfTextAtSize(`< ${link.label}`, 10);
		navX -= linkWidth + 15;

		page.drawText(`< ${link.label}`, {
			x: navX,
			y,
			size: 10,
			font,
			color: rgb(0.3, 0.3, 0.3)
		});
		// Note: pdf-lib doesn't support internal links directly in the same way
		// We'd need to use annotations - simplified for now
	}
}

function addCoverPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'cover');
	const { boldFont, pageWidth, pageHeight, config } = ctx;

	// Center title
	const title = 'RapidInk';
	const subtitle = `${config.year} Planner`;

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
			page.drawText(`> ${section.label}`, {
				x: margins.left + 10,
				y,
				size: 12,
				font
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
		page.drawText(`> ${monthName}`, {
			x: margins.left + 10 + (month % 3) * 120,
			y: y - Math.floor(month / 3) * lineHeight,
			size: 12,
			font
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
		page.drawText(`${week}`, {
			x: margins.left + 10 + col * 40,
			y: y - row * lineHeight,
			size: 10,
			font
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
		page1.drawText(monthName, {
			x,
			y: yPos,
			size: 12,
			font: boldFont
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
		page2.drawText(monthName, {
			x,
			y: yPos,
			size: 12,
			font: boldFont
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

		timelinePage.drawText(`${day}`, {
			x: margins.left,
			y,
			size: 10,
			font,
			color: isWeekend ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0)
		});

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

function addHabitTrackerPage(ctx: GeneratorContext) {
	const page = addPage(ctx, 'habits');
	drawHeader(page, ctx, 'Habit Tracker', [{ label: 'Index', anchor: 'index' }]);

	const { font, boldFont, margins, pageWidth, pageHeight, config } = ctx;
	let y = pageHeight - margins.top - 60;

	const habitColWidth = 120;
	const dayWidth = (pageWidth - margins.left - margins.right - habitColWidth) / 31;
	const rowHeight = 20;

	// Header row with days
	page.drawText('Habit', {
		x: margins.left,
		y,
		size: 10,
		font: boldFont
	});

	for (let day = 1; day <= 31; day++) {
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
		for (let day = 1; day <= 31; day++) {
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
			page.drawText(`> ${collection.name}`, {
				x: margins.left + 10,
				y,
				size: 12,
				font
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
