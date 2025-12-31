import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { createInternalLink, PageRegistry } from './links';
import type { NavigationLink } from '../config';

/**
 * Options for drawing a navigation header.
 */
export interface NavigationHeaderOptions {
	/** Array of navigation links to display */
	links: NavigationLink[];
	/** Page registry for resolving link targets */
	registry: PageRegistry;
	/** Y position for the header (from bottom of page) */
	y: number;
	/** Font size for link text */
	fontSize: number;
	/** Available content width */
	contentWidth: number;
	/** Left margin (default: 20) */
	leftMargin?: number;
	/** Toolbar width for right-handed devices (default: 0) */
	toolbarWidth?: number;
	/** Handedness - determines toolbar position (default: 'right') */
	handedness?: 'left' | 'right';
	/** Minimum touch target size in points (default: 44) */
	minTouchTarget?: number;
	/** Whether to draw a separator line below the header (default: false) */
	drawSeparator?: boolean;
	/** Padding around links (default: 8) */
	padding?: number;
	/** Link text color (default: black) */
	textColor?: { r: number; g: number; b: number };
	/** Separator line color (default: light gray) */
	separatorColor?: { r: number; g: number; b: number };
}

/**
 * Result of drawing a navigation header.
 */
export interface NavigationHeaderResult {
	/** Number of links successfully created */
	linksCreated: number;
	/** IDs of links that were skipped (disabled or unregistered target) */
	skippedLinks: string[];
	/** Starting X position of the header */
	startX: number;
	/** Width of each link (for debugging/testing) */
	linkWidths: number[];
	/** Whether the separator line was drawn */
	separatorDrawn: boolean;
	/** Total header height including padding */
	headerHeight: number;
}

/**
 * Draw a navigation header with clickable links on a PDF page.
 * Links are rendered as text with invisible clickable rectangles.
 *
 * @param doc - The PDF document
 * @param page - The page to draw on
 * @param options - Header configuration options
 * @returns Result containing creation statistics
 */
export async function drawNavigationHeader(
	doc: PDFDocument,
	page: PDFPage,
	options: NavigationHeaderOptions
): Promise<NavigationHeaderResult> {
	const {
		links,
		registry,
		y,
		fontSize,
		contentWidth,
		leftMargin = 20,
		toolbarWidth = 0,
		handedness = 'right',
		minTouchTarget = 44,
		drawSeparator = false,
		padding = 8,
		textColor = { r: 0, g: 0, b: 0 },
		separatorColor = { r: 0.8, g: 0.8, b: 0.8 }
	} = options;

	const font = await doc.embedFont(StandardFonts.Helvetica);
	const result: NavigationHeaderResult = {
		linksCreated: 0,
		skippedLinks: [],
		startX: 0,
		linkWidths: [],
		separatorDrawn: false,
		headerHeight: fontSize + padding * 2
	};

	// Calculate starting X position based on handedness
	// Right-handed: toolbar on left, content starts after toolbar
	// Left-handed: toolbar on right, content starts at left margin
	result.startX = handedness === 'right' ? toolbarWidth + leftMargin : leftMargin;

	// Filter to only enabled links with registered targets
	const enabledLinks = links.filter((link) => {
		if (!link.enabled) {
			result.skippedLinks.push(link.id);
			return false;
		}
		if (registry.getPageIndex(link.id) === undefined) {
			result.skippedLinks.push(link.id);
			return false;
		}
		return true;
	});

	if (enabledLinks.length === 0) {
		return result;
	}

	// Calculate link widths
	const linkGap = 16; // Gap between links
	let currentX = result.startX;

	for (const link of enabledLinks) {
		const textWidth = font.widthOfTextAtSize(link.label, fontSize);
		// Ensure minimum touch target width
		const linkWidth = Math.max(textWidth + padding * 2, minTouchTarget);
		result.linkWidths.push(linkWidth);

		// Draw the link text
		page.drawText(link.label, {
			x: currentX + (linkWidth - textWidth) / 2, // Center text in link area
			y: y - fontSize,
			size: fontSize,
			font,
			color: rgb(textColor.r, textColor.g, textColor.b)
		});

		// Create clickable link annotation
		try {
			await createInternalLink(doc, page, {
				x: currentX,
				y: y - fontSize - padding,
				width: linkWidth,
				height: Math.max(fontSize + padding * 2, minTouchTarget),
				targetAnchor: link.id,
				registry
			});
			result.linksCreated++;
		} catch {
			result.skippedLinks.push(link.id);
		}

		currentX += linkWidth + linkGap;
	}

	// Draw separator line if requested
	if (drawSeparator) {
		const separatorY = y - fontSize - padding * 2 - 2;
		page.drawLine({
			start: { x: result.startX, y: separatorY },
			end: { x: result.startX + contentWidth, y: separatorY },
			thickness: 0.5,
			color: rgb(separatorColor.r, separatorColor.g, separatorColor.b)
		});
		result.separatorDrawn = true;
		result.headerHeight += 4; // Add separator height
	}

	return result;
}

/**
 * Calculate the total width needed for navigation links.
 * Useful for layout calculations before drawing.
 *
 * @param links - Array of navigation links
 * @param fontSize - Font size for link text
 * @param padding - Padding around each link
 * @param minTouchTarget - Minimum touch target size
 * @returns Total width in points
 */
export async function calculateHeaderWidth(
	doc: PDFDocument,
	links: NavigationLink[],
	fontSize: number,
	padding: number = 8,
	minTouchTarget: number = 44
): Promise<number> {
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const linkGap = 16;

	let totalWidth = 0;
	const enabledLinks = links.filter((l) => l.enabled);

	for (let i = 0; i < enabledLinks.length; i++) {
		const textWidth = font.widthOfTextAtSize(enabledLinks[i].label, fontSize);
		const linkWidth = Math.max(textWidth + padding * 2, minTouchTarget);
		totalWidth += linkWidth;
		if (i < enabledLinks.length - 1) {
			totalWidth += linkGap;
		}
	}

	return totalWidth;
}
