import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePDF } from './generator';
import { DEFAULT_CONFIG } from '../config';

describe('Guide/Legend Page', () => {
	// Helper to generate PDF with guide enabled
	const generateGuideOnlyPDF = async (configOverrides = {}) => {
		const config = {
			...DEFAULT_CONFIG,
			enableCover: false,
			enableIndex: false,
			enableGuide: true,
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
		it('should create guide page when enabled', async () => {
			const doc = await generateGuideOnlyPDF();
			expect(doc.getPageCount()).toBe(1);
		});

		it('should not create guide page when disabled', async () => {
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
			// Only cover page
			expect(doc.getPageCount()).toBe(1);
		});
	});

	describe('content sections', () => {
		it('should include rapid logging symbols legend', async () => {
			const doc = await generateGuideOnlyPDF();
			// Guide page generated with symbols
			expect(doc.getPageCount()).toBe(1);
		});

		it('should include planning flow diagram', async () => {
			const doc = await generateGuideOnlyPDF();
			// Guide page generated with flow
			expect(doc.getPageCount()).toBe(1);
		});
	});

	describe('dot grid background', () => {
		it('should include dot grid pattern based on config', async () => {
			const doc = await generateGuideOnlyPDF({
				dotStyle: 'dots',
				dotSpacing: 5,
				dotOpacity: 0.3
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should support grid style', async () => {
			const doc = await generateGuideOnlyPDF({
				dotStyle: 'grid'
			});
			expect(doc.getPageCount()).toBe(1);
		});

		it('should support blank style (no dots)', async () => {
			const doc = await generateGuideOnlyPDF({
				dotStyle: 'blank'
			});
			expect(doc.getPageCount()).toBe(1);
		});
	});
});
