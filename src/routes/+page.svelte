<script lang="ts">
	import { DEVICES, getDevicesByCategory } from '$lib/devices';
	import { DEFAULT_CONFIG, type RapidInkConfig, type Habit, type Collection, type NavigationLink } from '$lib/config';
	import type { GeneratorProgress } from '$lib/pdf/generator';

	let config: RapidInkConfig = { ...DEFAULT_CONFIG };
	let generating = false;
	let progress: GeneratorProgress | null = null;
	let pdfUrl: string | null = null;
	let isSampleMode = true; // Default to sample mode for review

	// Track which sections are open
	let openSections: Record<string, boolean> = {
		general: true,
		pages: false,
		daily: false,
		habits: false,
		collections: false,
		visual: false
	};

	const einkDevices = getDevicesByCategory('eink');
	const tabletDevices = getDevicesByCategory('tablet');
	const printDevices = getDevicesByCategory('print');

	function toggleSection(section: string) {
		openSections[section] = !openSections[section];
	}

	async function handleGenerate() {
		generating = true;
		progress = null;
		pdfUrl = null;

		try {
			const { generatePDF } = await import('$lib/pdf/generator');

			// Create config for generation
			let genConfig = { ...config };

			if (isSampleMode) {
				// Sample mode: generate minimal preview
				// - Keep cover, index, guide if enabled
				// - Skip weekly and daily pages (too many)
				// - Keep monthly pages (shows all 12 months as overview)
				// - Keep habit tracker, collections index, a few notes pages
				genConfig = {
					...config,
					enableWeeklyPages: false, // Too many pages for sample
					enableDailyPages: false, // Too many pages for sample
					notesPageCount: Math.min(config.notesPageCount, 3) // Max 3 notes pages in sample
				};
			}

			const pdfBytes = await generatePDF(genConfig, (p) => {
				progress = p;
			});

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
			name: 'New Collection',
			pages: 5,
			template: 'dotgrid'
		}];
	}

	function removeCollection(id: string) {
		config.collections = config.collections.filter(c => c.id !== id);
	}

	async function handleImportConfig(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		if (file.type === 'application/pdf') {
			alert('PDF config import coming soon!');
		} else if (file.type === 'application/json') {
			const text = await file.text();
			try {
				const imported = JSON.parse(text);
				config = { ...DEFAULT_CONFIG, ...imported };
			} catch {
				alert('Invalid config file');
			}
		}
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
							<label class="form-label" for="handedness">Handedness</label>
							<select id="handedness" bind:value={config.handedness}>
								<option value="right">Right-handed</option>
								<option value="left">Left-handed</option>
							</select>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="date-format">Date Format</label>
						<select id="date-format" bind:value={config.dateFormat}>
							<option value="short">1/15</option>
							<option value="medium">Jan 15</option>
							<option value="long">January 15</option>
							<option value="numeric">15</option>
						</select>
					</div>

					<div class="form-group mt-2">
						<label class="form-label" for="ical-import">Import Calendar Events</label>
						<input id="ical-import" type="file" accept=".ics,.ical" on:change={handleImportICal} />
						<p class="form-hint">Import from .ics file to auto-populate events on daily pages</p>
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

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableWeeklyPages} />
						Weekly Pages (Action Plan + Reflection)
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableDailyPages} />
						Daily Pages (365 pages)
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableHabitTracker} />
						Habit Tracker
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableCollections} />
						Collections Section
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.enableNotesPages} />
						Notes Pages
					</label>

					{#if config.enableNotesPages}
						<div class="form-group mt-1">
							<label class="form-label" for="notes-count">Number of Notes Pages</label>
							<input id="notes-count" type="number" bind:value={config.notesPageCount} min="0" max="100" />
						</div>
					{/if}

					<div class="mt-2">
						<p class="form-label">Navigation Links on Daily Pages</p>
						<p class="form-hint mb-1">Select which links appear in the header of each daily page:</p>
						{#each config.navigationLinks as link}
							<label class="checkbox-label">
								<input type="checkbox" bind:checked={link.enabled} />
								{link.label}
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- Daily Page Settings -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('daily')}>
					<span>Daily Page Settings</span>
					<span>{openSections.daily ? '-' : '+'}</span>
				</button>
				<div class="accordion-content" class:open={openSections.daily}>
					<div class="form-group">
						<label class="form-label" for="daily-layout">Daily Page Layout</label>
						<select id="daily-layout" bind:value={config.dailyLayout}>
							<option value="freeform">Freeform (dot grid only)</option>
							<option value="timeblocked">Time-blocked (hourly schedule)</option>
							<option value="split">Split (morning/afternoon/evening)</option>
							<option value="schedule">Schedule (time column + notes)</option>
						</select>
					</div>

					{#if config.dailyLayout === 'timeblocked' || config.dailyLayout === 'schedule'}
						<div class="row">
							<div class="col form-group">
								<label class="form-label" for="time-start">Start Hour</label>
								<select id="time-start" bind:value={config.dailyTimeStart}>
									{#each Array(24) as _, i}
										<option value={i}>{i}:00</option>
									{/each}
								</select>
							</div>
							<div class="col form-group">
								<label class="form-label" for="time-end">End Hour</label>
								<select id="time-end" bind:value={config.dailyTimeEnd}>
									{#each Array(24) as _, i}
										<option value={i}>{i}:00</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="form-group">
							<label class="form-label" for="time-increment">Time Increment</label>
							<select id="time-increment" bind:value={config.dailyTimeIncrement}>
								<option value={30}>30 minutes</option>
								<option value={60}>1 hour</option>
							</select>
						</div>
					{/if}

					<label class="checkbox-label mt-2">
						<input type="checkbox" bind:checked={config.weeklyReflectionEnabled} />
						Include Weekly Reflection Pages
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={config.monthlyReflectionEnabled} />
						Include Monthly Reflection Pages
					</label>
				</div>
			</div>

			<!-- Habits -->
			<div class="accordion-item">
				<button class="accordion-header" on:click={() => toggleSection('habits')}>
					<span>Habits ({config.habits.length})</span>
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
						<label class="form-label" for="dot-style">Dot Style</label>
						<select id="dot-style" bind:value={config.dotStyle}>
							<option value="dots">Dots</option>
							<option value="grid">Grid Lines</option>
							<option value="lines">Horizontal Lines</option>
							<option value="blank">Blank</option>
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

					<div class="form-group">
						<label class="form-label" for="font-size">Font Size</label>
						<input id="font-size" type="number" bind:value={config.fontSize} min="8" max="16" />
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
		</div>

		<!-- Generation Buttons -->
		<div class="mt-2">
			<button
				class="btn btn-primary btn-lg"
				style="width: 100%;"
				on:click={handleGenerate}
				disabled={generating}
			>
				{generating ? 'Generating...' : 'Generate Sample (1 Month Preview)'}
			</button>

			<button
				class="btn btn-secondary mt-1"
				style="width: 100%;"
				on:click={handleGenerateFull}
				disabled={generating}
			>
				Generate Full Year PDF
			</button>

			<p class="form-hint text-center mt-1">
				Sample generates a quick preview without daily pages.<br>
				Full year includes all 365+ daily pages.
			</p>
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
			<button class="btn btn-primary btn-lg mt-2" style="width: 100%;" on:click={handleDownload}>
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
</style>
