import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  batchSearchVolume,
  configFromEnv,
  getKeywordSuggestions,
  getSearchVolume,
  getWebsiteStats,
  getWebsiteStatsRange,
} from "../src/keywordminer.js";
import type { FetchFn, KeywordMinerConfig } from "../src/types.js";

/**
 * All tests run against an injected fake fetch: no live network.
 * The fake records each request (URL + init) and returns a fixed
 * JSON payload, so request shaping (GET vs POST, query vs body)
 * and both renderings are asserted exactly.
 */

interface RecordedCall {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

const PAYLOAD = {
  keyword: "seo nastroje",
  search_volume: 1900,
  cpc: 12.5,
  yoy: 0.12,
};

function fakeFetch(payload: unknown = PAYLOAD): { fetchFn: FetchFn; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    };
  };
  return { fetchFn, calls };
}

function config(fetchFn: FetchFn): KeywordMinerConfig {
  return { baseUrl: "https://example.test/api", token: "test-token", fetchFn };
}

describe("missing token", () => {
  it("fails honestly, naming MARKETING_MINER_API_TOKEN, before any fetch", async () => {
    const { fetchFn, calls } = fakeFetch();
    const cfg: KeywordMinerConfig = { baseUrl: "https://example.test/api", fetchFn };
    await assert.rejects(
      () => getSearchVolume(cfg, { lang: "cs", keyword: "seo" }),
      /MARKETING_MINER_API_TOKEN is not set/,
    );
    assert.equal(calls.length, 0);
  });

  it("configFromEnv picks up an alternate token env name", () => {
    const cfg = configFromEnv({ MM_API_KEY: "alt-token" });
    assert.equal(cfg.token, "alt-token");
    assert.equal(cfg.baseUrl, "https://profilers-api.marketingminer.com");
  });

  it("configFromEnv honours the MARKETING_MINER_API_BASE override", () => {
    const cfg = configFromEnv({
      MARKETING_MINER_API_TOKEN: "t",
      MARKETING_MINER_API_BASE: "https://proxy.test/mm/",
    });
    assert.equal(cfg.baseUrl, "https://proxy.test/mm");
  });
});

describe("request shaping", () => {
  it("get_search_volume issues a GET with lang+keyword query and a bearer token", async () => {
    const { fetchFn, calls } = fakeFetch();
    await getSearchVolume(config(fetchFn), { lang: "cs", keyword: "seo nastroje" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].body, undefined);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/api/keywords/search-volume-data");
    assert.equal(url.searchParams.get("lang"), "cs");
    assert.equal(url.searchParams.get("keyword"), "seo nastroje");
    assert.equal(calls[0].headers?.Authorization, "Bearer test-token");
  });

  it("batch_search_volume issues a POST with a JSON body", async () => {
    const { fetchFn, calls } = fakeFetch();
    await batchSearchVolume(config(fetchFn), { lang: "us", keywords: ["a", "b"] });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].headers?.["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].body ?? "{}"), { lang: "us", keywords: ["a", "b"] });
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/api/keywords/search-volume-data");
    assert.equal(url.search, "");
  });

  it("keyword_suggestions GETs with optional params, omitting unset ones", async () => {
    const { fetchFn, calls } = fakeFetch();
    await getKeywordSuggestions(config(fetchFn), {
      lang: "gb",
      keyword: "shoes",
      suggestions_type: "questions",
      limit: 10,
      offset: 20,
    });
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/api/keywords/suggestions");
    assert.equal(url.searchParams.get("suggestions_type"), "questions");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("offset"), "20");

    const second = fakeFetch();
    await getKeywordSuggestions(config(second.fetchFn), { lang: "gb", keyword: "shoes" });
    const url2 = new URL(second.calls[0].url);
    assert.equal(url2.searchParams.has("suggestions_type"), false);
    assert.equal(url2.searchParams.has("limit"), false);
    assert.equal(url2.searchParams.has("offset"), false);
  });

  it("website_stats GETs /websites/stats with lang, type, target", async () => {
    const { fetchFn, calls } = fakeFetch();
    await getWebsiteStats(config(fetchFn), { lang: "cs", type: "domain", target: "seznam.cz" });
    const url = new URL(calls[0].url);
    assert.equal(calls[0].method, "GET");
    assert.equal(url.pathname, "/api/websites/stats");
    assert.equal(url.searchParams.get("type"), "domain");
    assert.equal(url.searchParams.get("target"), "seznam.cz");
  });

  it("website_stats_range GETs without competitors and POSTs with them", async () => {
    const plain = fakeFetch();
    await getWebsiteStatsRange(config(plain.fetchFn), {
      lang: "cs",
      type: "domain",
      target: "seznam.cz",
      period: "monthly",
    });
    assert.equal(plain.calls[0].method, "GET");
    const url = new URL(plain.calls[0].url);
    assert.equal(url.pathname, "/api/websites/stats-range");
    assert.equal(url.searchParams.get("period"), "monthly");

    const withRivals = fakeFetch();
    await getWebsiteStatsRange(config(withRivals.fetchFn), {
      lang: "cs",
      type: "domain",
      target: "seznam.cz",
      competitors: ["idnes.cz"],
    });
    assert.equal(withRivals.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(withRivals.calls[0].body ?? "{}"), {
      lang: "cs",
      type: "domain",
      target: "seznam.cz",
      competitors: ["idnes.cz"],
    });
  });

  it("a non-OK upstream response is an error carrying the HTTP status", async () => {
    const failing: FetchFn = async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    await assert.rejects(
      () => getWebsiteStats(config(failing), { lang: "cs", type: "domain", target: "x.cz" }),
      /HTTP 401/,
    );
  });
});

describe("rendering", () => {
  it("markdown (default) renders a readable summary of the payload", async () => {
    const { fetchFn } = fakeFetch();
    const out = await getSearchVolume(config(fetchFn), { lang: "cs", keyword: "seo nastroje" });
    assert.match(out, /^# Search volume: seo nastroje \(cs\)/);
    assert.match(out, /- search_volume: 1900/);
    assert.match(out, /- cpc: 12\.5/);
  });

  it("json returns the API JSON as structured text", async () => {
    const { fetchFn } = fakeFetch();
    const out = await getSearchVolume(config(fetchFn), {
      lang: "cs",
      keyword: "seo nastroje",
      response_format: "json",
    });
    assert.deepEqual(JSON.parse(out), PAYLOAD);
  });
});
