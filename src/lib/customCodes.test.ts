import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
	isCodeActiveOnDate,
	getActiveCodesForDate,
	getActiveCodesForWeek,
	getDayLetter
} from './customCodes';
import type { CustomCode } from './config';

describe('Custom Codes', () => {
	const garbageCode: CustomCode = {
		id: 'garbage',
		code: 'G',
		description: 'Garbage',
		type: 'task',
		schedule: {
			frequency: 'biweekly',
			startDate: '2026-01-13', // Tuesday
			spanDays: 1
		}
	};

	const recyclingCode: CustomCode = {
		id: 'recycling',
		code: 'GR',
		description: 'Garbage + Recycling',
		type: 'task',
		schedule: {
			frequency: 'biweekly',
			startDate: '2026-01-06', // Tuesday
			spanDays: 1
		}
	};

	const hannahCode: CustomCode = {
		id: 'hannah',
		code: 'H',
		description: 'Hannah',
		type: 'event',
		schedule: {
			frequency: 'biweekly',
			startDate: '2026-01-02', // Friday
			spanDays: 7 // Friday through Thursday
		}
	};

	describe('isCodeActiveOnDate', () => {
		it('should return true on the start date', () => {
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-13'))).toBe(true);
		});

		it('should return false before start date', () => {
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-06'))).toBe(false);
		});

		it('should return true on biweekly recurrence', () => {
			// 2 weeks after Jan 13 = Jan 27
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-27'))).toBe(true);
			// 4 weeks after = Feb 10
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-02-10'))).toBe(true);
		});

		it('should return false on off-weeks for biweekly', () => {
			// 1 week after Jan 13 = Jan 20 (off week)
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-20'))).toBe(false);
		});

		it('should handle multi-day spans', () => {
			// Hannah starts Jan 2 (Fri), spans 7 days
			expect(isCodeActiveOnDate(hannahCode, dayjs('2026-01-02'))).toBe(true); // Fri
			expect(isCodeActiveOnDate(hannahCode, dayjs('2026-01-03'))).toBe(true); // Sat
			expect(isCodeActiveOnDate(hannahCode, dayjs('2026-01-08'))).toBe(true); // Thu (day 7)
			expect(isCodeActiveOnDate(hannahCode, dayjs('2026-01-09'))).toBe(false); // Fri (day 8, off week)
		});

		it('should handle alternating biweekly codes', () => {
			// GR starts Jan 6, G starts Jan 13 - they alternate
			expect(isCodeActiveOnDate(recyclingCode, dayjs('2026-01-06'))).toBe(true);
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-06'))).toBe(false);

			expect(isCodeActiveOnDate(recyclingCode, dayjs('2026-01-13'))).toBe(false);
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-13'))).toBe(true);

			expect(isCodeActiveOnDate(recyclingCode, dayjs('2026-01-20'))).toBe(true);
			expect(isCodeActiveOnDate(garbageCode, dayjs('2026-01-20'))).toBe(false);
		});
	});

	describe('getActiveCodesForDate', () => {
		it('should return all active codes for a date', () => {
			const codes = [garbageCode, recyclingCode, hannahCode];

			// Jan 6: GR and H active
			const jan6 = getActiveCodesForDate(codes, dayjs('2026-01-06'));
			expect(jan6.map((c) => c.code)).toEqual(['GR', 'H']);

			// Jan 13: G only (H off week)
			const jan13 = getActiveCodesForDate(codes, dayjs('2026-01-13'));
			expect(jan13.map((c) => c.code)).toEqual(['G']);
		});

		it('should return empty array when no codes active', () => {
			const codes = [garbageCode];
			const result = getActiveCodesForDate(codes, dayjs('2026-01-01'));
			expect(result).toEqual([]);
		});
	});

	describe('getActiveCodesForWeek', () => {
		it('should return codes with their active days for a week', () => {
			const codes = [garbageCode, hannahCode];
			const weekStart = dayjs('2026-01-12'); // Monday

			const result = getActiveCodesForWeek(codes, weekStart);

			// G is active on Jan 13 (Tuesday)
			const gResult = result.find((r) => r.code.code === 'G');
			expect(gResult).toBeDefined();
			expect(gResult!.activeDays.map((d) => d.format('YYYY-MM-DD'))).toEqual(['2026-01-13']);

			// H is active Jan 16-18 (Fri-Sun of this week, continuing from previous week)
			const hResult = result.find((r) => r.code.code === 'H');
			expect(hResult).toBeDefined();
			expect(hResult!.activeDays.length).toBeGreaterThan(0);
		});

		it('should not include codes with no active days in the week', () => {
			const codes = [garbageCode];
			const weekStart = dayjs('2026-01-05'); // Week before G starts

			const result = getActiveCodesForWeek(codes, weekStart);
			expect(result.find((r) => r.code.code === 'G')).toBeUndefined();
		});
	});

	describe('getDayLetter', () => {
		it('should return correct day letters', () => {
			expect(getDayLetter(dayjs('2026-01-05'))).toBe('M'); // Monday
			expect(getDayLetter(dayjs('2026-01-06'))).toBe('T'); // Tuesday
			expect(getDayLetter(dayjs('2026-01-07'))).toBe('W'); // Wednesday
			expect(getDayLetter(dayjs('2026-01-08'))).toBe('T'); // Thursday
			expect(getDayLetter(dayjs('2026-01-09'))).toBe('F'); // Friday
			expect(getDayLetter(dayjs('2026-01-10'))).toBe('S'); // Saturday
			expect(getDayLetter(dayjs('2026-01-11'))).toBe('S'); // Sunday
		});
	});
});
