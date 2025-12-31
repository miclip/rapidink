export interface DevicePreset {
	name: string;
	width: number;
	height: number;
	dpi: number;
	toolbarWidth: number;
	description: string;
	category: 'eink' | 'tablet' | 'print';
}

export const DEVICES: Record<string, DevicePreset> = {
	// reMarkable family
	'remarkable-1-2': {
		name: 'reMarkable 1 & 2',
		width: 1404,
		height: 1872,
		dpi: 226,
		toolbarWidth: 42,
		description: '10.3" digital note-taking device',
		category: 'eink'
	},
	'remarkable-paper-pro': {
		name: 'reMarkable Paper Pro',
		width: 1620,
		height: 2160,
		dpi: 229,
		toolbarWidth: 34,
		description: '11.8" color digital note-taking device',
		category: 'eink'
	},

	// Supernote family
	'supernote-a5x': {
		name: 'Supernote A5X / A5X2',
		width: 1404,
		height: 1872,
		dpi: 226,
		toolbarWidth: 30,
		description: '10.3" digital note-taking device',
		category: 'eink'
	},
	'supernote-a6x': {
		name: 'Supernote A6X / A6X2',
		width: 1080,
		height: 1440,
		dpi: 226,
		toolbarWidth: 24,
		description: '7.8" digital note-taking device',
		category: 'eink'
	},
	'supernote-nomad': {
		name: 'Supernote Nomad',
		width: 1240,
		height: 930,
		dpi: 300,
		toolbarWidth: 24,
		description: '7.8" color device (landscape)',
		category: 'eink'
	},

	// Kindle
	'kindle-scribe': {
		name: 'Kindle Scribe',
		width: 1860,
		height: 2480,
		dpi: 300,
		toolbarWidth: 40,
		description: '10.2" digital note-taking device',
		category: 'eink'
	},

	// Boox family
	'boox-note-air': {
		name: 'Boox Note Air / Tab Ultra',
		width: 1404,
		height: 1872,
		dpi: 227,
		toolbarWidth: 30,
		description: '10.3" digital note-taking device',
		category: 'eink'
	},
	'boox-note-air-4c': {
		name: 'Boox Note Air 4C',
		width: 1860,
		height: 2480,
		dpi: 300,
		toolbarWidth: 30,
		description: '10.3" color digital note-taking device',
		category: 'eink'
	},
	'boox-note-max': {
		name: 'Boox Note Max',
		width: 1650,
		height: 2200,
		dpi: 207,
		toolbarWidth: 36,
		description: '13.3" digital note-taking device',
		category: 'eink'
	},
	'boox-go-103': {
		name: 'Boox Go 10.3',
		width: 1860,
		height: 2480,
		dpi: 300,
		toolbarWidth: 30,
		description: '10.3" digital note-taking device',
		category: 'eink'
	},

	// iPad / Tablet apps (GoodNotes, Notability, OneNote)
	'ipad-letter': {
		name: 'iPad / GoodNotes (Letter)',
		width: 2550,
		height: 3300,
		dpi: 300,
		toolbarWidth: 0,
		description: '8.5×11" US Letter size',
		category: 'tablet'
	},
	'ipad-a4': {
		name: 'iPad / GoodNotes (A4)',
		width: 2480,
		height: 3508,
		dpi: 300,
		toolbarWidth: 0,
		description: '210×297mm A4 size',
		category: 'tablet'
	},
	'ipad-a5': {
		name: 'iPad / GoodNotes (A5)',
		width: 1748,
		height: 2480,
		dpi: 300,
		toolbarWidth: 0,
		description: '148×210mm A5 size',
		category: 'tablet'
	},
	'onenote-letter': {
		name: 'OneNote (Letter)',
		width: 2550,
		height: 3300,
		dpi: 300,
		toolbarWidth: 0,
		description: '8.5×11" US Letter size',
		category: 'tablet'
	},

	// Print sizes
	'print-letter': {
		name: 'Print (US Letter)',
		width: 2550,
		height: 3300,
		dpi: 300,
		toolbarWidth: 0,
		description: '8.5×11" for printing',
		category: 'print'
	},
	'print-a4': {
		name: 'Print (A4)',
		width: 2480,
		height: 3508,
		dpi: 300,
		toolbarWidth: 0,
		description: '210×297mm for printing',
		category: 'print'
	},
	'print-a5': {
		name: 'Print (A5)',
		width: 1748,
		height: 2480,
		dpi: 300,
		toolbarWidth: 0,
		description: '148×210mm for printing',
		category: 'print'
	},

	// Custom
	'custom': {
		name: 'Custom',
		width: 1404,
		height: 1872,
		dpi: 226,
		toolbarWidth: 0,
		description: 'User-defined dimensions',
		category: 'eink'
	}
};

export function getDevicesByCategory(category: DevicePreset['category']): [string, DevicePreset][] {
	return Object.entries(DEVICES).filter(([_, device]) => device.category === category);
}

export function getContentWidth(device: DevicePreset): number {
	return device.width - device.toolbarWidth;
}

export function getContentHeight(device: DevicePreset): number {
	return device.height;
}

export function pxToPoints(px: number, dpi: number): number {
	return (px / dpi) * 72;
}

export function pointsToPx(points: number, dpi: number): number {
	return (points / 72) * dpi;
}
