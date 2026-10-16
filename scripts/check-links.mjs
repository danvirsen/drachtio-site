#!/usr/bin/env node
// Checks every internal link in the built site (src/.vitepress/dist): the target page must
// exist and, if the link has a #fragment, the page must contain an element with that id.
// VitePress itself only reports links to missing pages, not to missing anchors.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DIST = process.env.DOCS_DIST ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', '.vitepress', 'dist');
const BASE = process.env.SITE_BASE || '/';

if (!fs.existsSync(DIST)) {
  console.error(`${DIST} not found; run "npm run build" first`);
  process.exit(1);
}

const pages = new Map(); // url path (without base) -> {ids, links}
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      const html = fs.readFileSync(full, 'utf8');
      const rel = path.relative(DIST, full).split(path.sep).join('/');
      const url = rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
      // only the page content (doc pages and the home page), not the navigation bar,
      // sidebar or footer; redirect pages have no content area and are skipped
      const start = html.indexOf('id="VPContent"');
      const end = html.indexOf('class="VPFooter"');
      const main = start < 0 ? '' : html.slice(start, end < 0 ? html.length : end);
      pages.set(url, {
        ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
        links: [...main.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')),
      });
    }
  }
})(DIST);

const errors = [];
for (const [url, {links}] of pages) {
  for (const href of links) {
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) continue; // external
    const [target, frag] = href.split('#');
    let targetUrl;
    if (target === '') targetUrl = url;
    else if (target.startsWith(BASE)) targetUrl = target.slice(BASE.length);
    else if (target.startsWith('/')) { errors.push(`${url}: link outside base: ${href}`); continue; }
    else {
      // relative links resolve against the page's directory (an index page *is* its directory)
      const dir = url === '' || url.endsWith('/') ? `/${url}` : path.posix.dirname(`/${url}`);
      targetUrl = path.posix.normalize(path.posix.join(dir, target)).slice(1);
    }
    targetUrl = targetUrl.replace(/\.html$/, '');
    if (/\.(png|svg|jpg|ico|txt|json|xml)$/.test(targetUrl)) continue;
    const page = pages.get(targetUrl) ?? pages.get(targetUrl.replace(/\/$/, '')) ?? pages.get(`${targetUrl}/`);
    if (!page) errors.push(`${url || '/'}: missing page: ${href}`);
    else if (frag && !page.ids.has(decodeURIComponent(frag))) errors.push(`${url || '/'}: missing anchor: ${href}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} broken link(s)`);
  process.exit(1);
}
console.log(`checked ${pages.size} pages: all internal links and anchors resolve`);
