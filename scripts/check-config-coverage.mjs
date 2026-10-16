#!/usr/bin/env node
// Compares the drachtio-server configuration settings found in its source code with the
// server documentation (src/docs/server/*.md):
//   - settings in the source that the docs never mention  -> error
//   - environment variables / command-line flags in the docs that the source doesn't have -> error
//
// Usage: node scripts/check-config-coverage.mjs [path-to-drachtio-server]
// (default: upstream/drachtio-server, see AGENTS.md)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.resolve(process.argv[2] || path.join(ROOT, 'upstream', 'drachtio-server'));
const SRC = path.join(SERVER, 'src');
const DOCS = path.join(ROOT, 'src', 'docs', 'server');

if (!fs.existsSync(SRC)) {
  console.error(`${SRC} not found; clone drachtio-server first (see AGENTS.md)`);
  process.exit(1);
}

const read = (f) => fs.readFileSync(f, 'utf8');
const unique = (arr) => [...new Set(arr)].sort();
const matches = (text, re) => [...text.matchAll(re)].map((m) => m[1]);

// ---- settings in the source --------------------------------------------------------------
// test programs (ssltest.cpp, test_*.cpp) have their own options; skip them
const sources = fs.readdirSync(SRC)
  .filter((f) => f.endsWith('.cpp') && !/^(ssltest|test_)/.test(f))
  .map((f) => read(path.join(SRC, f)));
const config = read(path.join(SRC, 'drachtio-config.cpp'));
const controller = read(path.join(SRC, 'controller.cpp'));

const envVars = unique(sources.flatMap((s) => matches(s, /"(DRACHTIO_[A-Z0-9_]+)"/g)));
// the Docker image's entrypoint script reads a few more
const entrypoint = path.join(SERVER, 'entrypoint.sh');
const dockerEnvVars = fs.existsSync(entrypoint) ? unique(matches(read(entrypoint), /\$\{?(DRACHTIO_[A-Z0-9_]+)/g)) : [];
const cliFlags = unique(matches(controller, /\{"([a-z0-9-]+)",\s*(?:no|required|optional)_argument/g));
// XML: absolute paths like "drachtio.sip.tls.cert-file" or "drachtio.admin.<xmlattr>.port",
// plus attributes read relative to an element, like "<xmlattr>.sip-method"
const xmlPaths = unique(matches(config, /"(drachtio\.[A-Za-z0-9_.<>:-]+)"/g));
const xmlElements = unique(xmlPaths.filter((p) => !p.includes('<xmlattr>')).map((p) => p.split('.').pop()));
const xmlAttributes = unique([
  ...xmlPaths.filter((p) => p.includes('<xmlattr>')).map((p) => p.split('.').pop()),
  ...matches(config, /"<xmlattr>\.([A-Za-z0-9_-]+)"/g),
]);

// ---- what the docs mention ----------------------------------------------------------------
const docs = fs.readdirSync(DOCS).filter((f) => f.endsWith('.md'))
  .map((f) => read(path.join(DOCS, f))).join('\n');
const configuring = read(path.join(DOCS, 'configuring.md'));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const problems = {
  'environment variables not documented': envVars.filter((v) => !docs.includes(v)),
  'command-line flags not documented': cliFlags.filter((f) => !new RegExp(`--${esc(f)}\\b`).test(docs)),
  'config file elements not documented': xmlElements.filter((e) =>
    !new RegExp(`<${esc(e)}[\\s>/]|\`${esc(e)}\``).test(docs)),
  'config file attributes not documented': xmlAttributes.filter((a) =>
    !new RegExp(`\\b${esc(a)}=|\`${esc(a)}\``).test(docs)),
  'documented environment variables not in the source': unique(matches(docs, /\b(DRACHTIO_[A-Z0-9_]*[A-Z0-9])\b/g))
    .filter((v) => !envVars.includes(v) && !dockerEnvVars.includes(v)),
  'documented command-line flags not in the source': unique(
    matches(configuring.slice(configuring.indexOf('## command-line arguments')), /`--([a-z0-9-]+)/g))
    .filter((f) => !cliFlags.includes(f)),
};

let failed = false;
for (const [label, items] of Object.entries(problems)) {
  if (items.length) {
    failed = true;
    console.error(`${label}:\n  ${items.join('\n  ')}`);
  }
}
console.log(`checked ${envVars.length} environment variables, ${cliFlags.length} command-line flags, ` +
  `${xmlElements.length} config elements and ${xmlAttributes.length} config attributes ` +
  `from ${path.relative(ROOT, SERVER) || SERVER}`);
if (failed) process.exit(1);
console.log('all settings are documented');
