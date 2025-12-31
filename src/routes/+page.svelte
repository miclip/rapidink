<script lang="ts">
	import { DEVICES, getDevicesByCategory } from '$lib/devices';
	import { DEFAULT_CONFIG, type RapidInkConfig, type Habit, type Collection, type NavigationLink } from '$lib/config';
	import type { GeneratorProgress } from '$lib/pdf/generator';

	let config: RapidInkConfig = { ...DEFAULT_CONFIG };
	let generating = false;
	let progress: GeneratorProgress | null = null;
	let pdfUrl: string | null = null;
	let activeTab = 'general';

	const einkDevices = getDevicesByCategory('eink');
	const tabletDevices = getDevicesByCategory('tablet');
	const printDevices = getDevicesByCategory('print');

	async function handleGenerate() {
		generating = true;
		progress = null;
		pdfUrl = null;

		try {
			// Dynamic import to avoid blocking page load
			const { generatePDF } = await import('$lib/pdf/generator');
			const pdfBytes = await generatePDF(config, (p) => {
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
		a.download = `rapidink-${config.year}.pdf`;
		a.click();
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
			// TODO: Extract config from PDF using pdf-lib
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

		// Basic iCal parsing - in production use ical.js library
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
		<div class="card">
			<div class="tabs">
				<button class="tab" class:active={activeTab === 'general'} on:click={() => activeTab = 'general'}>General</button>
				<button class="tab" class:active={activeTab === 'pages'} on:click={() => activeTab = 'pages'}>Pages</button>
				<button class="tab" class:active={activeTab === 'daily'} on:click={() => activeTab = 'daily'}>Daily</button>
				<button class="tab" class:active={activeTab === 'habits'} on:click={() => activeTab = 'habits'}>Habits</button>
				<button class="tab" class:active={activeTab === 'collections'} on:click={() => activeTab = 'collections'}>Collections</button>
				<button class="tab" class:active={activeTab === 'visual'} on:click={() => activeTab = 'visual'}>Visual</button>
			</div>

			{#if activeTab === 'general'}
				<div class="tab-content">
					<div class="form-group">
						<label class="form-label">Device</label>
						<select bind:value={config.device}>
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
								<label class="form-label">Width (px)</label>
								<input type="number" bind:value={config.customWidth} />
							</div>
							<div class="col form-group">
								<label class="form-label">Height (px)</label>
								<input type="number" bind:value={config.customHeight} />
							</div>
							<div class="col form-group">
								<label class="form-label">DPI</label>
								<input type="number" bind:value={config.customDpi} />
							</div>
						</div>
					{/if}

					<div class="row">
						<div class="col form-group">
							<label class="form-label">Year</label>
							<input type="number" bind:value={config.year} min="2024" max="2030" />
						</div>
						<div class="col form-group">
							<label class="form-label">Week Start</label>
							<select bind:value={config.weekStart}>
								<option value="monday">Monday</option>
								<option value="sunday">Sunday</option>
							</select>
						</div>
					</div>

					<div class="row">
						<div class="col form-group">
							<label class="form-label">Orientation</label>
							<select bind:value={config.orientation}>
								<option value="portrait">Portrait</option>
								<option value="landscape">Landscape</option>
							</select>
						</div>
						<div class="col form-group">
							<label class="form-label">Handedness</label>
							<select bind:value={config.handedness}>
								<option value="right">Right-handed</option>
								<option value="left">Left-handed</option>
							</select>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">Date Format</label>
						<select bind:value={config.dateFormat}>
							<option value="short">1/15</option>
							<option value="medium">Jan 15</option>
							<option value="long">January 15</option>
							<option value="numeric">15</option>
						</select>
					</div>

					<div class="form-group mt-2">
						<label class="form-label">Import Calendar Events</label>
						<input type="file" accept=".ics,.ical" on:change={handleImportICal} />
						<p class="form-hint">Import from .ics file to auto-populate events on daily pages</p>
					</div>
				</div>
			{/if}

			{#if activeTab === 'pages'}
				<div class="tab-content">
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
							<label class="form-label">Number of Notes Pages</label>
							<input type="number" bind:value={config.notesPageCount} min="0" max="100" />
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
			{/if}

			{#if activeTab === 'daily'}
				<div class="tab-content">
					<div class="form-group">
						<label class="form-label">Daily Page Layout</label>
						<select bind:value={config.dailyLayout}>
							<option value="freeform">Freeform (dot grid only)</option>
							<option value="timeblocked">Time-blocked (hourly schedule)</option>
							<option value="split">Split (morning/afternoon/evening)</option>
							<option value="schedule">Schedule (time column + notes)</option>
						</select>
					</div>

					{#if config.dailyLayout === 'timeblocked' || config.dailyLayout === 'schedule'}
						<div class="row">
							<div class="col form-group">
								<label class="form-label">Start Hour</label>
								<select bind:value={config.dailyTimeStart}>
									{#each Array(24) as _, i}
										<option value={i}>{i}:00</option>
									{/each}
								</select>
							</div>
							<div class="col form-group">
								<label class="form-label">End Hour</label>
								<select bind:value={config.dailyTimeEnd}>
									{#each Array(24) as _, i}
										<option value={i}>{i}:00</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="form-group">
							<label class="form-label">Time Increment</label>
							<select bind:value={config.dailyTimeIncrement}>
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
			{/if}

			{#if activeTab === 'habits'}
				<div class="tab-content">
					<p class="text-muted mb-2">Define habits to track (leave blank for write-in):</p>

					{#each config.habits as habit, i}
						<div class="list-item">
							<span class="text-muted">{i + 1}.</span>
							<input type="text" bind:value={habit.name} placeholder="Habit name..." />
							<button class="btn-remove" on:click={() => removeHabit(habit.id)}>×</button>
						</div>
					{/each}

					<button class="btn btn-secondary mt-2" on:click={addHabit}>+ Add Habit</button>
				</div>
			{/if}

			{#if activeTab === 'collections'}
				<div class="tab-content">
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
								<button class="btn-remove" on:click={() => removeCollection(collection.id)}>×</button>
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
						<label class="form-label">Write-in Collection Slots</label>
						<input type="number" bind:value={config.writeInCollectionSlots} min="0" max="50" />
						<p class="form-hint">Blank slots on the collection index for adding collections on-device</p>
					</div>
				</div>
			{/if}

			{#if activeTab === 'visual'}
				<div class="tab-content">
					<div class="form-group">
						<label class="form-label">Dot Style</label>
						<select bind:value={config.dotStyle}>
							<option value="dots">Dots</option>
							<option value="grid">Grid Lines</option>
							<option value="lines">Horizontal Lines</option>
							<option value="blank">Blank</option>
						</select>
					</div>

					<div class="row">
						<div class="col form-group">
							<label class="form-label">Dot Spacing (mm)</label>
							<input type="number" bind:value={config.dotSpacing} min="3" max="10" step="0.5" />
						</div>
						<div class="col form-group">
							<label class="form-label">Dot Size (px)</label>
							<input type="number" bind:value={config.dotSize} min="0.5" max="3" step="0.5" />
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">Dot Opacity</label>
						<input type="range" bind:value={config.dotOpacity} min="0.1" max="1" step="0.1" />
						<span class="text-muted">{Math.round(config.dotOpacity * 100)}%</span>
					</div>

					<div class="form-group">
						<label class="form-label">Font Size</label>
						<input type="number" bind:value={config.fontSize} min="8" max="16" />
					</div>
				</div>
			{/if}
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

		<button
			class="btn btn-primary btn-lg mt-2"
			style="width: 100%;"
			on:click={handleGenerate}
			disabled={generating}
		>
			{generating ? 'Generating...' : 'Generate PDF'}
		</button>

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
					<p class="text-muted">Click "Generate PDF" to create your planner</p>
				</div>
			{/if}
		</div>

		{#if pdfUrl}
			<button class="btn btn-primary btn-lg mt-2" style="width: 100%;" on:click={handleDownload}>
				Download PDF
			</button>
		{/if}
	</div>
</div>

<style>
	.config-panel {
		max-height: calc(100vh - 120px);
		overflow-y: auto;
	}

	.tab-content {
		padding-top: 8px;
	}
</style>
