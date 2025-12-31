import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { drawNavigationHeader, type NavigationHeaderOptions } from './header';
import { PageRegistry } from './links';
import type { NavigationLink } from '../config';

describe('Navigation Header', () => {
	let doc: PDFDocument;
	let registry: PageRegistry;

	beforeEach(async () => {
		doc = await PDFDocument.create();
		registry = new PageRegistry();

		// Register some pages for navigation
		const indexPage = doc.addPage();
		const monthlyPage = doc.addPage();
		const weeklyPage = doc.addPage();

		registry.registerPage('index', indexPage, 0);
		registry.registerPage('monthly', monthlyPage, 1);
		registry.registerPage('weekly', weeklyPage, 2);
	});

	describe('drawNavigationHeader', () => {
		it('should draw navigation links on a page', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true },
				{ id: 'monthly', label: 'Month', enabled: true },
				{ id: 'weekly', label: 'Week', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550
			});

			expect(result).toBeDefined();
			expect(result.linksCreated).toBe(3);
		});

		it('should skip disabled links', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true },
				{ id: 'monthly', label: 'Month', enabled: false },
				{ id: 'weekly', label: 'Week', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550
			});

			expect(result.linksCreated).toBe(2);
		});

		it('should skip links with unregistered targets', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true },
				{ id: 'nonexistent', label: 'Missing', enabled: true },
				{ id: 'weekly', label: 'Week', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550
			});

			expect(result.linksCreated).toBe(2);
			expect(result.skippedLinks).toContain('nonexistent');
		});

		it('should respect left margin for left-handed layout', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550,
				leftMargin: 50,
				handedness: 'left'
			});

			expect(result).toBeDefined();
			// Left-handed layout should have toolbar on right, content starts at leftMargin
			expect(result.startX).toBe(50);
		});

		it('should respect toolbar offset for right-handed layout', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550,
				leftMargin: 20,
				toolbarWidth: 42,
				handedness: 'right'
			});

			expect(result).toBeDefined();
			// Right-handed layout has toolbar on left, content starts after toolbar
			expect(result.startX).toBe(42 + 20);
		});

		it('should ensure minimum touch target size of 44pt', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'X', enabled: true } // Very short label
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550,
				minTouchTarget: 44
			});

			expect(result).toBeDefined();
			// Each link should have at least 44pt width for touch targets
			expect(result.linkWidths[0]).toBeGreaterThanOrEqual(44);
		});

		it('should draw separator line below header', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 10,
				contentWidth: 550,
				drawSeparator: true
			});

			expect(result.separatorDrawn).toBe(true);
		});

		it('should return correct header height', async () => {
			const page = doc.addPage([612, 792]);

			const links: NavigationLink[] = [
				{ id: 'index', label: 'Index', enabled: true }
			];

			const result = await drawNavigationHeader(doc, page, {
				links,
				registry,
				y: 750,
				fontSize: 12,
				contentWidth: 550,
				padding: 8
			});

			// Header height should be fontSize + padding
			expect(result.headerHeight).toBeGreaterThanOrEqual(20);
		});
	});
});
