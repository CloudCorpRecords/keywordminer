#!/usr/bin/env node
/**
 * keywordminer CLI.
 *
 *   keywordminer search-volume <lang> <keyword> [--json]
 *   keywordminer mcp
 *
 * search-volume calls the Marketing Miner Profilers API with
 * the token from MARKETING_MINER_API_TOKEN (alternates:
 * MARKETING_MINER_API_KEY, MARKETING_MINER_TOKEN, MM_API_TOKEN,
 * MM_API_KEY) and prints the rendered result. Exit codes: 0
 * success, 1 runtime error (including a missing token), 2
 * usage error.
 */
import { configFromEnv, getSearchVolume, VERSION } from "./keywordminer.js";

function usage(): never {
  console.error(`Usage:
  keywordminer search-volume <lang> <keyword> [--json]
  keywordminer mcp
  keywordminer --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd !== "search-volume") usage();
  const json = rest.includes("--json");
  const positional = rest.filter((a) => a !== "--json");
  if (positional.length !== 2) usage();

  try {
    const out = await getSearchVolume(configFromEnv(), {
      lang: positional[0],
      keyword: positional[1],
      response_format: json ? "json" : "markdown",
    });
    console.log(out);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
