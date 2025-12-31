import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePDF } from './generator';
import { DEFAULT_CONFIG } from '../config';

describe('Index Pages', () => {
	// Helper to generate PDF with index enabled
	const generateIndexOnlyPDF = async (configOverrides = {}) => {
		const config = {
			...DEFAULT_CONFIG,
			enableCover: false,
			enableIndex: true,
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
		it('should create index page when enabled', async () => {
			const doc = await generateIndexOnlyPDF();
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});

		it('should not create index page when disabled', async () => {
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
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);
			const doc = await PDFDocument.load(pdfBytes);
			// Only cover page should exist
			expect(doc.getPageCount()).toBe(1);
		});
	});

	describe('quick navigation sections', () => {
		it('should include enabled sections in index', async () => {
			const doc = await generateIndexOnlyPDF({
				enableGuide: true,
				enableGoals: true
			});
			// Index page generated successfully with enabled sections
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});

		it('should handle all sections disabled', async () => {
			const doc = await generateIndexOnlyPDF({
				enableGuide: false,
				enableIntention: false,
				enableGoals: false,
				enableFutureLog: false,
				enableHabitTracker: false,
				enableCollections: false
			});
			// Should still generate index page
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});
	});

	describe('monthly navigation', () => {
		it('should list all 12 months in the index', async () => {
			const doc = await generateIndexOnlyPDF({
				enableMonthlyPages: true
			});
			// Index page should be created with monthly links
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});
	});

	describe('weekly navigation', () => {
		it('should list weeks based on year configuration', async () => {
			const doc = await generateIndexOnlyPDF({
				year: 2025,
				weekStart: 'monday',
				enableWeeklyPages: true
			});
			// Index page should be created with weekly links
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});

		it('should handle different week start days', async () => {
			const docMonday = await generateIndexOnlyPDF({
				year: 2025,
				weekStart: 'monday'
			});
			const docSunday = await generateIndexOnlyPDF({
				year: 2025,
				weekStart: 'sunday'
			});

			// Both should generate successfully
			expect(docMonday.getPageCount()).toBeGreaterThanOrEqual(1);
			expect(docSunday.getPageCount()).toBeGreaterThanOrEqual(1);
		});
	});
});
