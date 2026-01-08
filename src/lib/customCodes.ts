import type { CustomCode } from './config';
import dayjs from 'dayjs';

/**
 * Check if a custom code is active on a specific date
 */
export function isCodeActiveOnDate(code: CustomCode, date: dayjs.Dayjs): boolean {
	const startDate = dayjs(code.schedule.startDate);
	const daysSinceStart = date.diff(startDate, 'day');

	// Before start date - not active
	if (daysSinceStart < 0) return false;

	const cycleLength = code.schedule.frequency === 'biweekly' ? 14 : 7;
	const dayInCycle = daysSinceStart % cycleLength;

	return dayInCycle < code.schedule.spanDays;
}

/**
 * Get all active codes for a specific date
 */
export function getActiveCodesForDate(codes: CustomCode[], date: dayjs.Dayjs): CustomCode[] {
	return codes.filter((code) => isCodeActiveOnDate(code, date));
}

/**
 * Get active codes for a week, with the specific days they're active
 * Returns array of { code, activeDays } where activeDays is array of dates
 */
export function getActiveCodesForWeek(
	codes: CustomCode[],
	weekStart: dayjs.Dayjs
): { code: CustomCode; activeDays: dayjs.Dayjs[] }[] {
	const results: { code: CustomCode; activeDays: dayjs.Dayjs[] }[] = [];

	for (const code of codes) {
		const activeDays: dayjs.Dayjs[] = [];

		for (let i = 0; i < 7; i++) {
			const day = weekStart.add(i, 'day');
			if (isCodeActiveOnDate(code, day)) {
				activeDays.push(day);
			}
		}

		if (activeDays.length > 0) {
			results.push({ code, activeDays });
		}
	}

	return results;
}

/**
 * Format day letter for display (M, T, W, T, F, S, S)
 */
export function getDayLetter(date: dayjs.Dayjs): string {
	const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	return days[date.day()];
}

/**
 * Format active days as "10 F, 11 S, 12 S, ..." for weekly display
 */
export function formatActiveDaysForWeek(activeDays: dayjs.Dayjs[]): string {
	return activeDays.map((d) => `${d.date()} ${getDayLetter(d)}`).join(', ');
}
