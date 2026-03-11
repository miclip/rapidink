const SITE_URL = 'https://rapidink.miclip.io';

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
