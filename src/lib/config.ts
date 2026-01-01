import type { DevicePreset } from './devices';

export interface Collection {
	id: string;
	name: string;
	pages: number;
	template: 'blank' | 'dotgrid' | 'lined' | 'checklist' | 'grid';
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
	enabled: boolean;
}

export type DailyPageLayout = 'freeform' | 'timeblocked' | 'split' | 'schedule';
export type WeekStart = 'sunday' | 'monday';
export type DateFormat = 'short' | 'medium' | 'long' | 'numeric';
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
	handedness: 'right' | 'left';

	// Calendar settings
	year: number;
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
	{ id: 'index', label: 'Index', enabled: true },
	{ id: 'monthly', label: 'Month', enabled: true },
	{ id: 'weekly', label: 'Week', enabled: true },
	{ id: 'future-log', label: 'Future Log', enabled: false },
	{ id: 'intention', label: 'Intention', enabled: false },
	{ id: 'goals', label: 'Goals', enabled: false },
	{ id: 'habits', label: 'Habits', enabled: false },
	{ id: 'collections', label: 'Collections', enabled: false }
];

export const DEFAULT_CONFIG: RapidInkConfig = {
	version: 1,

	device: 'remarkable-1-2',
	orientation: 'portrait',
	handedness: 'right',

	year: new Date().getFullYear() + 1,
	weekStart: 'monday',
	locale: 'en-US',
	dateFormat: 'medium',

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
		{ id: '1', name: '' },
		{ id: '2', name: '' },
		{ id: '3', name: '' },
		{ id: '4', name: '' },
		{ id: '5', name: '' },
		{ id: '6', name: '' },
		{ id: '7', name: '' },
		{ id: '8', name: '' },
		{ id: '9', name: '' },
		{ id: '10', name: '' }
	],

	collections: [],
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
