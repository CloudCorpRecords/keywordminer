/**
 * keywordminer MCP server. Tools:
 * marketing_miner_get_search_volume,
 * marketing_miner_batch_search_volume,
 * marketing_miner_get_keyword_suggestions,
 * marketing_miner_get_website_stats,
 * marketing_miner_get_website_stats_range.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod
 * still validates every tools/call argument set.
 *
 * Every call goes to the Marketing Miner Profilers API with the
 * caller's token from MARKETING_MINER_API_TOKEN (alternates
 * documented in the core). No token means an honest error,
 * never fabricated data.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  batchSearchVolume,
  configFromEnv,
  getKeywordSuggestions,
  getSearchVolume,
  getWebsiteStats,
  getWebsiteStatsRange,
  VERSION,
} from "./keywordminer.js";

const ResponseFormat = z.enum(["markdown", "json"]).optional();

const SearchVolumeArgs = z.object({
  lang: z.string(),
  keyword: z.string(),
  response_format: ResponseFormat,
});

const BatchSearchVolumeArgs = z.object({
  lang: z.string(),
  keywords: z.array(z.string()),
  response_format: ResponseFormat,
});

const KeywordSuggestionsArgs = z.object({
  lang: z.string(),
  keyword: z.string(),
  suggestions_type: z.string().optional(),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
  response_format: ResponseFormat,
});

const WebsiteStatsArgs = z.object({
  lang: z.string(),
  type: z.string(),
  target: z.string(),
  response_format: ResponseFormat,
});

const WebsiteStatsRangeArgs = z.object({
  lang: z.string(),
  type: z.string(),
  target: z.string(),
  period: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  response_format: ResponseFormat,
});

const LANG_PROPERTY = {
  type: "string",
  description: "Market/language code, e.g. \"cs\", \"sk\", \"pl\", \"hu\", \"ro\", \"gb\", or \"us\"",
} as const;

const RESPONSE_FORMAT_PROPERTY = {
  type: "string",
  enum: ["markdown", "json"],
  description: "Response format: \"markdown\" (default, human-readable) or \"json\"",
} as const;

const TOOLS = [
  {
    name: "marketing_miner_get_search_volume",
    description:
      "Get search volume, CPC, year-over-year change, and seasonality for a single keyword from the Marketing Miner Profilers API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lang: LANG_PROPERTY,
        keyword: { type: "string", description: "The keyword to look up" },
        response_format: RESPONSE_FORMAT_PROPERTY,
      },
      required: ["lang", "keyword"],
    },
  },
  {
    name: "marketing_miner_batch_search_volume",
    description:
      "Get search volume, CPC, year-over-year change, and seasonality for a batch of keywords (1-1000) from the Marketing Miner Profilers API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lang: LANG_PROPERTY,
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "The keywords to look up, as an array of strings",
        },
        response_format: RESPONSE_FORMAT_PROPERTY,
      },
      required: ["lang", "keywords"],
    },
  },
  {
    name: "marketing_miner_get_keyword_suggestions",
    description:
      "Get keyword suggestions for a keyword from the Marketing Miner Profilers API, optionally filtered by suggestion type and paginated with limit/offset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lang: LANG_PROPERTY,
        keyword: { type: "string", description: "The seed keyword to get suggestions for" },
        suggestions_type: {
          type: "string",
          description: "Suggestion type filter, e.g. \"questions\", \"new\", or \"trending\"",
        },
        limit: { type: "integer", description: "Maximum number of suggestions to return" },
        offset: { type: "integer", description: "Pagination offset into the suggestions" },
        response_format: RESPONSE_FORMAT_PROPERTY,
      },
      required: ["lang", "keyword"],
    },
  },
  {
    name: "marketing_miner_get_website_stats",
    description:
      "Get estimated traffic, keyword count, and result-type breakdown for a website target from the Marketing Miner Profilers API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lang: LANG_PROPERTY,
        type: { type: "string", description: "Target type, e.g. \"domain\"" },
        target: { type: "string", description: "The website target, e.g. \"seznam.cz\"" },
        response_format: RESPONSE_FORMAT_PROPERTY,
      },
      required: ["lang", "type", "target"],
    },
  },
  {
    name: "marketing_miner_get_website_stats_range",
    description:
      "Get historical traffic trend and optional competitor comparison for a website target from the Marketing Miner Profilers API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lang: LANG_PROPERTY,
        type: { type: "string", description: "Target type, e.g. \"domain\"" },
        target: { type: "string", description: "The website target, e.g. \"seznam.cz\"" },
        period: { type: "string", description: "Trend period, e.g. \"monthly\"" },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "Competitor targets to compare against, as an array of strings",
        },
        response_format: RESPONSE_FORMAT_PROPERTY,
      },
      required: ["lang", "type", "target"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "keywordminer", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const config = configFromEnv();
    let out: string;
    if (name === "marketing_miner_get_search_volume") {
      out = await getSearchVolume(config, SearchVolumeArgs.parse(args ?? {}));
    } else if (name === "marketing_miner_batch_search_volume") {
      out = await batchSearchVolume(config, BatchSearchVolumeArgs.parse(args ?? {}));
    } else if (name === "marketing_miner_get_keyword_suggestions") {
      out = await getKeywordSuggestions(config, KeywordSuggestionsArgs.parse(args ?? {}));
    } else if (name === "marketing_miner_get_website_stats") {
      out = await getWebsiteStats(config, WebsiteStatsArgs.parse(args ?? {}));
    } else if (name === "marketing_miner_get_website_stats_range") {
      out = await getWebsiteStatsRange(config, WebsiteStatsRangeArgs.parse(args ?? {}));
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(out);
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
