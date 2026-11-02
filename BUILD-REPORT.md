# keywordminer — Build Report

MCP Rebuild 1000, Batch 11. Rebuild of
`lukaskostka99/marketing-miner-mcp` (rank 603), built from the
firsthand spec at
`~/workspace/mcp-rebuild-100/specs-batch11/marketingminer.md`
(README tools table + worked examples, read firsthand
2026-10-27). Local build only — nothing pushed or published.

Identity: dir `builds/keywordminer`, npm
`@reneturcios/keywordminer`, MCP name
`io.github.CloudCorpRecords/keywordminer`, version `0.1.0`,
bin `keywordminer` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Marketing
  Miner: keyword search volume, suggestions, and website
  traffic estimates.", 83 chars ≤100; npm entry carries
  `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/keywordminer:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/keywordminer"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27)
- `src/index.ts`, `src/cli.ts` (`search-volume <lang>
  <keyword> [--json]`, `mcp`, `--version`; exit 2 usage / 1
  runtime error), `src/mcp.ts`, `src/types.ts`,
  `src/keywordminer.ts` (core, `VERSION = "0.1.0"`)
- `test/keywordminer.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Tools implemented (5)

- `marketing_miner_get_search_volume` — `lang`, `keyword`
  (required); `response_format`. GET `/keywords/search-volume-data`.
- `marketing_miner_batch_search_volume` — `lang`, `keywords`
  (required); `response_format`. POST `/keywords/search-volume-data`.
- `marketing_miner_get_keyword_suggestions` — `lang`,
  `keyword` (required); `suggestions_type`, `limit`,
  `offset`, `response_format`. GET `/keywords/suggestions`.
- `marketing_miner_get_website_stats` — `lang`, `type`,
  `target` (required); `response_format`. GET `/websites/stats`.
- `marketing_miner_get_website_stats_range` — `lang`, `type`,
  `target` (required); `period`, `competitors`,
  `response_format`. GET/POST `/websites/stats-range` (POST
  with a JSON body when competitors are given, GET with query
  parameters otherwise).

Every tool also accepts the optional `response_format` string
enum `[markdown, json]`: `json` returns the API JSON as
structured text; the default markdown renders a readable
summary of the same payload.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals exactly matching the fixture, per the
  standing fleet rule; zod still validates every `tools/call`.
- Upstream base `https://profilers-api.marketingminer.com`,
  overridable with `MARKETING_MINER_API_BASE`. Token from
  `MARKETING_MINER_API_TOKEN` (alternates
  `MARKETING_MINER_API_KEY`, `MARKETING_MINER_TOKEN`,
  `MM_API_TOKEN`, `MM_API_KEY`), sent as a bearer token. With
  no token set, every call fails with an honest error naming
  `MARKETING_MINER_API_TOKEN` before any fetch — no data is
  ever fabricated.
- Fetch is injectable (`KeywordMinerConfig.fetchFn`); all
  tests run against a recording fake fetch with no live
  network.
- Wire parameter names are the argument names themselves
  (query parameters for GET calls, JSON body fields for POST
  calls) — the documented contract from the spec.

## Verification (foreground, firsthand)

- `tsc --noEmit` exit 0; `tsc` build exit 0 (`dist/cli.js`)
- `tsx --test`: **11 tests, 11 pass, 0 fail** — missing-token
  error naming the env var (and zero fetches made), alternate
  token env + base-URL override resolution, GET vs POST
  request shaping for every tool (paths, query params, JSON
  bodies, bearer header), stats-range GET-without / POST-with
  competitors, non-OK upstream error carrying the HTTP status,
  markdown vs json rendering
- `dist/cli.js --version` → `0.1.0`; no-args invocation
  prints usage and exits 2; `search-volume` with no token
  exits 1 with the honest token error
- Parity: `harness/parity.py` vs
  `harness/fixtures/marketing-miner-tools-original.json` →
  **PASS, parity 100.0, identical_tools 5/5**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
with only `package.json`, offline `npm install
--package-lock-only --ignore-scripts --offline`), verified:
parses, name `@reneturcios/keywordminer`, **128 package
entries**. Local `node_modules` is a symlink to the sibling
burnmeter tree; gitignored.

## Gaps / honest notes

- Wire parameter names are the documented contract (argument
  names from the README's worked examples); they are verified
  only against fake fetch in tests. Live behaviour against
  the real Marketing Miner API is unproven — no live call was
  made (program rule, and no token is available in this
  environment).
- The stats-range GET-vs-POST split (POST only when
  competitors are present) is this build's reading of the
  spec's "GET/POST" endpoint notation.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
