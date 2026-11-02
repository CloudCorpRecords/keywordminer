/**
 * keywordminer types.
 *
 * keywordminer talks to the Marketing Miner Profilers API
 * (default base https://profilers-api.marketingminer.com) with
 * the caller's own API token: keyword search volume / CPC /
 * seasonality, keyword suggestions, and website traffic
 * estimates for the cs, sk, pl, hu, ro, gb, and us markets.
 * Every call returns the upstream payload unchanged; the only
 * local work is request shaping and rendering.
 */

/** Response rendering choice shared by every tool. */
export type ResponseFormat = "markdown" | "json";

/** The minimal fetch surface the core needs (injectable for tests). */
export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Resolved client configuration. */
export interface KeywordMinerConfig {
  /** Upstream base URL, no trailing slash. */
  baseUrl: string;
  /** API token, or undefined when no token env var is set. */
  token?: string;
  /** Fetch implementation (defaults to the global fetch). */
  fetchFn?: FetchFn;
}

export interface SearchVolumeArgs {
  lang: string;
  keyword: string;
  response_format?: ResponseFormat;
}

export interface BatchSearchVolumeArgs {
  lang: string;
  keywords: string[];
  response_format?: ResponseFormat;
}

export interface KeywordSuggestionsArgs {
  lang: string;
  keyword: string;
  suggestions_type?: string;
  limit?: number;
  offset?: number;
  response_format?: ResponseFormat;
}

export interface WebsiteStatsArgs {
  lang: string;
  type: string;
  target: string;
  response_format?: ResponseFormat;
}

export interface WebsiteStatsRangeArgs {
  lang: string;
  type: string;
  target: string;
  period?: string;
  competitors?: string[];
  response_format?: ResponseFormat;
}
