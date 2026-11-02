/**
 * keywordminer core: Marketing Miner Profilers API client.
 *
 *   getSearchVolume / batchSearchVolume /
 *   getKeywordSuggestions / getWebsiteStats /
 *   getWebsiteStatsRange -> upstream payload, rendered
 *
 * Endpoints (documented contract):
 *   GET  /keywords/search-volume-data   single keyword
 *   POST /keywords/search-volume-data   batch of keywords
 *   GET  /keywords/suggestions
 *   GET  /websites/stats
 *   GET/POST /websites/stats-range      (POST when competitors
 *                                        are given, GET otherwise)
 *
 * The token comes from MARKETING_MINER_API_TOKEN (alternates:
 * MARKETING_MINER_API_KEY, MARKETING_MINER_TOKEN, MM_API_TOKEN,
 * MM_API_KEY). With no token set, every call fails with an
 * honest error naming MARKETING_MINER_API_TOKEN — this client
 * never fabricates analytics data. The base URL can be
 * overridden with MARKETING_MINER_API_BASE. Fetch is injectable
 * so tests run with no live network.
 */
import type {
  BatchSearchVolumeArgs,
  FetchFn,
  KeywordMinerConfig,
  KeywordSuggestionsArgs,
  ResponseFormat,
  SearchVolumeArgs,
  WebsiteStatsArgs,
  WebsiteStatsRangeArgs,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://profilers-api.marketingminer.com";

export const TOKEN_ENV_NAMES = [
  "MARKETING_MINER_API_TOKEN",
  "MARKETING_MINER_API_KEY",
  "MARKETING_MINER_TOKEN",
  "MM_API_TOKEN",
  "MM_API_KEY",
] as const;

/** Build a config from an environment map (defaults to process.env). */
export function configFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchFn?: FetchFn,
): KeywordMinerConfig {
  let token: string | undefined;
  for (const name of TOKEN_ENV_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.length > 0) {
      token = value;
      break;
    }
  }
  const base = env.MARKETING_MINER_API_BASE;
  return {
    baseUrl: (base && base.length > 0 ? base : DEFAULT_BASE_URL).replace(/\/+$/, ""),
    token,
    fetchFn,
  };
}

function requireToken(config: KeywordMinerConfig): string {
  if (!config.token) {
    throw new Error(
      "MARKETING_MINER_API_TOKEN is not set: keywordminer needs a Marketing Miner API token " +
        `(set MARKETING_MINER_API_TOKEN, or one of ${TOKEN_ENV_NAMES.slice(1).join(", ")})`,
    );
  }
  return config.token;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
}

async function callApi(
  config: KeywordMinerConfig,
  method: "GET" | "POST",
  path: string,
  query: Record<string, string | number | undefined>,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const token = requireToken(config);
  const fetchFn: FetchFn = config.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetchFn(buildUrl(config.baseUrl, path, query), init);
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 200 ? `${text.slice(0, 200)}...` : text;
    throw new Error(
      `Marketing Miner API request failed (HTTP ${res.status}) for ${method} ${path}: ${snippet}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Render any payload value as indented markdown lines. */
function renderValue(value: unknown, indent: string, lines: string[]): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}(empty)`);
      return;
    }
    value.forEach((item, i) => {
      if (typeof item === "object" && item !== null) {
        lines.push(`${indent}- item ${i + 1}:`);
        renderValue(item, `${indent}  `, lines);
      } else {
        lines.push(`${indent}- ${String(item)}`);
      }
    });
    return;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      lines.push(`${indent}(empty)`);
      return;
    }
    for (const [key, raw] of entries) {
      if (typeof raw === "object" && raw !== null) {
        lines.push(`${indent}- ${key}:`);
        renderValue(raw, `${indent}  `, lines);
      } else {
        lines.push(`${indent}- ${key}: ${String(raw)}`);
      }
    }
    return;
  }
  lines.push(`${indent}${String(value)}`);
}

/**
 * Render an upstream payload: the raw API JSON as structured
 * text for "json", or a readable markdown summary of the same
 * payload by default.
 */
export function renderPayload(
  payload: unknown,
  format: ResponseFormat | undefined,
  title: string,
): string {
  if (format === "json") {
    return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  }
  const lines = [`# ${title}`, ""];
  renderValue(payload, "", lines);
  return lines.join("\n");
}

/** GET /keywords/search-volume-data for one keyword. */
export async function getSearchVolume(
  config: KeywordMinerConfig,
  args: SearchVolumeArgs,
): Promise<string> {
  const payload = await callApi(config, "GET", "/keywords/search-volume-data", {
    lang: args.lang,
    keyword: args.keyword,
  });
  return renderPayload(payload, args.response_format, `Search volume: ${args.keyword} (${args.lang})`);
}

/** POST /keywords/search-volume-data for a batch of keywords. */
export async function batchSearchVolume(
  config: KeywordMinerConfig,
  args: BatchSearchVolumeArgs,
): Promise<string> {
  const payload = await callApi(config, "POST", "/keywords/search-volume-data", {}, {
    lang: args.lang,
    keywords: args.keywords,
  });
  return renderPayload(
    payload,
    args.response_format,
    `Search volume batch: ${args.keywords.length} keywords (${args.lang})`,
  );
}

/** GET /keywords/suggestions for a seed keyword. */
export async function getKeywordSuggestions(
  config: KeywordMinerConfig,
  args: KeywordSuggestionsArgs,
): Promise<string> {
  const payload = await callApi(config, "GET", "/keywords/suggestions", {
    lang: args.lang,
    keyword: args.keyword,
    suggestions_type: args.suggestions_type,
    limit: args.limit,
    offset: args.offset,
  });
  return renderPayload(payload, args.response_format, `Keyword suggestions: ${args.keyword} (${args.lang})`);
}

/** GET /websites/stats for one target. */
export async function getWebsiteStats(
  config: KeywordMinerConfig,
  args: WebsiteStatsArgs,
): Promise<string> {
  const payload = await callApi(config, "GET", "/websites/stats", {
    lang: args.lang,
    type: args.type,
    target: args.target,
  });
  return renderPayload(payload, args.response_format, `Website stats: ${args.target} (${args.lang})`);
}

/**
 * /websites/stats-range for one target: POST with a JSON body
 * when competitors are given, GET with query parameters
 * otherwise.
 */
export async function getWebsiteStatsRange(
  config: KeywordMinerConfig,
  args: WebsiteStatsRangeArgs,
): Promise<string> {
  const hasCompetitors = Array.isArray(args.competitors) && args.competitors.length > 0;
  const payload = hasCompetitors
    ? await callApi(config, "POST", "/websites/stats-range", {}, {
        lang: args.lang,
        type: args.type,
        target: args.target,
        period: args.period,
        competitors: args.competitors,
      })
    : await callApi(config, "GET", "/websites/stats-range", {
        lang: args.lang,
        type: args.type,
        target: args.target,
        period: args.period,
      });
  return renderPayload(payload, args.response_format, `Website stats range: ${args.target} (${args.lang})`);
}
