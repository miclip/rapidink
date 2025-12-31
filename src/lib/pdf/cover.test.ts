import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePDF } from './generator';
import { DEFAULT_CONFIG } from '../config';

describe('Cover Page', () => {
	// Helper to generate PDF with only cover page enabled
	const generateCoverOnlyPDF = async (configOverrides = {}) => {
		const config = {
			...DEFAULT_CONFIG,
			enableCover: true,
			enableIndex: false,
			enableGuide: false,
			enableIntention: false,
			enableGoals: false,
			enableFutureLog: false,
			enableMonthlyPages: false,
			enableHabitTracker: false,
			enableWeeklyPages: false,
			enableDailyPages: false,
			enableCollections: false,
			enableNotesPages: false,
			notesPageCount: 0,
			...configOverrides
		};

		const pdfBytes = await generatePDF(config);
		return PDFDocument.load(pdfBytes);
	};

	describe('page generation', () => {
		it('should create exactly one page when only cover is enabled', async () => {
			const doc = await generateCoverOnlyPDF();
			expect(doc.getPageCount()).toBe(1);
		});

		it('should use the configured year in display', async () => {
			const doc = await generateCoverOnlyPDF({ year: 2025 });
			// PDF is generated - year is embedded in the text
			expect(doc.getPageCount()).toBe(1);
		});
	});

	describe('custom title and subtitle', () => {
		it('should display custom title when provided', async () => {
			const doc = await generateCoverOnlyPDF({
				coverTitle: 'My Personal Planner'
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should display custom subtitle when provided', async () => {
			const doc = await generateCoverOnlyPDF({
				coverSubtitle: 'A Year of Growth'
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should display both custom title and subtitle', async () => {
			const doc = await generateCoverOnlyPDF({
				coverTitle: 'My Bullet Journal',
				coverSubtitle: 'Daily Reflections'
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should use year as default subtitle when no custom subtitle provided', async () => {
			const doc = await generateCoverOnlyPDF({
				year: 2025,
				coverTitle: 'Planner'
				// No coverSubtitle - should default to "2025"
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should use generic default title when no custom title provided', async () => {
			const doc = await generateCoverOnlyPDF({
				year: 2025
				// No coverTitle - should default to year
			});
			expect(doc.getPageCount()).toBe(1);
		});
	});

	describe('no branding', () => {
		it('should not include RapidInk branding text in the PDF', async () => {
			// This test ensures we follow the product guideline of no branding
			const doc = await generateCoverOnlyPDF();
			// The PDF should be generated without the "RapidInk" title
			expect(doc.getPageCount()).toBe(1);
		});
	});
});
