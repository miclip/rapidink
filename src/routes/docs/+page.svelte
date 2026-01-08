<script lang="ts">
	let activeSection = 'getting-started';

	const sections = [
		{ id: 'getting-started', label: 'Getting Started' },
		{ id: 'devices', label: 'Device Presets' },
		{ id: 'pages', label: 'Page Options' },
		{ id: 'monthly', label: 'Monthly Pages' },
		{ id: 'weekly', label: 'Weekly Pages' },
		{ id: 'daily', label: 'Daily Pages' },
		{ id: 'habits', label: 'Habit Tracker' },
		{ id: 'custom-codes', label: 'Custom Codes' },
		{ id: 'collections', label: 'Collections' },
		{ id: 'visual', label: 'Visual Settings' },
		{ id: 'template-upgrade', label: 'Template Upgrade' },
		{ id: 'notes-preservation', label: 'Notes Preservation' },
	];

	function scrollToSection(id: string) {
		activeSection = id;
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' });
		}
	}
</script>

<svelte:head>
	<title>Documentation - RapidInk</title>
</svelte:head>

<div class="docs-layout">
	<nav class="docs-nav">
		<div class="nav-header">
			<a href="/" class="back-link">← Back to Generator</a>
		</div>
		<ul>
			{#each sections as section}
				<li>
					<button
						class:active={activeSection === section.id}
						on:click={() => scrollToSection(section.id)}
					>
						{section.label}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<main class="docs-content">
		<h1>RapidInk Documentation</h1>
		<p class="intro">
			RapidInk is a customizable bullet journal PDF generator optimized for e-ink devices.
			This guide covers all features and workflows.
		</p>

		<section id="getting-started">
			<h2>Getting Started</h2>
			<p>
				RapidInk runs entirely in your browser - no account or server required. Your settings
				are embedded in the generated PDF, so you can import it later to restore your configuration.
			</p>
			<h3>Basic Workflow</h3>
			<ol>
				<li><strong>Select your device</strong> - Choose a preset or enter custom dimensions</li>
				<li><strong>Configure your journal</strong> - Enable/disable sections, set preferences</li>
				<li><strong>Generate PDF</strong> - Click "Generate PDF" and wait for processing</li>
				<li><strong>Transfer to device</strong> - Upload via USB, cloud sync, or email</li>
			</ol>
			<h3>Importing Previous Settings</h3>
			<p>
				If you have a previously generated RapidInk PDF, click "Import Template" to restore
				your settings. This also enables handwriting preservation if the PDF contains annotations.
			</p>
		</section>

		<section id="devices">
			<h2>Device Presets</h2>
			<p>
				RapidInk includes optimized presets for popular e-ink devices. Each preset configures
				the page dimensions and toolbar position for optimal use.
			</p>
			<h3>Supported Devices</h3>
			<table>
				<thead>
					<tr>
						<th>Device</th>
						<th>Dimensions</th>
						<th>Notes</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>reMarkable Paper Pro</td>
						<td>1620 × 2160 px</td>
						<td>Left toolbar, optimized contrast</td>
					</tr>
					<tr>
						<td>reMarkable 2</td>
						<td>1404 × 1872 px</td>
						<td>Left toolbar</td>
					</tr>
					<tr>
						<td>Supernote A5X</td>
						<td>1404 × 1872 px</td>
						<td>Right toolbar</td>
					</tr>
					<tr>
						<td>Kindle Scribe</td>
						<td>1860 × 2480 px</td>
						<td>Right toolbar</td>
					</tr>
					<tr>
						<td>iPad (GoodNotes)</td>
						<td>Various</td>
						<td>Standard PDF dimensions</td>
					</tr>
				</tbody>
			</table>
			<h3>Custom Dimensions</h3>
			<p>
				Select "Custom" to enter your own page dimensions. Useful for print or unsupported devices.
			</p>
		</section>

		<section id="pages">
			<h2>Page Options</h2>
			<p>Enable or disable sections to customize your journal structure.</p>
			<h3>Available Sections</h3>
			<dl>
				<dt>Cover Page</dt>
				<dd>A title page with the year. Good for visual organization.</dd>

				<dt>Index</dt>
				<dd>Table of contents with links to all sections. Essential for navigation.</dd>

				<dt>Guide Page</dt>
				<dd>Quick reference for bullet journal notation and symbols.</dd>

				<dt>Intention Page</dt>
				<dd>Set your yearly theme, word, or intention.</dd>

				<dt>Goals Page</dt>
				<dd>Track yearly goals and objectives.</dd>

				<dt>Future Log</dt>
				<dd>Quarterly overview for long-term planning. 4 pages covering the full year.</dd>
			</dl>
		</section>

		<section id="monthly">
			<h2>Monthly Pages</h2>
			<p>Each month includes two page types:</p>
			<h3>Monthly Timeline</h3>
			<p>
				A vertical list of all days in the month with space for events and tasks.
				Holidays are automatically included based on your country/region selection.
				Custom codes appear inline with their scheduled days.
			</p>
			<h3>Monthly Notes</h3>
			<p>
				A blank page (with your chosen background pattern) for monthly reflection,
				goals, or overflow notes.
			</p>
			<h3>Holiday Configuration</h3>
			<p>
				Select your country to automatically include national holidays on the timeline.
				Some countries support state/region selection for local holidays.
			</p>
		</section>

		<section id="weekly">
			<h2>Weekly Pages</h2>
			<p>
				Weekly spreads show all 7 days with space for tasks and events.
				Each day links to its daily page for quick navigation.
			</p>
			<h3>Layout Options</h3>
			<ul>
				<li><strong>Week starts on</strong> - Monday or Sunday</li>
				<li><strong>Include custom codes</strong> - Scheduled codes appear in rapid log format</li>
			</ul>
		</section>

		<section id="daily">
			<h2>Daily Pages</h2>
			<p>
				Individual pages for each day with the date header and your chosen background pattern.
				Custom codes scheduled for the day appear at the top.
			</p>
			<h3>Navigation</h3>
			<p>
				Daily pages include links back to the weekly spread and monthly timeline for easy navigation.
			</p>
		</section>

		<section id="habits">
			<h2>Habit Tracker</h2>
			<p>
				A monthly grid for tracking habits. Each row is a habit, each column is a day.
				Tap to mark habits as complete.
			</p>
			<h3>Configuring Habits</h3>
			<ol>
				<li>Enable "Habit Tracker" in Page Options</li>
				<li>Open the Habits section in the accordion</li>
				<li>Add, remove, or rename habits as needed</li>
				<li>Drag to reorder habits</li>
			</ol>
			<p>
				Default habits include Exercise, Water, Reading, Sleep, and Meditation.
				Customize to match your tracking needs.
			</p>
		</section>

		<section id="custom-codes">
			<h2>Custom Codes</h2>
			<p>
				Define short codes for recurring events or tasks that auto-populate on your calendar.
				Perfect for garbage day, appointments, or any repeating item.
			</p>
			<h3>Creating a Custom Code</h3>
			<ol>
				<li>Open the Custom Codes section</li>
				<li>Click "Add Code"</li>
				<li>Enter a short code (1-4 characters, e.g., "G" for Garbage)</li>
				<li>Add a description</li>
				<li>Choose Task (bullet point) or Event (circle)</li>
				<li>Set frequency (Weekly or Biweekly)</li>
				<li>Pick a start date to anchor the schedule</li>
				<li>Set span days (1 for single day, more for multi-day events)</li>
			</ol>
			<h3>Where Codes Appear</h3>
			<ul>
				<li><strong>Monthly Timeline</strong> - Codes appear inline after the day, with a key at the bottom</li>
				<li><strong>Weekly Pages</strong> - Codes appear in rapid log format with date links</li>
				<li><strong>Daily Pages</strong> - Codes appear as bullet items at the top</li>
			</ul>
			<h3>Example: Biweekly Garbage Collection</h3>
			<p>
				Code: <code>G</code>, Description: "Garbage", Frequency: Biweekly,
				Start Date: First pickup day, Span: 1 day
			</p>
		</section>

		<section id="collections">
			<h2>Collections</h2>
			<p>
				Collections are custom sections for lists, notes, or any content that doesn't fit
				the daily/weekly/monthly structure. Classic bullet journal collections include
				book lists, project notes, and brainstorms.
			</p>
			<h3>Creating Collections</h3>
			<ol>
				<li>Enable "Collections" in Page Options</li>
				<li>Open the Collections section</li>
				<li>Click "Add Collection"</li>
				<li>Name your collection and set page count</li>
				<li>Choose a template (dots, lines, grid, checklist, or blank)</li>
			</ol>
			<h3>PDF Template Import</h3>
			<p>
				You can import a PDF as a collection template. Click the upload icon next to
				the template dropdown and select a PDF. The first page will be used as the
				background for all pages in that collection.
			</p>
			<h3>Collection Index</h3>
			<p>
				When collections are enabled, a Collection Index page is added with links to
				each collection. Write-in slots let you add collections by hand later.
			</p>
		</section>

		<section id="visual">
			<h2>Visual Settings</h2>
			<p>Customize the appearance of your journal.</p>
			<h3>Page Background</h3>
			<ul>
				<li><strong>Dot Grid</strong> - Classic bullet journal style</li>
				<li><strong>Square Grid</strong> - Graph paper for diagrams</li>
				<li><strong>Ruled Lines</strong> - Traditional notebook</li>
				<li><strong>Blank</strong> - No background pattern</li>
			</ul>
			<h3>Spacing and Size</h3>
			<ul>
				<li><strong>Dot Spacing</strong> - Distance between dots/lines in mm</li>
				<li><strong>Dot Size</strong> - Size of dots in pixels</li>
				<li><strong>Dot Opacity</strong> - Visibility of background pattern</li>
			</ul>
			<h3>Typography</h3>
			<ul>
				<li><strong>Font</strong> - Helvetica, Times, or Courier</li>
				<li><strong>Font Size</strong> - Base text size</li>
				<li><strong>Text Color</strong> - Color for headings and labels</li>
				<li><strong>Line Color</strong> - Color for dots, lines, and borders</li>
			</ul>
		</section>

		<section id="template-upgrade">
			<h2>Template Upgrade</h2>
			<p>
				When you've been using a RapidInk journal and want to make changes (new year,
				different settings), you can preserve your handwriting while regenerating the template.
			</p>
			<h3>How It Works</h3>
			<ol>
				<li>Export your annotated PDF from your e-ink device</li>
				<li>Click "Import Template" and select the PDF</li>
				<li>RapidInk extracts your settings and detects handwriting</li>
				<li>Adjust settings as needed (year, new sections, etc.)</li>
				<li>Generate the new PDF</li>
				<li>Handwriting is placed on matching pages (same dates, same collections)</li>
			</ol>
			<h3>Limitations</h3>
			<ul>
				<li>Handwriting becomes static (can't be selected/erased on device)</li>
				<li>Only pages with matching anchors get handwriting transferred</li>
				<li>If you remove a page type, that handwriting is lost</li>
			</ul>
			<p>
				For editable handwriting preservation, see <a href="#notes-preservation">Notes Preservation</a>.
			</p>
		</section>

		<section id="notes-preservation">
			<h2>Notes Preservation (Advanced)</h2>
			<p>
				This advanced feature preserves your handwriting as <strong>editable strokes</strong>
				by working directly with your reMarkable's native file format. Unlike template upgrade,
				your handwriting remains selectable and erasable.
			</p>

			<div class="warning-box">
				<strong>Requirements:</strong>
				<ul>
					<li>reMarkable with Developer Mode enabled (requires factory reset)</li>
					<li>SSH access to your device</li>
					<li>Basic command line familiarity</li>
				</ul>
			</div>

			<h3>Enabling Developer Mode</h3>
			<ol>
				<li>Ensure all documents are synced to reMarkable Cloud</li>
				<li>On device: Settings → General → Paper Tablet → Software → Advanced → Developer Mode</li>
				<li>Device will factory reset and restart</li>
				<li>Log back in - your documents sync from cloud</li>
				<li>Find your SSH password: Settings → General → Paper Tablet → About → Copyrights → GPLv3</li>
			</ol>

			<h3>Finding Your Document</h3>
			<p>Documents are stored in <code>/home/root/.local/share/remarkable/xochitl/</code></p>
			<p>Each document is a folder named with a UUID. To find yours:</p>
			<pre><code>ssh root@10.11.99.1  # Connect via USB
grep -r "Your Document Name" /home/root/.local/share/remarkable/xochitl/*.metadata</code></pre>

			<h3>Notes Preservation Workflow</h3>
			<ol>
				<li>
					<strong>Download from device:</strong>
					<pre><code>scp -r root@10.11.99.1:/home/root/.local/share/remarkable/xochitl/YOUR-UUID ./my-journal</code></pre>
				</li>
				<li>
					<strong>ZIP the folder:</strong>
					<pre><code>zip -r my-journal.zip my-journal/</code></pre>
				</li>
				<li><strong>Upload to RapidInk</strong> - Use the Notes Preservation wizard</li>
				<li><strong>Configure your new template</strong> - Adjust year, settings, etc.</li>
				<li><strong>Download the result ZIP</strong></li>
				<li>
					<strong>Upload to device:</strong>
					<pre><code>unzip result.zip
scp -r NEW-UUID root@10.11.99.1:/home/root/.local/share/remarkable/xochitl/</code></pre>
				</li>
				<li>
					<strong>Restart the UI:</strong>
					<pre><code>ssh root@10.11.99.1 systemctl restart xochitl</code></pre>
				</li>
			</ol>

			<h3>Alternative Tools</h3>
			<p>
				If you prefer a GUI, <a href="https://github.com/bordaigorl/remy" target="_blank" rel="noopener">ReMy</a>
				provides graphical file browsing over SSH.
			</p>
		</section>
	</main>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 220px 1fr;
		min-height: 100vh;
		max-width: 1200px;
		margin: 0 auto;
	}

	.docs-nav {
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
		padding: 1rem;
		border-right: 1px solid var(--border-color, #e0e0e0);
		background: var(--bg-subtle, #f5f5f5);
	}

	.nav-header {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color, #e0e0e0);
	}

	.back-link {
		color: var(--link-color, #0066cc);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.docs-nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.docs-nav li {
		margin: 0.25rem 0;
	}

	.docs-nav button {
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.9rem;
		color: var(--text-color, #333);
	}

	.docs-nav button:hover {
		background: var(--bg-hover, #e8e8e8);
	}

	.docs-nav button.active {
		background: var(--primary-color, #0066cc);
		color: white;
	}

	.docs-content {
		padding: 2rem 3rem;
		max-width: 800px;
	}

	.docs-content h1 {
		margin-top: 0;
		font-size: 2rem;
	}

	.intro {
		font-size: 1.1rem;
		color: var(--text-muted, #666);
		margin-bottom: 2rem;
	}

	section {
		margin-bottom: 3rem;
		scroll-margin-top: 1rem;
	}

	h2 {
		font-size: 1.5rem;
		margin-top: 0;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--primary-color, #0066cc);
	}

	h3 {
		font-size: 1.1rem;
		margin-top: 1.5rem;
	}

	dl {
		margin: 1rem 0;
	}

	dt {
		font-weight: 600;
		margin-top: 1rem;
	}

	dd {
		margin-left: 0;
		color: var(--text-muted, #666);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
	}

	th, td {
		padding: 0.5rem;
		text-align: left;
		border-bottom: 1px solid var(--border-color, #e0e0e0);
	}

	th {
		background: var(--bg-subtle, #f5f5f5);
	}

	pre {
		background: var(--bg-subtle, #f5f5f5);
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
	}

	code {
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	p code {
		background: var(--bg-subtle, #f5f5f5);
		padding: 0.1em 0.3em;
		border-radius: 3px;
	}

	.warning-box {
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		padding: 1rem;
		margin: 1rem 0;
	}

	.warning-box ul {
		margin: 0.5rem 0 0 0;
		padding-left: 1.5rem;
	}

	@media (max-width: 768px) {
		.docs-layout {
			grid-template-columns: 1fr;
		}

		.docs-nav {
			position: relative;
			height: auto;
			border-right: none;
			border-bottom: 1px solid var(--border-color, #e0e0e0);
		}

		.docs-nav ul {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.docs-content {
			padding: 1rem;
		}
	}
</style>
