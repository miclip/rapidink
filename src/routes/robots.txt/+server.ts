import { base } from '$app/paths';

const SITE_URL = 'https://miclip.github.io' + base;

export const prerender = true;

export function GET() {
	const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}
