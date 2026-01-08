import { PDFDocument, PDFPage, PDFRef, PDFName, PDFArray, PDFDict, PDFNumber, PDFString } from 'pdf-lib';

/**
 * Registry to track page references by anchor name.
 * Used to resolve internal link targets during PDF generation.
 */
export class PageRegistry {
	private pages: Map<string, { page: PDFPage; index: number }> = new Map();

	/**
	 * Register a page with an anchor name for later reference.
	 * Also stores the anchor as page metadata for template upgrades.
	 * @param anchor - Unique identifier for this page (e.g., 'daily-2025-01-15')
	 * @param page - The PDFPage object
	 * @param index - The page index in the document (0-based)
	 */
	registerPage(anchor: string, page: PDFPage, index: number): void {
		this.pages.set(anchor, { page, index });
		// Store anchor as custom page metadata for template upgrades
		page.node.set(PDFName.of('RapidInkAnchor'), PDFString.of(anchor));
	}

	/**
	 * Get the page index for a given anchor.
	 * @param anchor - The anchor name to look up
	 * @returns The page index, or undefined if not found
	 */
	getPageIndex(anchor: string): number | undefined {
		return this.pages.get(anchor)?.index;
	}

	/**
	 * Get the PDFPage for a given anchor.
	 * @param anchor - The anchor name to look up
	 * @returns The PDFPage, or undefined if not found
	 */
	getPage(anchor: string): PDFPage | undefined {
		return this.pages.get(anchor)?.page;
	}

	/**
	 * Get all registered anchor names.
	 * @returns Array of anchor names
	 */
	getAllAnchors(): string[] {
		return Array.from(this.pages.keys());
	}

	/**
	 * Clear all registered pages.
	 */
	clear(): void {
		this.pages.clear();
	}
}

/**
 * Represents a page anchor/named destination in the PDF.
 */
export interface PageAnchor {
	name: string;
	ref: PDFRef;
}

/**
 * Create a named destination (anchor) for a page.
 * This allows other pages to link to this specific page.
 *
 * @param doc - The PDF document
 * @param page - The target page
 * @param name - The anchor name
 * @returns The created PageAnchor
 */
export async function createPageAnchor(
	doc: PDFDocument,
	page: PDFPage,
	name: string
): Promise<PageAnchor> {
	// Create a destination array: [page ref, /Fit]
	// /Fit means the page will be displayed to fit the window
	const destArray = doc.context.obj([page.ref, PDFName.of('Fit')]);
	const destRef = doc.context.register(destArray);

	return {
		name,
		ref: destRef
	};
}

/**
 * Options for creating an internal link.
 */
export interface InternalLinkOptions {
	/** X position of the link rectangle (from left) */
	x: number;
	/** Y position of the link rectangle (from bottom) */
	y: number;
	/** Width of the clickable area */
	width: number;
	/** Height of the clickable area */
	height: number;
	/** The anchor name of the target page */
	targetAnchor: string;
	/** The page registry to resolve the target */
	registry: PageRegistry;
}

/**
 * Represents a created internal link.
 */
export interface InternalLink {
	rect: { x: number; y: number; width: number; height: number };
	targetPageIndex: number;
}

/**
 * Create a clickable internal link annotation on a page.
 * The link will navigate to the page registered with the target anchor.
 *
 * @param doc - The PDF document
 * @param page - The page to add the link to
 * @param options - Link configuration options
 * @returns The created InternalLink
 * @throws Error if the target anchor is not found in the registry
 */
export async function createInternalLink(
	doc: PDFDocument,
	page: PDFPage,
	options: InternalLinkOptions
): Promise<InternalLink> {
	const { x, y, width, height, targetAnchor, registry } = options;

	const targetPageIndex = registry.getPageIndex(targetAnchor);
	if (targetPageIndex === undefined) {
		throw new Error(`Target anchor "${targetAnchor}" not found in registry`);
	}

	const targetPage = registry.getPage(targetAnchor);
	if (!targetPage) {
		throw new Error(`Target page for anchor "${targetAnchor}" not found`);
	}

	// Create the link annotation rectangle [x1, y1, x2, y2]
	const rect = doc.context.obj([
		PDFNumber.of(x),
		PDFNumber.of(y),
		PDFNumber.of(x + width),
		PDFNumber.of(y + height)
	]);

	// Create destination array pointing to the target page
	const dest = doc.context.obj([targetPage.ref, PDFName.of('Fit')]);

	// Create the link annotation dictionary
	const linkDict = doc.context.obj({
		Type: PDFName.of('Annot'),
		Subtype: PDFName.of('Link'),
		Rect: rect,
		Dest: dest,
		Border: doc.context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]), // No visible border
		F: PDFNumber.of(4) // Print flag
	});

	const linkRef = doc.context.register(linkDict);

	// Add the annotation to the page
	const existingAnnots = page.node.get(PDFName.of('Annots'));
	if (existingAnnots instanceof PDFArray) {
		existingAnnots.push(linkRef);
	} else {
		page.node.set(PDFName.of('Annots'), doc.context.obj([linkRef]));
	}

	return {
		rect: { x, y, width, height },
		targetPageIndex
	};
}

/**
 * Create multiple internal links in a batch.
 * More efficient than calling createInternalLink multiple times.
 *
 * @param doc - The PDF document
 * @param page - The page to add links to
 * @param links - Array of link options
 * @param registry - The page registry
 * @returns Array of created InternalLinks
 */
export async function createInternalLinks(
	doc: PDFDocument,
	page: PDFPage,
	links: Omit<InternalLinkOptions, 'registry'>[],
	registry: PageRegistry
): Promise<InternalLink[]> {
	const results: InternalLink[] = [];

	for (const linkOptions of links) {
		const link = await createInternalLink(doc, page, {
			...linkOptions,
			registry
		});
		results.push(link);
	}

	return results;
}
