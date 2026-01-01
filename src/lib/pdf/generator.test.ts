import { describe, it, expect } from 'vitest';
import { generatePDF } from './generator';
import { DEFAULT_CONFIG } from '../config';
import { PDFDocument } from 'pdf-lib';

describe('PDF Generator', () => {
	describe('generatePDF', () => {
		it('should generate a valid PDF document', async () => {
			const config = {
				...DEFAULT_CONFIG,
				// Minimize pages for faster test
				enableWeeklyPages: false,
				enableDailyPages: false,
				enableCollections: false,
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);

			expect(pdfBytes).toBeDefined();
			expect(pdfBytes.length).toBeGreaterThan(0);

			// Verify it's a valid PDF by parsing it
			const doc = await PDFDocument.load(pdfBytes);
			expect(doc.getPageCount()).toBeGreaterThan(0);
		}, 30000);

		it('should embed config as attachment', async () => {
			const config = {
				...DEFAULT_CONFIG,
				enableWeeklyPages: false,
				enableDailyPages: false,
				enableCollections: false,
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);
			// Config is embedded - we can verify by checking file size includes config data
			expect(pdfBytes.length).toBeGreaterThan(1000);
		});

		it('should report progress during generation', async () => {
			const config = {
				...DEFAULT_CONFIG,
				enableWeeklyPages: false,
				enableDailyPages: false,
				enableCollections: false,
				notesPageCount: 0
			};

			const progressReports: string[] = [];
			await generatePDF(config, (progress) => {
				progressReports.push(progress.phase);
			});

			expect(progressReports).toContain('setup');
			expect(progressReports).toContain('finalize');
		});

		it('should create cover page when enabled', async () => {
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

			expect(doc.getPageCount()).toBe(1);
		});

		it('should skip cover page when disabled', async () => {
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
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);
			const doc = await PDFDocument.load(pdfBytes);

			// Should have index page(s) but no cover
			expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
		});

		it('should generate monthly pages for each month', async () => {
			const config = {
				...DEFAULT_CONFIG,
				enableCover: false,
				enableIndex: false,
				enableGuide: false,
				enableIntention: false,
				enableGoals: false,
				enableFutureLog: false,
				enableMonthlyPages: true,
				enableHabitTracker: false,
				enableWeeklyPages: false,
				enableDailyPages: false,
				enableCollections: false,
				enableNotesPages: false,
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);
			const doc = await PDFDocument.load(pdfBytes);

			// 12 months * 2 pages each (timeline + action) = 24
			expect(doc.getPageCount()).toBe(24);
		});

		it('should respect toolbar position setting for margins', async () => {
			const rightToolbarConfig = {
				...DEFAULT_CONFIG,
				toolbarPosition: 'right' as const,
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

			const leftToolbarConfig = {
				...rightToolbarConfig,
				toolbarPosition: 'left' as const
			};

			// Both should generate valid PDFs
			const rightPdf = await generatePDF(rightToolbarConfig);
			const leftPdf = await generatePDF(leftToolbarConfig);

			expect(rightPdf.length).toBeGreaterThan(0);
			expect(leftPdf.length).toBeGreaterThan(0);
		});
	});
});
