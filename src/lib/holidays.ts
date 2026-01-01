import Holidays from 'date-holidays';

export interface Holiday {
	date: string; // YYYY-MM-DD
	name: string;
	type: 'public' | 'bank' | 'school' | 'optional' | 'observance';
}

// Common countries with their display names
export const COUNTRIES: Record<string, string> = {
	US: 'United States',
	CA: 'Canada',
	GB: 'United Kingdom',
	AU: 'Australia',
	DE: 'Germany',
	FR: 'France',
	IT: 'Italy',
	ES: 'Spain',
	NL: 'Netherlands',
	BE: 'Belgium',
	AT: 'Austria',
	CH: 'Switzerland',
	SE: 'Sweden',
	NO: 'Norway',
	DK: 'Denmark',
	FI: 'Finland',
	IE: 'Ireland',
	NZ: 'New Zealand',
	JP: 'Japan',
	KR: 'South Korea',
	CN: 'China',
	IN: 'India',
	BR: 'Brazil',
	MX: 'Mexico',
	ZA: 'South Africa',
	SG: 'Singapore',
	HK: 'Hong Kong',
	PL: 'Poland',
	CZ: 'Czech Republic',
	PT: 'Portugal'
};

// States/regions for countries that have them
export const STATES: Record<string, Record<string, string>> = {
	US: {
		'': 'Federal Only',
		AL: 'Alabama',
		AK: 'Alaska',
		AZ: 'Arizona',
		AR: 'Arkansas',
		CA: 'California',
		CO: 'Colorado',
		CT: 'Connecticut',
		DE: 'Delaware',
		FL: 'Florida',
		GA: 'Georgia',
		HI: 'Hawaii',
		ID: 'Idaho',
		IL: 'Illinois',
		IN: 'Indiana',
		IA: 'Iowa',
		KS: 'Kansas',
		KY: 'Kentucky',
		LA: 'Louisiana',
		ME: 'Maine',
		MD: 'Maryland',
		MA: 'Massachusetts',
		MI: 'Michigan',
		MN: 'Minnesota',
		MS: 'Mississippi',
		MO: 'Missouri',
		MT: 'Montana',
		NE: 'Nebraska',
		NV: 'Nevada',
		NH: 'New Hampshire',
		NJ: 'New Jersey',
		NM: 'New Mexico',
		NY: 'New York',
		NC: 'North Carolina',
		ND: 'North Dakota',
		OH: 'Ohio',
		OK: 'Oklahoma',
		OR: 'Oregon',
		PA: 'Pennsylvania',
		RI: 'Rhode Island',
		SC: 'South Carolina',
		SD: 'South Dakota',
		TN: 'Tennessee',
		TX: 'Texas',
		UT: 'Utah',
		VT: 'Vermont',
		VA: 'Virginia',
		WA: 'Washington',
		WV: 'West Virginia',
		WI: 'Wisconsin',
		WY: 'Wyoming',
		DC: 'Washington D.C.'
	},
	CA: {
		'': 'Federal Only',
		AB: 'Alberta',
		BC: 'British Columbia',
		MB: 'Manitoba',
		NB: 'New Brunswick',
		NL: 'Newfoundland and Labrador',
		NS: 'Nova Scotia',
		NT: 'Northwest Territories',
		NU: 'Nunavut',
		ON: 'Ontario',
		PE: 'Prince Edward Island',
		QC: 'Quebec',
		SK: 'Saskatchewan',
		YT: 'Yukon'
	},
	AU: {
		'': 'National Only',
		ACT: 'Australian Capital Territory',
		NSW: 'New South Wales',
		NT: 'Northern Territory',
		QLD: 'Queensland',
		SA: 'South Australia',
		TAS: 'Tasmania',
		VIC: 'Victoria',
		WA: 'Western Australia'
	},
	DE: {
		'': 'National Only',
		BB: 'Brandenburg',
		BE: 'Berlin',
		BW: 'Baden-Württemberg',
		BY: 'Bavaria',
		HB: 'Bremen',
		HE: 'Hesse',
		HH: 'Hamburg',
		MV: 'Mecklenburg-Vorpommern',
		NI: 'Lower Saxony',
		NW: 'North Rhine-Westphalia',
		RP: 'Rhineland-Palatinate',
		SH: 'Schleswig-Holstein',
		SL: 'Saarland',
		SN: 'Saxony',
		ST: 'Saxony-Anhalt',
		TH: 'Thuringia'
	}
};

export function getHolidaysForYear(
	year: number,
	country: string,
	state?: string
): Holiday[] {
	const hd = new Holidays();

	if (state) {
		hd.init(country, state);
	} else {
		hd.init(country);
	}

	const holidays = hd.getHolidays(year);

	return holidays
		.filter((h) => h.type === 'public' || h.type === 'bank')
		.map((h) => {
			const date = new Date(h.date);
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, '0');
			const dd = String(date.getDate()).padStart(2, '0');

			return {
				date: `${yyyy}-${mm}-${dd}`,
				name: h.name,
				type: h.type as Holiday['type']
			};
		});
}

export function hasStates(country: string): boolean {
	return country in STATES;
}

export function getStatesForCountry(country: string): Record<string, string> {
	return STATES[country] || {};
}
