import { PDFDocument, PDFPage, PDFName, PDFArray, PDFRef, PDFDict, PDFStream, PDFString } from 'pdf-lib';
import type { RapidInkConfig } from '../config';
import { generatePDF, type GeneratorProgress } from './generator';
import { COUNTRIES, STATES } from '../holidays';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

export interface UpgradeResult {
	success: boolean;
	pdfBytes?: Uint8Array;
	error?: string;
	warnings?: string[];
	stats?: {
		totalPages: number;
		pagesWithHandwriting: number;
		handwritingPreserved: number;
	};
}

export interface ConfigDiff {
	safe: boolean;
	unsafeChanges: string[];
	safeChanges: string[];
}

/**
 * Compare two configs to determine if upgrade is safe (layout unchanged)
 */
export function compareConfigs(original: RapidInkConfig, updated: RapidInkConfig): ConfigDiff {
	const unsafeChanges: string[] = [];
	const safeChanges: string[] = [];

	// Helper to format values for display
	const fmt = (v: unknown) => typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);

	// === UNSAFE CHANGES - affect page layout/count ===

	// Device & dimensions
	if (original.device !== updated.device) {
		unsafeChanges.push(`Device: ${original.device} → ${updated.device}`);
	}
	if (original.orientation !== updated.orientation) {
		unsafeChanges.push(`Orientation: ${original.orientation} → ${updated.orientation}`);
	}
	if (original.toolbarPosition !== updated.toolbarPosition) {
		unsafeChanges.push(`Toolbar: ${original.toolbarPosition} → ${updated.toolbarPosition}`);
	}

	// Calendar structure
	if (original.year !== updated.year) {
		unsafeChanges.push(`Year: ${original.year} → ${updated.year}`);
	}
	if (original.startMonth !== updated.startMonth) {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		unsafeChanges.push(`Start month: ${months[original.startMonth]} → ${months[updated.startMonth]}`);
	}

	// Page toggles (affect page count)
	if (original.enableCover !== updated.enableCover) {
		unsafeChanges.push(`Cover page: ${fmt(updated.enableCover)}`);
	}
	if (original.enableIndex !== updated.enableIndex) {
		unsafeChanges.push(`Index pages: ${fmt(updated.enableIndex)}`);
	}
	if (original.enableGuide !== updated.enableGuide) {
		unsafeChanges.push(`Guide page: ${fmt(updated.enableGuide)}`);
	}
	if (original.enableIntention !== updated.enableIntention) {
		unsafeChanges.push(`Intention page: ${fmt(updated.enableIntention)}`);
	}
	if (original.enableGoals !== updated.enableGoals) {
		unsafeChanges.push(`Goals page: ${fmt(updated.enableGoals)}`);
	}
	if (original.enableFutureLog !== updated.enableFutureLog) {
		unsafeChanges.push(`Future log: ${fmt(updated.enableFutureLog)}`);
	}
	if (original.enableMonthlyPages !== updated.enableMonthlyPages) {
		unsafeChanges.push(`Monthly pages: ${fmt(updated.enableMonthlyPages)}`);
	}
	if (original.enableWeeklyPages !== updated.enableWeeklyPages) {
		unsafeChanges.push(`Weekly pages: ${fmt(updated.enableWeeklyPages)}`);
	}
	if (original.enableDailyPages !== updated.enableDailyPages) {
		unsafeChanges.push(`Daily pages: ${fmt(updated.enableDailyPages)}`);
	}
	if (original.enableHabitTracker !== updated.enableHabitTracker) {
		unsafeChanges.push(`Habit tracker: ${fmt(updated.enableHabitTracker)}`);
	}
	if (original.enableCollections !== updated.enableCollections) {
		unsafeChanges.push(`Collections: ${fmt(updated.enableCollections)}`);
	}
	if (original.enableNotesPages !== updated.enableNotesPages) {
		unsafeChanges.push(`Notes pages: ${fmt(updated.enableNotesPages)}`);
	}

	// Reflection pages (add pages)
	if (original.weeklyReflectionEnabled !== updated.weeklyReflectionEnabled) {
		unsafeChanges.push(`Weekly reflection: ${fmt(updated.weeklyReflectionEnabled)}`);
	}
	if (original.monthlyReflectionEnabled !== updated.monthlyReflectionEnabled) {
		unsafeChanges.push(`Monthly reflection: ${fmt(updated.monthlyReflectionEnabled)}`);
	}

	// Page counts
	if (original.notesPageCount !== updated.notesPageCount) {
		unsafeChanges.push(`Notes pages: ${original.notesPageCount} → ${updated.notesPageCount}`);
	}
	if (original.writeInCollectionSlots !== updated.writeInCollectionSlots) {
		unsafeChanges.push(`Write-in slots: ${original.writeInCollectionSlots} → ${updated.writeInCollectionSlots}`);
	}
	if (original.writeInCollectionPages !== updated.writeInCollectionPages) {
		unsafeChanges.push(`Write-in pages: ${original.writeInCollectionPages} → ${updated.writeInCollectionPages}`);
	}

	// Holidays (can add text that overlaps with handwriting)
	// Helper to get display name for country/state
	const getCountryName = (code?: string) => code ? (COUNTRIES[code] || code) : 'none';
	const getStateName = (country?: string, state?: string) => {
		if (!country) return 'none';
		const states = STATES[country];
		if (!states) return state || 'National';
		// Empty string means federal/national only
		return states[state ?? ''] || state || 'National';
	};

	if (original.holidays?.enabled !== updated.holidays?.enabled) {
		unsafeChanges.push(`Holidays: ${fmt(updated.holidays?.enabled)}`);
	}
	if (original.holidays?.country !== updated.holidays?.country) {
		unsafeChanges.push(`Holiday country: ${getCountryName(original.holidays?.country)} → ${getCountryName(updated.holidays?.country)}`);
	}
	if (original.holidays?.state !== updated.holidays?.state) {
		const origState = getStateName(original.holidays?.country, original.holidays?.state);
		const newState = getStateName(updated.holidays?.country, updated.holidays?.state);
		unsafeChanges.push(`Holiday region: ${origState} → ${newState}`);
	}

	// Collection changes
	if (original.collections?.length !== updated.collections?.length) {
		unsafeChanges.push(`Collection count: ${original.collections?.length || 0} → ${updated.collections?.length || 0}`);
	}
	if (original.collections && updated.collections) {
		for (let i = 0; i < Math.min(original.collections.length, updated.collections.length); i++) {
			if (original.collections[i].pages !== updated.collections[i].pages) {
				unsafeChanges.push(`"${original.collections[i].name}" pages: ${original.collections[i].pages} → ${updated.collections[i].pages}`);
			}
		}
	}

	// Habit changes (safe - just text labels on habit tracker)
	const originalHabitNames = (original.habits || []).map(h => h.name).filter(n => n);
	const updatedHabitNames = (updated.habits || []).map(h => h.name).filter(n => n);
	const habitsChanged = JSON.stringify(originalHabitNames) !== JSON.stringify(updatedHabitNames);
	if (habitsChanged) {
		const added = updatedHabitNames.filter(n => !originalHabitNames.includes(n));
		const removed = originalHabitNames.filter(n => !updatedHabitNames.includes(n));
		if (added.length > 0 && removed.length > 0) {
			safeChanges.push(`Habits changed: -${removed.length}, +${added.length}`);
		} else if (added.length > 0) {
			safeChanges.push(`Habits added: ${added.slice(0, 3).join(', ')}${added.length > 3 ? '...' : ''}`);
		} else if (removed.length > 0) {
			safeChanges.push(`Habits removed: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '...' : ''}`);
		}
	}

	// Custom codes changes (safe - just text on pages)
	const originalCodes = (original.customCodes || []).map(c => c.code).filter(c => c);
	const updatedCodes = (updated.customCodes || []).map(c => c.code).filter(c => c);
	const codesChanged = JSON.stringify(originalCodes) !== JSON.stringify(updatedCodes);
	if (codesChanged) {
		const added = updatedCodes.filter(c => !originalCodes.includes(c));
		const removed = originalCodes.filter(c => !updatedCodes.includes(c));
		if (added.length > 0 && removed.length > 0) {
			safeChanges.push(`Custom codes changed: -${removed.length}, +${added.length}`);
		} else if (added.length > 0) {
			safeChanges.push(`Custom codes added: ${added.join(', ')}`);
		} else if (removed.length > 0) {
			safeChanges.push(`Custom codes removed: ${removed.join(', ')}`);
		}
	}

	// === SAFE CHANGES - visual only, don't affect page structure ===

	// Date/locale formatting
	if (original.dateFormat !== updated.dateFormat) {
		safeChanges.push(`Date format: ${original.dateFormat} → ${updated.dateFormat}`);
	}
	if (original.locale !== updated.locale) {
		safeChanges.push(`Locale: ${original.locale} → ${updated.locale}`);
	}
	if (original.weekStart !== updated.weekStart) {
		safeChanges.push(`Week start: ${original.weekStart} → ${updated.weekStart}`);
	}

	// Cover customization
	if (original.coverTitle !== updated.coverTitle) {
		safeChanges.push(`Cover title changed`);
	}
	if (original.coverSubtitle !== updated.coverSubtitle) {
		safeChanges.push(`Cover subtitle changed`);
	}

	// Dot/grid settings
	if (original.dotStyle !== updated.dotStyle) {
		safeChanges.push(`Page background: ${original.dotStyle} → ${updated.dotStyle}`);
	}
	if (original.dotOpacity !== updated.dotOpacity) {
		safeChanges.push(`Dot opacity: ${Math.round((original.dotOpacity || 0) * 100)}% → ${Math.round((updated.dotOpacity || 0) * 100)}%`);
	}
	if (original.dotSize !== updated.dotSize) {
		safeChanges.push(`Dot size: ${original.dotSize} → ${updated.dotSize}`);
	}
	if (original.dotSpacing !== updated.dotSpacing) {
		safeChanges.push(`Dot spacing: ${original.dotSpacing} → ${updated.dotSpacing}`);
	}

	// Colors
	if (original.textColor !== updated.textColor) {
		safeChanges.push(`Text color: ${original.textColor} → ${updated.textColor}`);
	}
	if (original.lineColor !== updated.lineColor) {
		safeChanges.push(`Line color: ${original.lineColor} → ${updated.lineColor}`);
	}
	if (original.lineOpacity !== updated.lineOpacity) {
		safeChanges.push(`Line opacity: ${Math.round((original.lineOpacity || 0) * 100)}% → ${Math.round((updated.lineOpacity || 0) * 100)}%`);
	}

	// Typography
	if (original.fontFamily !== updated.fontFamily) {
		safeChanges.push(`Font: ${original.fontFamily} → ${updated.fontFamily}`);
	}
	if (original.fontSize !== updated.fontSize) {
		safeChanges.push(`Font size: ${original.fontSize} → ${updated.fontSize}`);
	}

	// Daily page layout (visual, not structural)
	if (original.dailyLayout !== updated.dailyLayout) {
		safeChanges.push(`Daily layout: ${original.dailyLayout} → ${updated.dailyLayout}`);
	}
	if (original.dailyTimeStart !== updated.dailyTimeStart) {
		safeChanges.push(`Daily time start: ${original.dailyTimeStart} → ${updated.dailyTimeStart}`);
	}
	if (original.dailyTimeEnd !== updated.dailyTimeEnd) {
		safeChanges.push(`Daily time end: ${original.dailyTimeEnd} → ${updated.dailyTimeEnd}`);
	}
	if (original.dailyTimeIncrement !== updated.dailyTimeIncrement) {
		safeChanges.push(`Daily time increment: ${original.dailyTimeIncrement} → ${updated.dailyTimeIncrement}`);
	}

	return {
		safe: unsafeChanges.length === 0,
		unsafeChanges,
		safeChanges
	};
}

/**
 * Get the RapidInk anchor from a page's metadata
 */
export function getPageAnchor(page: PDFPage): string | undefined {
	const anchor = page.node.get(PDFName.of('RapidInkAnchor'));
	if (anchor instanceof PDFString) {
		return anchor.decodeText();
	}
	return undefined;
}

/**
 * Helper to get actual month/year accounting for startMonth offset
 */
function getActualMonthYear(relativeMonth: number, year: number, startMonth: number): { month: number; year: number } {
	const actualMonth = (startMonth + relativeMonth) % 12;
	const yearOffset = Math.floor((startMonth + relativeMonth) / 12);
	return { month: actualMonth, year: year + yearOffset };
}

/**
 * Build a map of page index -> anchor from a config.
 * This reconstructs what anchors the generator would have created.
 */
export function buildAnchorMapFromConfig(config: RapidInkConfig): Map<number, string> {
	const anchors = new Map<number, string>();
	let pageIndex = 0;
	const monthCount = config.sampleMonthCount && config.sampleMonthCount > 0 ? config.sampleMonthCount : 12;
	const startMonth = config.startMonth || 0;

	// Cover page
	if (config.enableCover) {
		anchors.set(pageIndex++, 'cover');
	}

	// Index pages - the generator creates ~4-5 months per page
	if (config.enableIndex) {
		anchors.set(pageIndex++, 'index');
		// Calculate additional index pages based on month count
		// Generator creates new page when months don't fit (~4-5 months per page)
		const monthsPerIndexPage = 4;
		const extraIndexPages = Math.floor((monthCount - 1) / monthsPerIndexPage);
		for (let i = 0; i < extraIndexPages; i++) {
			// The anchor is index-{month} where month is the first month on that page
			anchors.set(pageIndex++, `index-${(i + 1) * monthsPerIndexPage}`);
		}
	}

	// Guide page
	if (config.enableGuide) {
		anchors.set(pageIndex++, 'guide');
	}

	// Intention page
	if (config.enableIntention) {
		anchors.set(pageIndex++, 'intention');
	}

	// Goals page
	if (config.enableGoals) {
		anchors.set(pageIndex++, 'goals');
	}

	// Future log pages (2 pages)
	if (config.enableFutureLog) {
		anchors.set(pageIndex++, 'future-log');
		anchors.set(pageIndex++, 'future-log-2');
	}

	// Monthly pages
	if (config.enableMonthlyPages) {
		for (let month = 0; month < monthCount; month++) {
			anchors.set(pageIndex++, `month-${month}-timeline`);
			anchors.set(pageIndex++, `month-${month}-action`);
			if (config.monthlyReflectionEnabled) {
				anchors.set(pageIndex++, `month-${month}-reflection`);
			}
		}
	}

	// Habit tracker pages (one per month)
	if (config.enableHabitTracker) {
		for (let month = 0; month < monthCount; month++) {
			anchors.set(pageIndex++, month === 0 ? 'habits' : `habits-${month}`);
		}
	}

	// Weekly pages
	if (config.enableWeeklyPages) {
		// Calculate weeks in the sample period
		const lastMonthIndex = monthCount - 1;
		const { month: lastActualMonth, year: lastYear } = getActualMonthYear(lastMonthIndex, config.year, startMonth);
		const lastDate = dayjs(`${lastYear}-${lastActualMonth + 1}-01`).endOf('month');
		const lastWeek = config.weekStart === 'monday' ? lastDate.isoWeek() : lastDate.week();

		for (let week = 1; week <= lastWeek; week++) {
			anchors.set(pageIndex++, `week-${week}-action`);
			if (config.weeklyReflectionEnabled) {
				anchors.set(pageIndex++, `week-${week}-reflection`);
			}
		}
	}

	// Daily pages
	if (config.enableDailyPages) {
		for (let month = 0; month < monthCount; month++) {
			const { month: actualMonth, year: actualYear } = getActualMonthYear(month, config.year, startMonth);
			const daysInMonth = dayjs(`${actualYear}-${actualMonth + 1}-01`).daysInMonth();
			for (let day = 1; day <= daysInMonth; day++) {
				const dateStr = dayjs(`${actualYear}-${actualMonth + 1}-${day}`).format('YYYY-MM-DD');
				anchors.set(pageIndex++, `day-${dateStr}`);
			}
		}
	}

	// Collection index
	if (config.enableCollections) {
		anchors.set(pageIndex++, 'collections');
		// Additional collection index pages for many collections
		const totalSlots = (config.collections?.length || 0) + (config.writeInCollectionSlots || 0);
		const slotsPerPage = 20; // Approximate
		const extraPages = Math.floor(totalSlots / slotsPerPage);
		for (let i = 0; i < extraPages; i++) {
			anchors.set(pageIndex++, `collections-${i + 1}`);
		}

		// Collection pages
		for (const collection of config.collections || []) {
			for (let i = 0; i < collection.pages; i++) {
				const anchor = i === 0 ? `collection-${collection.id}` : `collection-${collection.id}-${i + 1}`;
				anchors.set(pageIndex++, anchor);
			}
		}

		// Write-in collection pages
		const writeInSlots = config.writeInCollectionSlots || 0;
		const pagesPerSlot = config.writeInCollectionPages || 2;
		for (let slot = 0; slot < writeInSlots; slot++) {
			for (let page = 0; page < pagesPerSlot; page++) {
				if (page === 0) {
					anchors.set(pageIndex++, `write-in-collection-${slot}`);
				} else {
					pageIndex++; // No anchor for additional pages
				}
			}
		}
	}

	// Notes pages
	if (config.enableNotesPages) {
		const notesCount = config.notesPageCount || 10;
		anchors.set(pageIndex++, 'notes');
		for (let i = 1; i < notesCount; i++) {
			pageIndex++; // No anchor for additional notes pages
		}
	}

	return anchors;
}

/**
 * Build a map of anchor -> page index for a PDF
 */
export function buildAnchorMap(pdf: PDFDocument): Map<string, number> {
	const anchorMap = new Map<string, number>();
	const pageCount = pdf.getPageCount();

	for (let i = 0; i < pageCount; i++) {
		const page = pdf.getPage(i);
		const anchor = getPageAnchor(page);
		if (anchor) {
			anchorMap.set(anchor, i);
		}
	}

	return anchorMap;
}

export interface HandwritingData {
	streams: PDFStream[];
	anchor?: string;
	originalIndex: number;
	/** ExtGState resources referenced by the handwriting (for opacity/blending) */
	extGStates?: Map<string, PDFDict>;
}

/**
 * Extract handwriting content streams from an annotated PDF
 * Returns a map of anchor (or page index fallback) -> handwriting data
 */
export async function extractHandwriting(
	pdf: PDFDocument
): Promise<Map<string, HandwritingData>> {
	const handwritingMap = new Map<string, HandwritingData>();
	const pageCount = pdf.getPageCount();

	for (let i = 0; i < pageCount; i++) {
		const page = pdf.getPage(i);
		const contents = page.node.get(PDFName.of('Contents'));
		const anchor = getPageAnchor(page);

		if (contents instanceof PDFArray && contents.size() > 1) {
			// Page has multiple content streams - extra ones are likely handwriting
			const extraStreams: PDFStream[] = [];

			for (let j = 1; j < contents.size(); j++) {
				const streamRef = contents.get(j);
				const stream = streamRef instanceof PDFRef
					? pdf.context.lookup(streamRef)
					: streamRef;

				if (stream instanceof PDFStream) {
					extraStreams.push(stream);
				}
			}

			if (extraStreams.length > 0) {
				// Extract ExtGState resources (for opacity/blending in highlights)
				const extGStates = new Map<string, PDFDict>();
				const resources = page.node.get(PDFName.of('Resources'));
				if (resources) {
					const resourcesDict = resources instanceof PDFRef
						? pdf.context.lookup(resources)
						: resources;
					if (resourcesDict instanceof PDFDict) {
						const extGStateDict = resourcesDict.get(PDFName.of('ExtGState'));
						if (extGStateDict) {
							const gsDict = extGStateDict instanceof PDFRef
								? pdf.context.lookup(extGStateDict)
								: extGStateDict;
							if (gsDict instanceof PDFDict) {
								// Copy all ExtGState entries that start with GS- (reMarkable's naming)
								for (const [key, value] of gsDict.entries()) {
									const keyStr = key.toString();
									if (keyStr.startsWith('/GS-') || keyStr.startsWith('/FXE')) {
										const gsValue = value instanceof PDFRef
											? pdf.context.lookup(value)
											: value;
										if (gsValue instanceof PDFDict) {
											extGStates.set(keyStr.slice(1), gsValue); // Remove leading /
										}
									}
								}
							}
						}
					}
				}

				// Use anchor as key if available, otherwise fall back to index
				const key = anchor || `__index_${i}`;
				handwritingMap.set(key, {
					streams: extraStreams,
					anchor,
					originalIndex: i,
					extGStates: extGStates.size > 0 ? extGStates : undefined
				});
			}
		}
	}

	return handwritingMap;
}

export interface AttachResult {
	attached: number;
	matched: number;
	unmatched: string[];
}

export interface AttachOptions {
	/** Original PDF page count - index fallback only used when counts match */
	originalPageCount?: number;
}

/**
 * Attach handwriting streams to a regenerated PDF using anchor-based matching
 */
export async function attachHandwriting(
	pdf: PDFDocument,
	handwritingMap: Map<string, HandwritingData>,
	options: AttachOptions = {}
): Promise<AttachResult> {
	let attached = 0;
	let matched = 0;
	const unmatched: string[] = [];
	const pageCount = pdf.getPageCount();

	// Build anchor map for the new PDF
	const newAnchorMap = buildAnchorMap(pdf);

	// Check if page counts match (same structure = safe to use index fallback)
	const samePageCount = options.originalPageCount !== undefined &&
		options.originalPageCount === pageCount;

	for (const [, data] of handwritingMap) {
		let targetPageIndex: number | undefined;

		if (data.anchor && newAnchorMap.has(data.anchor)) {
			// Match by anchor (preferred)
			targetPageIndex = newAnchorMap.get(data.anchor);
			matched++;
		} else if (samePageCount && data.originalIndex < pageCount) {
			// Index fallback when page counts match (full year -> full year)
			targetPageIndex = data.originalIndex;
		}
		// If page counts differ (sample mode), only anchor matching works
		// This prevents placing Feb handwriting on Jan pages

		if (targetPageIndex === undefined) {
			unmatched.push(data.anchor || `page ${data.originalIndex}`);
			continue;
		}

		const page = pdf.getPage(targetPageIndex);
		const contents = page.node.get(PDFName.of('Contents'));

		// Get or create contents array
		let contentsArray: PDFArray;
		if (contents instanceof PDFArray) {
			contentsArray = contents;
		} else if (contents instanceof PDFRef) {
			// Convert single ref to array
			contentsArray = pdf.context.obj([contents]);
			page.node.set(PDFName.of('Contents'), contentsArray);
		} else {
			console.warn(`Unexpected contents type on page ${targetPageIndex}`);
			continue;
		}

		// Add ExtGState resources if present (for highlighting opacity/blending)
		if (data.extGStates && data.extGStates.size > 0) {
			let resources = page.node.get(PDFName.of('Resources'));
			let resourcesDict: PDFDict;

			if (resources instanceof PDFRef) {
				resourcesDict = pdf.context.lookup(resources) as PDFDict;
			} else if (resources instanceof PDFDict) {
				resourcesDict = resources;
			} else {
				// Create new resources dict
				resourcesDict = pdf.context.obj({});
				page.node.set(PDFName.of('Resources'), resourcesDict);
			}

			// Get or create ExtGState dict
			let extGStateDict = resourcesDict.get(PDFName.of('ExtGState'));
			let gsDict: PDFDict;

			if (extGStateDict instanceof PDFRef) {
				gsDict = pdf.context.lookup(extGStateDict) as PDFDict;
			} else if (extGStateDict instanceof PDFDict) {
				gsDict = extGStateDict;
			} else {
				// Create new ExtGState dict
				gsDict = pdf.context.obj({});
				resourcesDict.set(PDFName.of('ExtGState'), gsDict);
			}

			// Add each ExtGState entry
			for (const [name, gsValue] of data.extGStates) {
				// Register the graphics state dict and add to ExtGState
				const gsRef = pdf.context.register(gsValue);
				gsDict.set(PDFName.of(name), gsRef);
			}
		}

		// Add handwriting streams
		for (const stream of data.streams) {
			// Register the stream in the new PDF context
			const streamRef = pdf.context.register(stream);
			contentsArray.push(streamRef);
			attached++;
		}
	}

	return { attached, matched, unmatched };
}

/**
 * Upgrade a template PDF with new settings while preserving handwriting
 */
export async function upgradeTemplate(
	annotatedPdfBytes: Uint8Array,
	newConfig: RapidInkConfig,
	onProgress?: (progress: GeneratorProgress) => void,
	basePath?: string
): Promise<UpgradeResult> {
	const warnings: string[] = [];

	try {
		// Load the annotated PDF
		const annotatedPdf = await PDFDocument.load(annotatedPdfBytes, {
			ignoreEncryption: true
		});

		const totalPages = annotatedPdf.getPageCount();
		onProgress?.({ phase: 'extract', current: 0, total: 100, message: 'Extracting handwriting...' });

		// Extract handwriting from all pages
		const handwritingMap = await extractHandwriting(annotatedPdf);
		const pagesWithHandwriting = handwritingMap.size;

		onProgress?.({ phase: 'extract', current: 10, total: 100, message: `Found handwriting on ${pagesWithHandwriting} pages` });

		// Generate new PDF with updated config
		onProgress?.({ phase: 'generate', current: 15, total: 100, message: 'Regenerating template...' });

		const newPdfBytes = await generatePDF(newConfig, (p) => {
			// Scale progress from 15-85
			const scaled = 15 + (p.current / p.total) * 70;
			onProgress?.({ phase: 'generate', current: scaled, total: 100, message: p.message });
		}, basePath);

		// Load the new PDF
		const newPdf = await PDFDocument.load(newPdfBytes);
		const newPageCount = newPdf.getPageCount();

		if (newPageCount !== totalPages) {
			warnings.push(`Page count changed: ${totalPages} → ${newPageCount}. Some handwriting may be lost.`);
		}

		onProgress?.({ phase: 'attach', current: 90, total: 100, message: 'Reattaching handwriting...' });

		// Attach handwriting to new PDF
		const attachResult = await attachHandwriting(newPdf, handwritingMap);

		if (attachResult.unmatched.length > 0) {
			warnings.push(`Could not match ${attachResult.unmatched.length} page(s): ${attachResult.unmatched.slice(0, 5).join(', ')}${attachResult.unmatched.length > 5 ? '...' : ''}`);
		}

		onProgress?.({ phase: 'save', current: 95, total: 100, message: 'Saving PDF...' });

		// Save the final PDF
		const finalPdfBytes = await newPdf.save();

		onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Complete!' });

		return {
			success: true,
			pdfBytes: finalPdfBytes,
			warnings: warnings.length > 0 ? warnings : undefined,
			stats: {
				totalPages: newPageCount,
				pagesWithHandwriting,
				handwritingPreserved: attachResult.attached
			}
		};

	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during upgrade'
		};
	}
}
