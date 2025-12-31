<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="error-container">
	<h1>{$page.status}</h1>
	<p>{$page.error?.message || 'An error occurred'}</p>
	<pre>{JSON.stringify($page.error, null, 2)}</pre>
</div>

<style>
	.error-container {
		padding: 2rem;
		text-align: center;
	}
	pre {
		text-align: left;
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		max-width: 600px;
		margin: 1rem auto;
	}
</style>
