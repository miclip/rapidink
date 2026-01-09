import { describe, it, expect } from 'vitest';
import { generatePDF, extractPageAnchors } from './generator';
import { DEFAULT_CONFIG } from '../config';
import { PDFDocument, PDFName, PDFHexString, PDFString, PDFRef, decodePDFRawStream } from 'pdf-lib';

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

		it('should embed config as attachment that can be extracted', async () => {
			const config = {
				...DEFAULT_CONFIG,
				enableWeeklyPages: false,
				enableDailyPages: false,
				enableCollections: false,
				notesPageCount: 0
			};

			const pdfBytes = await generatePDF(config);
			const pdfDoc = await PDFDocument.load(pdfBytes);

			// Try to extract the embedded config using the same logic as +page.svelte
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawAttachments = pdfDoc.catalog.lookup(PDFName.of('Names')) as any;
			expect(rawAttachments).toBeTruthy();

			const embeddedFiles = rawAttachments!.lookup(PDFName.of('EmbeddedFiles'));
			expect(embeddedFiles).toBeTruthy();

			const namesArray = embeddedFiles!.lookup(PDFName.of('Names'));
			expect(namesArray).toBeTruthy();
			expect(namesArray!.asArray).toBeTruthy();

			const arr = namesArray!.asArray();
			let foundConfig = false;
			let extractedConfig: Record<string, unknown> | null = null;

			for (let i = 0; i < arr.length; i += 2) {
				const nameObj = arr[i];
				let filename = '';
				if (nameObj instanceof PDFHexString) {
					filename = nameObj.decodeText();
				} else if (nameObj instanceof PDFString) {
					filename = nameObj.decodeText();
				} else if (nameObj.toString) {
					filename = nameObj.toString();
				}

				if (filename.includes('rapidink-config.json')) {
					foundConfig = true;
					// fileSpec may be a PDFRef, need to dereference it first
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					let fileSpec = arr[i + 1] as any;
					if (fileSpec instanceof PDFRef) {
						fileSpec = pdfDoc.context.lookup(fileSpec);
					}
					const efDict = fileSpec.lookup(PDFName.of('EF'));
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					let stream = efDict.lookup(PDFName.of('F')) as any;
					if (stream instanceof PDFRef) {
						stream = pdfDoc.context.lookup(stream);
					}
					// Decode the stream (handles FlateDecode compression)
					const decoded = decodePDFRawStream(stream);
					const text = new TextDecoder().decode(decoded.decode());
					extractedConfig = JSON.parse(text);
					break;
				}
			}

			expect(foundConfig).toBe(true);
			expect(extractedConfig).toBeTruthy();
			expect(extractedConfig!.year).toBe(config.year);
		}, 30000);

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

		it('should embed page anchors for Notes Preservation', async () => {
			const config = {
				...DEFAULT_CONFIG,
				enableCover: true,
				enableIndex: true,
				enableGuide: false,
				enableIntention: false,
				enableGoals: false,
				enableFutureLog: false,
				enableMonthlyPages: true,
				enableHabitTracker: false,
				enableWeeklyPages: false,
				enableDailyPages: true,
				enableCollections: false,
				enableNotesPages: false,
				notesPageCount: 0,
				sampleMonthCount: 1 // Just January for faster test
			};

			const pdfBytes = await generatePDF(config);
			const doc = await PDFDocument.load(pdfBytes);
			const anchors = extractPageAnchors(doc);

			// Should have anchors for pages with identifiable content
			expect(anchors.length).toBeGreaterThan(0);

			// Check for expected anchor types
			const anchorStrings = anchors.map(a => a.anchor);

			// Should have index anchor
			expect(anchorStrings).toContain('index');

			// Should have monthly anchors
			expect(anchorStrings.some(a => a.startsWith('month-'))).toBe(true);

			// Should have daily anchors (e.g., day-2026-01-01)
			expect(anchorStrings.some(a => a.startsWith('day-'))).toBe(true);
		}, 30000);
	});
});
