import type { DevicePreset } from './devices';

export type CollectionNavPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface Collection {
	id: string;
	name: string;
	pages: number;
	template: 'blank' | 'dotgrid' | 'lined' | 'checklist' | 'grid' | 'pdf';
	// PDF template fields (only used when template === 'pdf')
	pdfData?: string; // Base64-encoded PDF data
	pdfFilename?: string; // Original filename for display
	pdfPageCount?: number; // Number of pages in original PDF
	pdfCopies?: number; // How many copies of the PDF to include (default: 1)
	pdfNavLinks?: string[]; // Nav link IDs to overlay, e.g. ['index', 'collections']
	pdfNavPosition?: CollectionNavPosition; // Where to overlay nav links
}

export interface Habit {
	id: string;
	name: string;
}

export interface CalendarEvent {
	date: string; // ISO date string
	title: string;
	allDay: boolean;
	startTime?: string;
	endTime?: string;
}

export interface HolidaySettings {
	enabled: boolean;
	country: string;
	state: string;
}

export interface NavigationLink {
	id: string;
	label: string;
	enabled: boolean; // Enabled on reference pages
	enabledOnCalendar: boolean; // Enabled on calendar pages
}

export type DailyPageLayout = 'freeform' | 'timeblocked' | 'split' | 'schedule';
export type WeekStart = 'sunday' | 'monday';
export type DateFormat = 'short' | 'medium' | 'long' | 'numeric' | 'short-intl' | 'medium-intl' | 'long-intl';
export type DotStyle = 'dots' | 'grid' | 'lines' | 'blank';
export type FontChoice = 'helvetica' | 'times' | 'courier';

export interface RapidInkConfig {
	// Version for config migration
	version: number;

	// Cover page customization
	coverTitle?: string;
	coverSubtitle?: string;

	// Device settings
	device: string;
	customWidth?: number;
	customHeight?: number;
	customDpi?: number;
	customToolbarWidth?: number;
	orientation: 'portrait' | 'landscape';
	toolbarPosition: 'none' | 'left' | 'right' | 'top' | 'bottom';

	// Calendar settings
	year: number;
	startMonth: number; // 0-11 (January = 0)
	weekStart: WeekStart;
	locale: string;
	dateFormat: DateFormat;

	// Page enables
	enableCover: boolean;
	enableIndex: boolean;
	enableGuide: boolean;
	enableIntention: boolean;
	enableGoals: boolean;
	enableFutureLog: boolean;
	enableMonthlyPages: boolean;
	enableWeeklyPages: boolean;
	enableDailyPages: boolean;
	enableHabitTracker: boolean;
	enableCollections: boolean;
	enableNotesPages: boolean;

	// Sample mode - limit pages for preview
	sampleMonthCount?: number; // 0 or undefined = all 12 months

	// Navigation
	navigationLinks: NavigationLink[];

	// Daily page settings
	dailyLayout: DailyPageLayout;
	dailyTimeStart: number; // 0-23
	dailyTimeEnd: number; // 0-23
	dailyTimeIncrement: 30 | 60; // minutes
	weekdayLayout?: DailyPageLayout;
	weekendLayout?: DailyPageLayout;

	// Habit tracker
	habits: Habit[];

	// Collections
	collections: Collection[];
	writeInCollectionSlots: number;
	writeInCollectionPages: number; // Pages per write-in collection slot

	// Notes pages at end
	notesPageCount: number;

	// Visual settings - global styling
	fontFamily: FontChoice;
	fontSize: number;
	textColor: string; // hex color for all text (#000000)
	lineColor: string; // hex color for all lines/borders (#666666)
	lineOpacity: number; // 0-1 for lines

	// Dot grid settings
	dotStyle: DotStyle;
	dotSpacing: number; // mm
	dotSize: number; // px
	dotOpacity: number; // 0-1

	// Holidays
	holidays: HolidaySettings;

	// Calendar events (from iCal import)
	events: CalendarEvent[];

	// Reflection prompts
	weeklyReflectionEnabled: boolean;
	monthlyReflectionEnabled: boolean;
	reflectionPrompts: string[];
}

export const DEFAULT_NAVIGATION_LINKS: NavigationLink[] = [
	{ id: 'guide', label: 'Guide', enabled: true, enabledOnCalendar: false },
	{ id: 'index', label: 'Index', enabled: true, enabledOnCalendar: true },
	{ id: 'intention', label: 'Intention', enabled: true, enabledOnCalendar: false },
	{ id: 'goals', label: 'Goals', enabled: true, enabledOnCalendar: false },
	{ id: 'future-log', label: 'Future Log', enabled: true, enabledOnCalendar: false },
	{ id: 'monthly', label: 'Month', enabled: true, enabledOnCalendar: true },
	{ id: 'habits', label: 'Habits', enabled: true, enabledOnCalendar: true },
	{ id: 'weekly', label: 'Week', enabled: true, enabledOnCalendar: true },
	{ id: 'collections', label: 'Collections', enabled: true, enabledOnCalendar: true }
];

export const DEFAULT_CONFIG: RapidInkConfig = {
	version: 1,

	device: 'remarkable-paper-pro',
	orientation: 'portrait',
	toolbarPosition: 'left',

	year: new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
	startMonth: 0, // January
	weekStart: 'monday',
	locale: 'en-US',
	dateFormat: 'long',

	enableCover: true,
	enableIndex: true,
	enableGuide: true,
	enableIntention: true,
	enableGoals: true,
	enableFutureLog: true,
	enableMonthlyPages: true,
	enableWeeklyPages: true,
	enableDailyPages: true,
	enableHabitTracker: true,
	enableCollections: true,
	enableNotesPages: false,

	navigationLinks: DEFAULT_NAVIGATION_LINKS,

	dailyLayout: 'freeform',
	dailyTimeStart: 6,
	dailyTimeEnd: 22,
	dailyTimeIncrement: 60,

	habits: [
		{ id: '1', name: 'Exercise' },
		{ id: '2', name: 'Spanish' },
		{ id: '3', name: '' },
		{ id: '4', name: '' },
		{ id: '5', name: '' },
		{ id: '6', name: '' },
		{ id: '7', name: '' },
		{ id: '8', name: '' },
		{ id: '9', name: '' },
		{ id: '10', name: '' }
	],

	collections: [
		{ id: 'shopping', name: 'Shopping List', pages: 2, template: 'checklist' },
		{ id: 'food-log', name: 'Food Log', pages: 5, template: 'dotgrid' }
	],
	writeInCollectionSlots: 20,
	writeInCollectionPages: 2,

	notesPageCount: 30,

	fontFamily: 'helvetica',
	fontSize: 12,
	textColor: '#000000',
	lineColor: '#666666',
	lineOpacity: 0.8,
	dotStyle: 'dots',
	dotSpacing: 5,
	dotSize: 1,
	dotOpacity: 0.3,

	holidays: {
		enabled: true,
		country: 'US',
		state: ''
	},

	events: [],

	weeklyReflectionEnabled: true,
	monthlyReflectionEnabled: true,
	reflectionPrompts: [
		'What moved you toward your goals this week?',
		'What moved you away from your goals?',
		'What will you do differently next week?'
	]
};

export function serializeConfig(config: RapidInkConfig): string {
	return JSON.stringify(config);
}

export function deserializeConfig(json: string): RapidInkConfig {
	const parsed = JSON.parse(json);
	// TODO: Add version migration logic here
	return { ...DEFAULT_CONFIG, ...parsed };
}
