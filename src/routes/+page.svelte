<script lang="ts">
	import { tick } from 'svelte';
	import { base } from '$app/paths';
	import { PDFDocument, PDFName, PDFHexString, PDFString, PDFRef, decodePDFRawStream } from 'pdf-lib';
	import { DEVICES, getDevicesByCategory } from '$lib/devices';
	import { DEFAULT_CONFIG, type RapidInkConfig, type Habit, type Collection, type NavigationLink } from '$lib/config';
	import { COUNTRIES, STATES, hasStates, getStatesForCountry } from '$lib/holidays';
	import type { GeneratorProgress } from '$lib/pdf/generator';

	let config: RapidInkConfig = { ...DEFAULT_CONFIG };
	let generating = false;
	let progress: GeneratorProgress | null = null;
	let pdfUrl: string | null = null;
	let isSampleMode = true; // Default to sample mode for review
	let userMessage: { type: 'success' | 'warning' | 'error'; text: string } | null = null;

	// Track which sections are open
	let openSections: Record<string, boolean> = {
		general: true,
		pages: false,
		navigation: false,
		daily: false,
		habits: false,
		collections: false,
		visual: false
	};

	// Navigation link groups
	const REFERENCE_NAV_IDS = ['guide', 'index', 'intention', 'goals', 'future-log', 'collections'];
	const CALENDAR_NAV_IDS = ['index', 'monthly', 'habits', 'weekly', 'collections'];

	const einkDevices = getDevicesByCategory('eink');
	const tabletDevices = getDevicesByCategory('tablet');
	const printDevices = getDevicesByCategory('print');

	// Reactive: get available states for selected country
	$: availableStates = hasStates(config.holidays.country)
		? getStatesForCountry(config.holidays.country)
		: {};
	$: showStatesDropdown = Object.keys(availableStates).length > 0;

	// Reset state when country changes
	function handleCountryChange() {
		config.holidays.state = '';
	}

	function toggleSection(section: string) {
		openSections[section] = !openSections[section];
	}

	async function handleGenerate() {
		generating = true;
		progress = null;
		pdfUrl = null;
		userMessage = null;

		try {
			const { generatePDF } = await import('$lib/pdf/generator');

			// Create config for generation
			let genConfig = { ...config };

			if (isSampleMode) {
				// Sample mode: generate preview for first month
				// - All front matter (cover, index, guide, intention, goals)
				// - Future log (2 pages)
				// - 1 month of monthly pages (2 pages)
				// - Weekly pages for weeks in first month (~4-5 pages)
				// - 1 month of daily pages (~31 pages)
				// - 1 month of habit tracker (1 page)
				// - All collections (year-long)
				genConfig = {
					...config,
					sampleMonthCount: 1 // Only generate first month
				};
			}

			const pdfBytes = await generatePDF(genConfig, (p) => {
				progress = p;
			}, base);

			const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
			pdfUrl = URL.createObjectURL(blob);
		} catch (err) {
			console.error('PDF generation failed:', err);
			alert('Failed to generate PDF. Check console for details.');
		} finally {
			generating = false;
		}
	}

	function handleDownload() {
		if (!pdfUrl) return;
		const a = document.createElement('a');
		a.href = pdfUrl;
		a.download = `rapidink-${config.year}${isSampleMode ? '-sample' : ''}.pdf`;
		a.click();
	}

	async function handleGenerateFull() {
		isSampleMode = false;
		await handleGenerate();
	}

	function addHabit() {
		config.habits = [...config.habits, { id: crypto.randomUUID(), name: '' }];
	}

	function removeHabit(id: string) {
		config.habits = config.habits.filter(h => h.id !== id);
	}

	function addCollection() {
		config.collections = [...config.collections, {
			id: crypto.randomUUID(),
			name: '',
			pages: 2,
			template: 'dotgrid'
		}];
	}

	function removeCollection(id: string) {
		config.collections = config.collections.filter(c => c.id !== id);
	}

	async function handleImportConfig(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;
		userMessage = null;

		const file = input.files[0];
		if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
			try {
				const arrayBuffer = await file.arrayBuffer();
				const pdfDoc = await PDFDocument.load(arrayBuffer);

				// Try to find the embedded config attachment
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const rawAttachments = pdfDoc.catalog.lookup(PDFName.of('Names')) as any;
				if (rawAttachments) {
					const embeddedFiles = rawAttachments.lookup(PDFName.of('EmbeddedFiles'));
					if (embeddedFiles) {
						const namesArray = embeddedFiles.lookup(PDFName.of('Names'));
						if (namesArray && namesArray.asArray) {
							const arr = namesArray.asArray();
							for (let i = 0; i < arr.length; i += 2) {
								const nameObj = arr[i];
								// Decode the filename - it may be PDFHexString or PDFString
								let filename = '';
								if (nameObj instanceof PDFHexString) {
									filename = nameObj.decodeText();
								} else if (nameObj instanceof PDFString) {
									filename = nameObj.decodeText();
								} else if (nameObj.toString) {
									filename = nameObj.toString();
								}
								if (filename.includes('rapidink-config.json')) {
									// Dereference PDFRef if needed
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
									const imported = JSON.parse(text);
									// Update year based on current month (next year only after September)
									const defaultYear = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
									config = { ...DEFAULT_CONFIG, ...imported, year: defaultYear };
									await tick();
									userMessage = { type: 'success', text: `Config imported! Year updated to ${config.year}` };
									return;
								}
							}
						}
					}
				}
				userMessage = { type: 'warning', text: 'No config found in PDF. This PDF may not have been generated by RapidInk.' };
			} catch (err) {
				console.error('PDF import error:', err);
				userMessage = { type: 'error', text: 'Could not extract config from PDF' };
			}
		} else if (file.type === 'application/json' || file.name.endsWith('.json')) {
			const text = await file.text();
			try {
				const imported = JSON.parse(text);
				config = { ...DEFAULT_CONFIG, ...imported };
				await tick();
				userMessage = { type: 'success', text: 'Config imported from JSON' };
			} catch {
				userMessage = { type: 'error', text: 'Invalid config file' };
			}
		}
		// Reset the input so the same file can be imported again
		input.value = '';
	}

	function handleExportConfig() {
		const json = JSON.stringify(config, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'rapidink-config.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleImportICal(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		const text = await file.text();

		const events: typeof config.events = [];
		const lines = text.split('\n');
		let currentEvent: any = null;

		for (const line of lines) {
			if (line.startsWith('BEGIN:VEVENT')) {
				currentEvent = {};
			} else if (line.startsWith('END:VEVENT') && currentEvent) {
				if (currentEvent.date && currentEvent.title) {
					events.push({
						date: currentEvent.date,
						title: currentEvent.title,
						allDay: true
					});
				}
				currentEvent = null;
			} else if (currentEvent) {
				if (line.startsWith('DTSTART')) {
					const match = line.match(/(\d{4})(\d{2})(\d{2})/);
					if (match) {
						currentEvent.date = `${match[1]}-${match[2]}-${match[3]}`;
					}
				} else if (line.startsWith('SUMMARY:')) {
					currentEvent.title = line.substring(8).trim();
				}
			}
		}

		config.events = [...config.events, ...events];
		alert(`Imported ${events.length} events`);
	}
</script>

<div class="grid">
	<!-- Configuration Panel -->
	<div class="config-panel">
		<div class="accordion">
			<!-- General Settings -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('general')}>
					<span>General Settings</span>
					<span>{openSections.general ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.general}>
					<div class="form-group">
						<label class="form-label" for="device-select">Device</label>
						<select id="device-select" bind:value={config.device}>
							<optgroup label="Digital Note-Taking Devices">
								{#each einkDevices as [id, device]}
									<option value={id}>{device.name}</option>
								{/each}
							</optgroup>
							<optgroup label="iPad / Tablet Apps">
								{#each tabletDevices as [id, device]}
									<option value={id}>{device.name}</option>
								{/each}
							</optgroup>
							<optgroup label="Print">
								{#each printDevices as [id, device]}
									<option value={id}>{device.name}</option>
								{/each}
							</optgroup>
						</select>
						<p class="form-hint">{DEVICES[config.device]?.description}</p>
					</div>

					{#if config.device === 'custom'}
						<div class="row">
							<div class="col form-group">
								<label class="form-label" for="custom-width">Width (px)</label>
								<input id="custom-width" type="number" bind:value={config.customWidth} />
							</div>
							<div class="col form-group">
								<label class="form-label" for="custom-height">Height (px)</label>
								<input id="custom-height" type="number" bind:value={config.customHeight} />
							</div>
							<div class="col form-group">
								<label class="form-label" for="custom-dpi">DPI</label>
								<input id="custom-dpi" type="number" bind:value={config.customDpi} />
							</div>
						</div>
					{/if}

					<div class="row">
						<div class="col form-group">
							<label class="form-label" for="year-input">Year</label>
							<input id="year-input" type="number" bind:value={config.year} min="2024" max="2030" />
						</div>
						<div class="col form-group">
							<label class="form-label" for="start-month">Start Month</label>
							<select id="start-month" bind:value={config.startMonth}>
								<option value={0}>January</option>
								<option value={1}>February</option>
								<option value={2}>March</option>
								<option value={3}>April</option>
								<option value={4}>May</option>
								<option value={5}>June</option>
								<option value={6}>July</option>
								<option value={7}>August</option>
								<option value={8}>September</option>
								<option value={9}>October</option>
								<option value={10}>November</option>
								<option value={11}>December</option>
							</select>
						</div>
						<div class="col form-group">
							<label class="form-label" for="week-start">Week Start</label>
							<select id="week-start" bind:value={config.weekStart}>
								<option value="monday">Monday</option>
								<option value="sunday">Sunday</option>
							</select>
						</div>
					</div>

					<div class="row">
						<div class="col form-group">
							<label class="form-label" for="orientation">Orientation</label>
							<select id="orientation" bind:value={config.orientation}>
								<option value="portrait">Portrait</option>
								<option value="landscape">Landscape</option>
							</select>
						</div>
						<div class="col form-group">
							<label class="form-label" for="toolbarPosition">Toolbar Position</label>
							<select id="toolbarPosition" bind:value={config.toolbarPosition}>
								<option value="none">None</option>
								<option value="left">Left</option>
								<option value="right">Right</option>
								<option value="top">Top</option>
								<option value="bottom">Bottom</option>
							</select>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="date-format">Date Format</label>
						<select id="date-format" bind:value={config.dateFormat}>
							<option value="long">January 15</option>
							<option value="medium">Jan 15</option>
							<option value="short">1/15</option>
							<option value="numeric">15</option>
							<option value="long-intl">15 January</option>
							<option value="medium-intl">15 Jan</option>
							<option value="short-intl">15/1</option>
						</select>
					</div>

					<hr style="margin: 1rem 0; border-color: var(--border-color);" />

					<div class="form-group">
						<label class="form-check">
							<input type="checkbox" bind:checked={config.holidays.enabled} />
							<span>Show public holidays</span>
						</label>
					</div>

					{#if config.holidays.enabled}
						<div class="row">
							<div class="col form-group">
								<label class="form-label" for="holiday-country">Country</label>
								<select id="holiday-country" bind:value={config.holidays.country} on:change={handleCountryChange}>
									{#each Object.entries(COUNTRIES) as [code, name]}
										<option value={code}>{name}</option>
									{/each}
								</select>
							</div>
							{#if showStatesDropdown}
								<div class="col form-group">
									<label class="form-label" for="holiday-state">State/Region</label>
									<select id="holiday-state" bind:value={config.holidays.state}>
										{#each Object.entries(availableStates) as [code, name]}
											<option value={code}>{name}</option>
										{/each}
									</select>
								</div>
							{/if}
						</div>
					{/if}

					<div class="form-group mt-2">
						<label class="form-label" for="ical-import">Import Calendar Events</label>
						<input id="ical-import" type="file" accept=".ics,.ical" on:change={handleImportICal} />
						<p class="form-hint">Import .ics for specific events (year-specific)</p>
					</div>
				</div>
			</div>

			<!-- Page Selection -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('pages')}>
					<span>Page Selection</span>
					<span>{openSections.pages ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.pages}>
					<p class="text-muted mb-2">Select which sections to include in your planner:</p>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableCover} />
						Cover Page
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableIndex} />
						Index Pages
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableGuide} />
						Guide & Symbol Legend
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableIntention} />
						Intention Page
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableGoals} />
						Goals Page
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableFutureLog} />
						Future Log (2 pages)
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableMonthlyPages} />
						Monthly Pages (Timeline + Action Plan)
					</label>
					{#if config.enableMonthlyPages}
						<label class="checkbox-label" style="margin-left: 1.5rem;">
							<input type="checkbox" bind:checked={config.monthlyReflectionEnabled} />
							Include Monthly Reflection Pages
						</label>
					{/if}

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableWeeklyPages} />
						Weekly Pages (Action Plan)
					</label>
					{#if config.enableWeeklyPages}
						<label class="checkbox-label" style="margin-left: 1.5rem;">
							<input type="checkbox" bind:checked={config.weeklyReflectionEnabled} />
							Include Weekly Reflection Pages
						</label>
					{/if}

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableDailyPages} />
						Daily Pages (365 pages)
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableHabitTracker} />
						Monthly Habit Tracker
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableCollections} />
						Collections Section
					</label>
				</div>
			</div>

			<!-- Navigation Links -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('navigation')}>
					<span>Navigation Links</span>
					<span>{openSections.navigation ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.navigation}>
					<p class="form-hint mb-1">Configure which navigation links appear in page headers.</p>

					<div class="form-group">
						<p class="form-label">Reference/Yearly Pages</p>
						<p class="form-hint mb-1">Index, Guide, Intention, Goals, Future Log, Collections</p>
						{#each config.navigationLinks.filter(l => REFERENCE_NAV_IDS.includes(l.id)) as link}
							{@const pageEnabled =
								link.id === 'guide' ? config.enableGuide :
								link.id === 'index' ? config.enableIndex :
								link.id === 'future-log' ? config.enableFutureLog :
								link.id === 'intention' ? config.enableIntention :
								link.id === 'goals' ? config.enableGoals :
								link.id === 'collections' ? config.enableCollections :
								true
							}
							<label class="checkbox-label" class:disabled={!pageEnabled}>
								<input type="checkbox" bind:checked={link.enabled} disabled={!pageEnabled} />
								{link.label}
							</label>
						{/each}
					</div>

					<div class="form-group">
						<p class="form-label">Calendar Pages</p>
						<p class="form-hint mb-1">Monthly, Weekly, Daily, Habit Tracker (defaults: Idx, Mo, Hab, Wk, Col)</p>
						{#each config.navigationLinks as link}
							{@const pageEnabled =
								link.id === 'guide' ? config.enableGuide :
								link.id === 'index' ? config.enableIndex :
								link.id === 'monthly' ? config.enableMonthlyPages :
								link.id === 'weekly' ? config.enableWeeklyPages :
								link.id === 'future-log' ? config.enableFutureLog :
								link.id === 'intention' ? config.enableIntention :
								link.id === 'goals' ? config.enableGoals :
								link.id === 'habits' ? config.enableHabitTracker :
								link.id === 'collections' ? config.enableCollections :
								true
							}
							<label class="checkbox-label" class:disabled={!pageEnabled}>
								<input type="checkbox" bind:checked={link.enabledOnCalendar} disabled={!pageEnabled} />
								{link.label}
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- Monthly Habit Tracker -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('habits')}>
					<span>Monthly Habits ({config.habits.length})</span>
					<span>{openSections.habits ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.habits}>
					<p class="text-muted mb-2">Define habits to track (leave blank for write-in):</p>

					{#each config.habits as habit, i}
						<div class="list-item">
							<span class="text-muted">{i + 1}.</span>
							<input type="text" bind:value={habit.name} placeholder="Habit name..." />
							<button class="btn-remove" on:click={() => removeHabit(habit.id)}>x</button>
						</div>
					{/each}

					<button class="btn btn-secondary mt-2" on:click={addHabit}>+ Add Habit</button>
				</div>
			</div>

			<!-- Collections -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('collections')}>
					<span>Collections ({config.collections.length})</span>
					<span>{openSections.collections ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.collections}>
					<p class="text-muted mb-2">Pre-defined collections (generated with pages):</p>

					{#each config.collections as collection}
						<div class="card mb-1" style="padding: 12px;">
							<div class="row">
								<div class="col">
									<input type="text" bind:value={collection.name} placeholder="Collection name" />
								</div>
								<div style="width: 80px;">
									<input type="number" bind:value={collection.pages} min="1" max="50" />
								</div>
								<button class="btn-remove" on:click={() => removeCollection(collection.id)}>x</button>
							</div>
							<div class="row mt-1">
								<select bind:value={collection.template} style="width: auto;">
									<option value="dotgrid">Dot Grid</option>
									<option value="lined">Lined</option>
									<option value="grid">Grid</option>
									<option value="checklist">Checklist</option>
									<option value="blank">Blank</option>
								</select>
							</div>
						</div>
					{/each}

					<button class="btn btn-secondary mt-2" on:click={addCollection}>+ Add Collection</button>

					<div class="form-group mt-3">
						<label class="form-label" for="writein-slots">Write-in Collection Slots</label>
						<input id="writein-slots" type="number" bind:value={config.writeInCollectionSlots} min="0" max="50" />
						<p class="form-hint">Blank slots on the collection index for adding collections on-device</p>
					</div>

					<div class="form-group mt-2">
						<label class="form-label" for="writein-pages">Pages per Write-in Collection</label>
						<input id="writein-pages" type="number" bind:value={config.writeInCollectionPages} min="1" max="20" />
					</div>
				</div>
			</div>

			<!-- Visual Settings -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('visual')}>
					<span>Visual Settings</span>
					<span>{openSections.visual ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.visual}>
					<div class="form-group">
						<label class="form-label" for="dot-style">Page Background</label>
						<select id="dot-style" bind:value={config.dotStyle}>
							<option value="dots">Dot Grid (bullet journal style)</option>
							<option value="grid">Square Grid (graph paper)</option>
							<option value="lines">Ruled Lines (notebook)</option>
							<option value="blank">Blank (no background)</option>
						</select>
					</div>

					<div class="row">
						<div class="col form-group">
							<label class="form-label" for="dot-spacing">Dot Spacing (mm)</label>
							<input id="dot-spacing" type="number" bind:value={config.dotSpacing} min="3" max="10" step="0.5" />
						</div>
						<div class="col form-group">
							<label class="form-label" for="dot-size">Dot Size (px)</label>
							<input id="dot-size" type="number" bind:value={config.dotSize} min="0.5" max="3" step="0.5" />
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="dot-opacity">Dot Opacity</label>
						<input id="dot-opacity" type="range" bind:value={config.dotOpacity} min="0.1" max="1" step="0.1" />
						<span class="text-muted">{Math.round(config.dotOpacity * 100)}%</span>
					</div>

					<div class="row">
						<div class="col form-group">
							<label class="form-label" for="font-family">Font</label>
							<select id="font-family" bind:value={config.fontFamily}>
								<option value="helvetica">Helvetica (Modern)</option>
								<option value="times">Times (Classic)</option>
								<option value="courier">Courier (Typewriter)</option>
							</select>
						</div>
						<div class="col form-group">
							<label class="form-label" for="font-size">Font Size</label>
							<input id="font-size" type="number" bind:value={config.fontSize} min="8" max="16" />
						</div>
					</div>

					<hr style="margin: 1rem 0; border-color: var(--border-color);" />

					<div class="row">
						<div class="col form-group">
							<label class="form-label" for="text-color">Text Color</label>
							<input id="text-color" type="color" bind:value={config.textColor} style="width: 100%; height: 2rem;" />
						</div>
						<div class="col form-group">
							<label class="form-label" for="line-color">Line/Dot Color</label>
							<input id="line-color" type="color" bind:value={config.lineColor} style="width: 100%; height: 2rem;" />
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="line-opacity">Line/Dot Opacity</label>
						<input id="line-opacity" type="range" bind:value={config.lineOpacity} min="0.1" max="1" step="0.1" />
						<span class="text-muted">{Math.round(config.lineOpacity * 100)}%</span>
					</div>
				</div>
			</div>
		</div>

		<div class="card mt-2">
			<div class="row">
				<button class="btn btn-secondary" on:click={handleExportConfig}>Export Config</button>
				<label class="btn btn-secondary">
					Import Config
					<input type="file" accept=".json,.pdf" on:change={handleImportConfig} style="display:none" />
				</label>
			</div>
			<p class="form-hint mt-1">Your settings are embedded in generated RapidInk PDFs. Import a PDF or JSON to restore your configuration.</p>
		</div>

		<!-- Generation Buttons -->
		<div class="mt-2">
			<button
				class="btn btn-generate btn-lg"
				style="width: 100%;"
				on:click={handleGenerate}
				disabled={generating}
			>
				{generating ? 'Generating...' : 'Generate Sample (1 Month Preview)'}
			</button>

			<button
				class="btn btn-generate btn-lg mt-1"
				style="width: 100%;"
				on:click={handleGenerateFull}
				disabled={generating || !pdfUrl}
			>
				Generate Full Year PDF
			</button>
			<p class="form-hint text-center mt-1">
				Full year generation may take 1-2 minutes.
			</p>

			<p class="form-hint text-center mt-1">
				<strong>100% client-side</strong> — nothing is logged or sent to any server.
			</p>

			{#if userMessage}
				<div class="user-message {userMessage.type} mt-1">
					<span>{userMessage.text}</span>
					<button class="dismiss-btn" on:click={() => userMessage = null}>&times;</button>
				</div>
			{/if}
		</div>

		{#if progress}
			<div class="progress-container">
				<div class="progress-bar">
					<div
						class="progress-fill"
						style="width: {(progress.current / progress.total) * 100}%"
					></div>
				</div>
				<p class="progress-text">{progress.message}</p>
			</div>
		{/if}
	</div>

	<!-- Preview Panel -->
	<div class="preview-container">
		<div class="preview-frame">
			{#if pdfUrl}
				<embed src={pdfUrl} type="application/pdf" />
			{:else}
				<div class="preview-placeholder">
					<p>PDF preview will appear here</p>
					<p class="text-muted">Click "Generate Sample" to create a quick preview</p>
				</div>
			{/if}
		</div>

		{#if pdfUrl}
			<button class="btn btn-generate btn-lg mt-2" style="width: 100%;" on:click={handleDownload}>
				Download PDF {isSampleMode ? '(Sample)' : ''}
			</button>
		{/if}
	</div>
</div>

<style>
	.config-panel {
		max-height: calc(100vh - 120px);
		overflow-y: auto;
	}

	.accordion-header {
		width: 100%;
		text-align: left;
		border: none;
		font-size: 14px;
	}

	.user-message {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.dismiss-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0 0.25rem;
		opacity: 0.7;
	}

	.dismiss-btn:hover {
		opacity: 1;
	}
</style>
