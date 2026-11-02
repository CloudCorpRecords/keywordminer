# keywordminer

Keyword and website analytics from the Marketing Miner
Profilers API, packaged as MCP tools: search volume, CPC,
year-over-year change and seasonality for single keywords or
batches of up to 1000, keyword suggestions (questions / new /
trending, paginated), and website traffic estimates with a
historical range and optional competitor comparison. Markets:
`cs`, `sk`, `pl`, `hu`, `ro`, `gb`, `us`.

Every tool takes an optional `response_format`: `markdown`
(the default) renders a readable summary of the API payload;
`json` returns the API JSON as structured text.

## Configuration

The API token comes from the environment:

- `MARKETING_MINER_API_TOKEN` (alternates:
  `MARKETING_MINER_API_KEY`, `MARKETING_MINER_TOKEN`,
  `MM_API_TOKEN`, `MM_API_KEY`)

With no token set, every call returns an honest error naming
`MARKETING_MINER_API_TOKEN` — no data is ever fabricated. The
upstream base defaults to
`https://profilers-api.marketingminer.com` and can be
overridden with `MARKETING_MINER_API_BASE`.

## CLI

```bash
export MARKETING_MINER_API_TOKEN=...
npx @reneturcios/keywordminer search-volume cs "seo nastroje"
npx @reneturcios/keywordminer search-volume us "running shoes" --json
npx @reneturcios/keywordminer --version
```

Exit codes: `0` on success, `1` on a runtime error (including
a missing token or an upstream HTTP error), `2` on a usage
error.

## MCP server

```bash
npx -y @reneturcios/keywordminer mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "keywordminer": {
      "command": "npx",
      "args": ["-y", "@reneturcios/keywordminer", "mcp"],
      "env": { "MARKETING_MINER_API_TOKEN": "..." }
    }
  }
}
```

### Tools

- `marketing_miner_get_search_volume` — search volume for one
  keyword. `lang`, `keyword` (required); `response_format`.
  Upstream: `GET /keywords/search-volume-data`.
- `marketing_miner_batch_search_volume` — search volume for a
  batch. `lang`, `keywords` (required); `response_format`.
  Upstream: `POST /keywords/search-volume-data`.
- `marketing_miner_get_keyword_suggestions` — suggestions for
  a seed keyword. `lang`, `keyword` (required);
  `suggestions_type`, `limit`, `offset`, `response_format`.
  Upstream: `GET /keywords/suggestions`.
- `marketing_miner_get_website_stats` — traffic estimates for
  a target. `lang`, `type`, `target` (required);
  `response_format`. Upstream: `GET /websites/stats`.
- `marketing_miner_get_website_stats_range` — historical
  traffic trend, optionally against competitors. `lang`,
  `type`, `target` (required); `period`, `competitors`,
  `response_format`. Upstream: `GET/POST /websites/stats-range`
  (POST when competitors are given).

## Docker

```bash
docker run -i -e MARKETING_MINER_API_TOKEN=... ghcr.io/cloudcorprecords/keywordminer
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (fake fetch, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
