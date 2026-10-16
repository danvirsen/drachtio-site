# AGENTS.md

This repository is the drachtio.org website, built with VitePress: a home page, an About page, and the
documentation for **drachtio-server** (a SIP server, C++) and **drachtio-srf** (the Node.js framework for
writing drachtio applications) under `src/docs/`.

The docs describe one release of each project: the versions in `src/.vitepress/versions.json`.
The main recurring task is bringing the docs up to date with a new release: picking up new,
changed or removed configuration settings and API changes. This file describes where to get the
code, where each kind of information lives in it, and how to update the docs.

## Commands

```bash
npm install
npm run dev            # local server at http://localhost:5173/
npm test               # build the site and check every internal link and #anchor
npm run check-config   # compare drachtio-server's settings in upstream/ with src/docs/server/
```

`npm test` must pass before you finish.

## Getting the latest drachtio code

Both projects are on GitHub. The default branch is `main`. Releases are git tags `vX.Y.Z`;
GitHub Releases are not used. drachtio-srf is published to npm, and every drachtio-server tag
produces a Docker image `drachtio/drachtio-server:X.Y.Z`.

| Project | Repository | Published as |
|---|---|---|
| drachtio-server | https://github.com/drachtio/drachtio-server | Docker Hub `drachtio/drachtio-server` |
| drachtio-srf | https://github.com/drachtio/drachtio-srf | npm `drachtio-srf` |

Clone them into `upstream/` (git-ignored). Submodules are only needed to build the server, so don't
clone recursively.

```bash
# first time
mkdir -p upstream
git clone https://github.com/drachtio/drachtio-server.git upstream/drachtio-server
git clone https://github.com/drachtio/drachtio-srf.git upstream/drachtio-srf

# afterwards
for r in drachtio-server drachtio-srf; do
  git -C upstream/$r checkout main && git -C upstream/$r pull --ff-only && git -C upstream/$r fetch --tags
done
```

Find the latest releases and compare them with `src/.vitepress/versions.json`:

```bash
for r in drachtio-server drachtio-srf; do
  echo "$r: $(git -C upstream/$r tag | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"
done
npm view drachtio-srf version     # should match the drachtio-srf tag
cat src/.vitepress/versions.json
```

Document **released** code. Check out the release tag before you read or check anything
(`git -C upstream/drachtio-server checkout --detach v0.9.12`), and switch back to `main` when done.
If you also document something that is only on `main`, mark it with
`<Badge type="info" text="next release" />` (see "Writing" below).

See what changed between the documented release and the new one:

```bash
git -C upstream/drachtio-server log --no-merges --oneline v0.9.11..v0.9.12
git -C upstream/drachtio-server diff v0.9.11..v0.9.12 --stat
git -C upstream/drachtio-srf diff v5.0.29..v5.0.30 -- lib
```

Commit subjects follow conventional commits (`feat:`, `fix:`). `feat` commits and anything that adds
or renames options, events or defaults need doc changes; most `fix` commits don't, unless they change
documented behaviour or fix one of the known issues listed below.

## Where things live

The source code is the authority. Don't rely on these, which are known to be out of date or wrong:
drachtio-server's sample `drachtio.conf.xml` and `docs/messages.md`; drachtio-srf's JSDoc comments
and examples in `lib/*.js` (for example, they show the wrong `createB2BUA()` argument order),
`lib/@types/index.d.ts`, and the `examples/` folder.

### drachtio-server → `src/docs/server/`

| What | Source (in `upstream/drachtio-server`) | Documented in |
|---|---|---|
| Config file elements and attributes | `src/drachtio-config.cpp`: property-tree paths such as `"drachtio.sip.tls.cert-file"`, attributes as `<xmlattr>.port` | `configuring.md`, "drachtio.conf.xml" |
| Command-line flags | `src/controller.cpp`: the `long_options` table and the `switch` that handles them | `configuring.md`, "command-line arguments" |
| Environment variables | `getenv("DRACHTIO_...")` in `src/controller.cpp`, `src/drachtio.cpp`, `src/sip-dialog-controller.cpp` | `configuring.md`, "Environment variables" and "Transport tuning" |
| Docker image (entrypoint variables such as `CLOUD`, `DRACHTIO_SIP_PORT`; default config) | `entrypoint.sh`, `Dockerfile`, `docker.drachtio.conf.xml` | `installing.md`, `running.md` |
| Building from source | `Dockerfile`, `configure.ac`, `Makefile.am`, `.github/workflows/ci.yml` | `installing.md` |
| Signals, daemon mode, systemd | `src/controller.cpp`, `drachtio.service` | `running.md` |
| Application protocol (messages between server and apps) | `src/client.cpp`, `src/client-controller.cpp`; the client side is drachtio-srf's `lib/wire-protocol.js` and `lib/drachtio-agent.js` | `messaging-protocol.md` |
| Call detail records | `src/cdr.hpp`, `src/cdr.cpp`, `src/sip-dialog-controller.cpp` | `../srf/call-detail-records.md`, `messaging-protocol.md` |
| Prometheus metrics | `docs/prometheus.md`, `src/stats-collector.cpp` | `configuring.md`, "monitoring section" |

`npm run check-config` reads the first three rows and reports settings that exist in the source but
not in the docs, and environment variables or flags that the docs mention but the source no longer has.
It checks names only; read the code to check defaults and behaviour.

### drachtio-srf → `src/docs/srf/`

| What | Source (in `upstream/drachtio-srf`) | Documented in |
|---|---|---|
| Version, supported Node.js versions | `package.json` (`version`, `engines`) | `../index.md` (the docs overview), `introduction.md` |
| `Srf` class: request handlers, `createUAS/UAC/B2BUA`, `proxyRequest`, `request`, events | `lib/srf.js` | `api/srf.md`, `sip-dialogs.md`, `sip-proxy.md` |
| `connect()` / `listen()` options, reconnects, pings, TLS | `lib/wire-protocol.js`, `lib/drachtio-agent.js` | `api/srf.md`, `advanced-topics.md`, `introduction.md` |
| Middleware and routing | `lib/proto.js`, `lib/connect.js` | `middleware.md`, `api/srf.md` |
| `Dialog` | `lib/dialog.js` | `api/dialog.md`, `sip-dialogs.md` |
| `Request`, `Response` | `lib/request.js`, `lib/response.js` | `api/request.md`, `api/response.md`, `sip-messages.md` |
| Headers and parsing (`SipMessage`, `getParsedHeader`, `parseUri`) | `lib/sip-parser/message.js`, `lib/sip-parser/parser.js` | `api/sipmessage.md`, `sip-messages.md` |
| `SipError` | `lib/sip_error.js` | `api/siperror.md` |
| Digest authentication for `createUAC()` | `lib/digest-client.js` | `api/srf.md` (`opts.auth`) |

`test/` is useful for confirming how something behaves.

## Updating the docs for a new release

1. Update the clones and find the latest tags (above). If they match `versions.json`, there is
   nothing to do.
2. Read `git log` between the documented and the new tag and note every change that affects
   settings, the API or documented behaviour.
3. **Server settings:** check out the new server tag and run `npm run check-config`. Document new
   settings in every place they belong (config file section, command-line list, environment
   variable table), remove settings that are gone, and check defaults that changed in the diff.
4. **API:** go through `git diff <old>..<new> -- lib` in drachtio-srf. Update the API page for each
   new or changed method, option, event or property, and the guide pages that cover the same
   topic. Remove what no longer exists.
5. **Known issues:** for each item in the list below, check whether the new release fixes it. If so,
   remove or rewrite the warning.
6. Update `src/.vitepress/versions.json`. Remove the `next release` badges from anything that is now
   released (`grep -rn "next release" src`).
7. Run `npm test` and `npm run check-config`. Both must pass.
8. Switch the clones back to `main`.

## Writing

The readers are developers using drachtio, not maintainers checking the docs.

- **No provenance or history.** No source file names or line numbers, "taken from the source",
  comparisons with older docs, JSDoc or type definitions, "Added in version …", "as of release …" or
  "in the current version …". The version note at the top of each page already says what the docs cover.
- **Only what readers should use.** Don't document deprecated or legacy forms, removed features,
  compatibility shims, or internal methods that the library calls itself. Leave out implementation
  details the reader can't act on.
- **Known bugs** that affect users get a short `::: warning` with the observable behaviour and a
  workaround. Don't explain the cause.
- Friendly and direct, second person ("you"), short sentences. Match the surrounding page.
- No release notes on this site. The Releases menu links to the GitHub tags.

Markdown:

- Callouts are VitePress containers: `::: info`, `::: tip`, `::: warning`, `::: danger`, `::: details`,
  optionally followed by a title, and closed with `:::`.
- Links between pages are relative `.md` links with anchors, e.g. `../srf/api/srf.md#srf-createuac`.
- Anchors come from the heading text. Before changing a heading that other pages may link to, keep
  its old anchor with `{#old-anchor}`. `npm test` reports broken links and anchors.
- New documentation pages must be added to `src/.vitepress/sidebar.json`.
- Behaviour that is only on `main`: `<Badge type="info" text="next release" />` after the heading or
  sentence.

API pages (`src/docs/srf/api/`), one per class:

- `#` class name with `{#<class>}`; `##` groups such as "Creating dialogs", "Properties", "Events".
- `###` per method or event, with a short title and a fixed anchor: `### createUAC() {#srf-createuac}`,
  `### 'destroy' {#dialog-event-destroy}`. Anchors are `<class>-<member>` and
  `<class>-event-<name>`, lower case.
- Directly below, a `js` code block with the full signature, using `srf.`, `dialog.`, `req.`, `res.`
  or `msg.`: `srf.createUAC(uri, opts, [progressCallbacks], [callback])`, or for events
  `dialog.on('destroy', (req, [reason]) => {})`. Optional arguments are in square brackets.
- Then the description, a `| Name | Type | Description |` parameter table, and what it returns
  (Promise, callback, or both).
- Properties are table rows with an anchor: `<span id="dialog-onhold"></span>`.

## Known upstream issues documented as warnings

When a release fixes one of these, update the page and remove the item from this list. Paths are
relative to `src/docs/`.

| Issue | Documented in |
|---|---|
| `remove_route` removes all of the client's registrations, not just the named method | `server/messaging-protocol.md` |
| The ACK/BYE race is reported with the termination reason `system-initiated-termination` | `srf/call-detail-records.md` |
| Spammer `action` and `tcp-action` attributes have no effect; matches always get a 603 | `server/configuring.md` (spammers) |
| `udp-mtu`, `--mtu` and `DRACHTIO_UDP_MTU` have no effect | `server/configuring.md` (udp-mtu, command-line, environment) |
| `redis-password` in the config file is ignored; the CLI/environment setting works | `server/configuring.md` (blacklist) |
| Log file `minSize` is not honored | `server/configuring.md` (log file) |
| `--user-agent-options-auto-respond` doesn't take a value on the command line | `server/configuring.md` |
| Automatic reconnects use plain TCP even after a TLS `connect()` | `srf/advanced-topics.md`, `srf/api/srf.md` |
| `dialog.info()` and the other per-method shortcuts throw | `srf/api/dialog.md` |
| `dialog.modify('unhold')` leaves `dialog.onHold` set to `true` | `srf/api/dialog.md` |

## Don't

- Don't edit anything under `upstream/`; it is a read-only reference.
- Don't add release notes or old-version docs; only the release in `versions.json` is documented.
