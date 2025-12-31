import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createInternalLink, createPageAnchor, PageRegistry } from './links';

describe('PDF Link Annotations', () => {
	let doc: PDFDocument;
	let registry: PageRegistry;

	beforeEach(async () => {
		doc = await PDFDocument.create();
		registry = new PageRegistry();
	});

	describe('PageRegistry', () => {
		it('should register a page with an anchor name', () => {
			const page = doc.addPage();
			registry.registerPage('index', page, 0);

			expect(registry.getPageIndex('index')).toBe(0);
		});

		it('should return undefined for unregistered anchors', () => {
			expect(registry.getPageIndex('nonexistent')).toBeUndefined();
		});

		it('should track multiple page registrations', () => {
			const page1 = doc.addPage();
			const page2 = doc.addPage();
			const page3 = doc.addPage();

			registry.registerPage('cover', page1, 0);
			registry.registerPage('index', page2, 1);
			registry.registerPage('daily-2025-01-01', page3, 2);

			expect(registry.getPageIndex('cover')).toBe(0);
			expect(registry.getPageIndex('index')).toBe(1);
			expect(registry.getPageIndex('daily-2025-01-01')).toBe(2);
		});

		it('should get all registered anchors', () => {
			const page1 = doc.addPage();
			const page2 = doc.addPage();

			registry.registerPage('cover', page1, 0);
			registry.registerPage('index', page2, 1);

			const anchors = registry.getAllAnchors();
			expect(anchors).toContain('cover');
			expect(anchors).toContain('index');
			expect(anchors.length).toBe(2);
		});
	});

	describe('createPageAnchor', () => {
		it('should create a named destination for a page', async () => {
			const page = doc.addPage();
			const anchor = await createPageAnchor(doc, page, 'test-anchor');

			expect(anchor).toBeDefined();
			expect(anchor.name).toBe('test-anchor');
		});
	});

	describe('createInternalLink', () => {
		it('should create a clickable link annotation on a page', async () => {
			const sourcePage = doc.addPage([612, 792]); // Letter size
			const targetPage = doc.addPage();

			// Register target page
			registry.registerPage('target', targetPage, 1);

			const link = await createInternalLink(doc, sourcePage, {
				x: 50,
				y: 700,
				width: 100,
				height: 20,
				targetAnchor: 'target',
				registry
			});

			expect(link).toBeDefined();
			// The link should have been added to the page's annotations
			const annotations = sourcePage.node.get(doc.context.obj('Annots'));
			expect(annotations).toBeDefined();
		});

		it('should position link with correct coordinates', async () => {
			const sourcePage = doc.addPage([612, 792]);
			const targetPage = doc.addPage();

			registry.registerPage('target', targetPage, 1);

			const link = await createInternalLink(doc, sourcePage, {
				x: 100,
				y: 500,
				width: 150,
				height: 30,
				targetAnchor: 'target',
				registry
			});

			expect(link.rect.x).toBe(100);
			expect(link.rect.y).toBe(500);
			expect(link.rect.width).toBe(150);
			expect(link.rect.height).toBe(30);
		});

		it('should throw error for unregistered target anchor', async () => {
			const sourcePage = doc.addPage();

			await expect(
				createInternalLink(doc, sourcePage, {
					x: 50,
					y: 700,
					width: 100,
					height: 20,
					targetAnchor: 'nonexistent',
					registry
				})
			).rejects.toThrow('Target anchor "nonexistent" not found in registry');
		});

		it('should support minimum touch target size (44x44pt)', async () => {
			const sourcePage = doc.addPage();
			const targetPage = doc.addPage();

			registry.registerPage('target', targetPage, 1);

			const link = await createInternalLink(doc, sourcePage, {
				x: 50,
				y: 700,
				width: 44,
				height: 44,
				targetAnchor: 'target',
				registry
			});

			expect(link.rect.width).toBeGreaterThanOrEqual(44);
			expect(link.rect.height).toBeGreaterThanOrEqual(44);
		});
	});
});
