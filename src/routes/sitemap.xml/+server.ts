import { base } from '$app/paths';

const SITE_URL = 'https://miclip.github.io' + base;

const pages = ['', '/docs'];

export const prerender = true;

export function GET() {
	const urls = pages
		.map(
			(page) => `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <changefreq>weekly</changefreq>
  </url>`
		)
		.join('');

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

	return new Response(sitemap.trim(), {
		headers: {
			'Content-Type': 'application/xml'
		}
	});
}
