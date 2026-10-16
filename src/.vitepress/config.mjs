import { defineConfig } from "vitepress";
import sidebar from "./sidebar.json" with { type: "json" };
import versions from "./versions.json" with { type: "json" };
import { slugify } from "./slugify.mjs";

// the site is served from the root of https://drachtio.org; set SITE_BASE to serve it from a sub-path
const base = process.env.SITE_BASE || "/";

export default defineConfig({
  title: "drachtio",
  titleTemplate: ":title | drachtio",
  description:
    "drachtio - the open source SIP application server framework. " +
    "Making SIP server apps as easy to build as web apps.",
  base,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://drachtio.org" },

  head: [
    ["link", { rel: "icon", type: "image/png", href: `${base}favicon.png` }],
  ],

  markdown: {
    anchor: { slugify },
  },

  themeConfig: {
    logo: { light: "/logo.svg", dark: "/logo-dark.svg", alt: "drachtio" },
    siteTitle: false,
    nav: [
      { text: "Docs", link: "/docs/", activeMatch: "^/docs/" },
      { text: "About", link: "/about" },
      {
        text: "Releases",
        items: [
          {
            text: "Latest releases",
            items: [
              {
                text: `drachtio-server (<code>${versions["drachtio-server"]}</code>)`,
                link: `https://github.com/drachtio/drachtio-server/tree/v${versions["drachtio-server"]}`,
              },
              {
                text: `drachtio-srf (<code>${versions["drachtio-srf"]}</code>)`,
                link: `https://www.npmjs.com/package/drachtio-srf/v/${versions["drachtio-srf"]}`,
              },
            ],
          },
          {
            text: "All releases",
            items: [
              {
                text: "drachtio-server",
                link: "https://github.com/drachtio/drachtio-server/tags",
              },
              {
                text: "drachtio-srf",
                link: "https://github.com/drachtio/drachtio-srf/tags",
              },
            ],
          },
        ],
      },
    ],
    // the sidebar is only shown on documentation pages
    sidebar: { "/docs/": sidebar },
    outline: { level: [2, 3] },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/drachtio" }],
    editLink: {
      pattern: "https://github.com/drachtio/drachtio-site/edit/main/src/:path",
    },
    footer: {
      copyright: `© ${new Date().getFullYear()} drachtio`,
    },
  },
});
