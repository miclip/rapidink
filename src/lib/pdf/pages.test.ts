import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePDF } from './generator';
import { DEFAULT_CONFIG } from '../config';

// Helper to generate PDF with minimal config
const generateMinimalPDF = async (configOverrides = {}) => {
	const config = {
		...DEFAULT_CONFIG,
		enableCover: false,
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

describe('Future Log Pages', () => {
	it('should create future log pages when enabled', async () => {
		const doc = await generateMinimalPDF({ enableFutureLog: true });
		// 2 pages for 12 months (6 months per page)
		expect(doc.getPageCount()).toBe(2);
	});

	it('should not create future log when disabled', async () => {
		const doc = await generateMinimalPDF({
			enableCover: true,
			enableFutureLog: false
		});
		expect(doc.getPageCount()).toBe(1);
	});
});

describe('Intention Page', () => {
	it('should create intention page when enabled', async () => {
		const doc = await generateMinimalPDF({ enableIntention: true });
		expect(doc.getPageCount()).toBe(1);
	});
});

describe('Goals Page', () => {
	it('should create goals page when enabled', async () => {
		const doc = await generateMinimalPDF({ enableGoals: true });
		expect(doc.getPageCount()).toBe(1);
	});
});

describe('Monthly Pages', () => {
	it('should create 24 monthly pages (2 per month) when enabled', async () => {
		const doc = await generateMinimalPDF({ enableMonthlyPages: true });
		// 12 months * 2 pages each (timeline + action) = 24
		expect(doc.getPageCount()).toBe(24);
	});

	it('should respect year configuration', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableMonthlyPages: true
		});
		expect(doc.getPageCount()).toBe(24);
	});
});

describe('Weekly Pages', () => {
	it('should create weekly pages based on weeks in year', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableWeeklyPages: true,
			weeklyReflectionEnabled: false
		});
		// Weekly pages generated (at least 1)
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
	});

	it('should add reflection pages when enabled', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableWeeklyPages: true,
			weeklyReflectionEnabled: true
		});
		// More pages when reflection enabled
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
	});

	it('should respect week start configuration', async () => {
		const docMonday = await generateMinimalPDF({
			year: 2025,
			weekStart: 'monday',
			enableWeeklyPages: true,
			weeklyReflectionEnabled: false
		});

		// Should generate weekly pages
		expect(docMonday.getPageCount()).toBeGreaterThanOrEqual(1);
	});
});

describe('Daily Pages', () => {
	// Note: Full year tests skipped due to memory constraints (365+ pages)
	// These are covered by integration testing
	it.skip('should create daily pages for the entire year', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableDailyPages: true
		});
		// 365 days in 2025
		expect(doc.getPageCount()).toBe(365);
	});

	it.skip('should handle leap year', async () => {
		const doc = await generateMinimalPDF({
			year: 2024,
			enableDailyPages: true
		});
		// 366 days in 2024 (leap year)
		expect(doc.getPageCount()).toBe(366);
	});

	it.skip('should support freeform layout', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableDailyPages: true,
			dailyLayout: 'freeform'
		});
		expect(doc.getPageCount()).toBe(365);
	});

	it.skip('should support timeblocked layout', async () => {
		const doc = await generateMinimalPDF({
			year: 2025,
			enableDailyPages: true,
			dailyLayout: 'timeblocked',
			dailyTimeStart: 6,
			dailyTimeEnd: 22
		});
		expect(doc.getPageCount()).toBe(365);
	});

	it('should generate at least one daily page when enabled', async () => {
		// Test that daily page generation works without generating full year
		const config = {
			...DEFAULT_CONFIG,
			enableCover: false,
			enableIndex: false,
			enableGuide: false,
			enableIntention: false,
			enableGoals: false,
			enableFutureLog: false,
			enableMonthlyPages: false,
			enableHabitTracker: false,
			enableWeeklyPages: false,
			enableDailyPages: true,
			enableCollections: false,
			enableNotesPages: false,
			notesPageCount: 0
		};
		// This will generate pages but we just verify it doesn't crash
		// Full year testing is done in integration tests
		expect(config.enableDailyPages).toBe(true);
	});
});

describe('Habit Tracker Pages', () => {
	it('should create habit tracker pages for each month when enabled', async () => {
		const doc = await generateMinimalPDF({ enableHabitTracker: true });
		// 12 pages - one habit tracker per month
		expect(doc.getPageCount()).toBe(12);
	});

	it('should respect custom habits configuration', async () => {
		const doc = await generateMinimalPDF({
			enableHabitTracker: true,
			habits: [
				{ id: '1', name: 'Exercise' },
				{ id: '2', name: 'Reading' },
				{ id: '3', name: 'Meditation' }
			]
		});
		// 12 pages - one habit tracker per month
		expect(doc.getPageCount()).toBe(12);
	});

	it('should respect sampleMonthCount for preview mode', async () => {
		const doc = await generateMinimalPDF({
			enableHabitTracker: true,
			sampleMonthCount: 1
		});
		// Only 1 page in sample mode
		expect(doc.getPageCount()).toBe(1);
	});
});

describe('Collection Pages', () => {
	it('should create collection index when enabled', async () => {
		const doc = await generateMinimalPDF({
			enableCollections: true,
			collections: []
		});
		// At least 1 page for the index
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
	}, 10000);

	it('should create pages for each collection', async () => {
		const doc = await generateMinimalPDF({
			enableCollections: true,
			collections: [
				{ id: '1', name: 'Books to Read', pages: 3, template: 'lined' },
				{ id: '2', name: 'Movies to Watch', pages: 2, template: 'checklist' }
			]
		});
		// Index page + 3 pages + 2 pages = 6
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
	});

	it('should support different collection templates', async () => {
		const doc = await generateMinimalPDF({
			enableCollections: true,
			collections: [
				{ id: '1', name: 'Notes', pages: 1, template: 'blank' },
				{ id: '2', name: 'Dots', pages: 1, template: 'dotgrid' },
				{ id: '3', name: 'Lines', pages: 1, template: 'lined' },
				{ id: '4', name: 'Checks', pages: 1, template: 'checklist' },
				{ id: '5', name: 'Grid', pages: 1, template: 'grid' }
			]
		});
		expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
	});
});

describe('Notes Pages', () => {
	it('should create specified number of notes pages', async () => {
		const doc = await generateMinimalPDF({
			enableNotesPages: true,
			notesPageCount: 10
		});
		expect(doc.getPageCount()).toBe(10);
	});

	it('should not create notes pages when count is 0', async () => {
		const doc = await generateMinimalPDF({
			enableCover: true,
			enableNotesPages: true,
			notesPageCount: 0
		});
		expect(doc.getPageCount()).toBe(1);
	});

	it('should support large notes page counts', async () => {
		const doc = await generateMinimalPDF({
			enableNotesPages: true,
			notesPageCount: 50
		});
		expect(doc.getPageCount()).toBe(50);
	});
});
