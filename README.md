# drachtio.org

The [drachtio.org](https://drachtio.org) website: the home page, the About page, and the documentation for
**drachtio-server** (the SIP server) and **drachtio-srf** (the Node.js framework for drachtio applications).
It is a static site built with [VitePress](https://vitepress.dev).

## Local development

Requires Node.js 20 or later.

```bash
npm install
npm run dev            # development server at http://localhost:5173/
npm run build          # static site in src/.vitepress/dist
npm run preview        # serve the built site
npm test               # build, then check that every internal link and #anchor resolves
npm run check-config   # check that every drachtio-server setting is documented (see AGENTS.md)
```

## Deploying

GitHub Actions builds and link-checks every pull request, and deploys `main` to GitHub Pages. In the
repository settings, set **Pages → Source** to **GitHub Actions**.

The site is built to be served from the root of a domain (drachtio.org). To use a custom domain with
GitHub Pages, add a `src/public/CNAME` file containing the domain and point its DNS at GitHub Pages. To
serve the site from a sub-path instead, build with `SITE_BASE=/sub-path/`.

Old drachtio.org addresses (`/api`, `/docs/developer-guide`, `/docs/drachtio-server`, `/releases`)
forward to their new locations through small redirect pages in `src/public/`.

## Keeping the docs up to date

The docs describe one release of each project, shown at the top of every documentation page and set in
`src/.vitepress/versions.json`. Only the latest release is documented, and there are no release notes;
the Releases menu links to the GitHub tags.

[AGENTS.md](AGENTS.md) describes how to fetch the latest drachtio-server and drachtio-srf code, where
settings and APIs live in it, and how to update the docs after a release.

## Writing

- Pages are Markdown. Links between pages are relative `.md` links (e.g. `../srf/api/srf.md#srf-createuac`).
- Callouts use VitePress containers: `::: info`, `::: tip`, `::: warning`, `::: danger`, `::: details`,
  optionally followed by a title.
- Headings can be given a fixed anchor with `{#my-anchor}`.
- New documentation pages must be added to `src/.vitepress/sidebar.json`.
- Write for the reader: no source file references, version history, implementation internals, or
  deprecated and internal-only APIs. See [AGENTS.md](AGENTS.md) for the full guidelines.

## Structure

```
AGENTS.md                  # how to keep the docs in sync with drachtio releases
CLAUDE.md                  # points Claude Code at AGENTS.md
package.json               # VitePress and scripts
scripts/
├── check-links.mjs        # internal link/anchor checker for the built site
└── check-config-coverage.mjs  # drachtio-server settings vs. src/docs/server
src/
├── .vitepress/
│   ├── config.mjs         # site configuration and top navigation
│   ├── sidebar.json       # documentation sidebar
│   ├── versions.json      # documented drachtio-server / drachtio-srf versions
│   ├── slugify.mjs        # heading anchor algorithm
│   └── theme/             # brand colors, home page code card, "Applies to" version note
├── public/                # logo, images, redirects for old addresses
├── index.md               # home page
├── about.md               # About page
└── docs/
    ├── index.md           # documentation overview
    ├── server/            # drachtio-server: installing, running, configuring, messaging protocol
    └── srf/               # drachtio-srf guides
        └── api/           # drachtio-srf API reference, one page per class
upstream/                  # local clones of drachtio-server and drachtio-srf (git-ignored)
```

## Contributing

1. Fork this repository
2. Create a branch for your changes
3. Submit a pull request
