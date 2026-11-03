#!/usr/bin/env node
import { OpenGrant, OpenGrantError, VERSION, type Grant, type SearchGrantsParams } from "./index.js";

const HELP = `opengrant ${VERSION} - search UK grant schemes and funders from the command line

Usage:
  opengrant search [keywords] [--region R] [--organisation O] [--theme T] [--closes-before YYYY-MM-DD] [--recently-closed] [--limit N] [--offset N]
  opengrant count  [keywords] [--region R] [--organisation O] [--theme T] [--closes-before YYYY-MM-DD]
  opengrant grant  <id>
  opengrant funder <slug> | --name "Funder name" | --charity <number>

Options:
  --json        Print the raw JSON result
  --base-url    Use another OpenGrant host (default https://opengrant.co.uk)
  -h, --help    Show this help
  -v, --version Show the version

Regions: england, scotland, wales, northern-ireland, north-east, north-west, yorkshire, east-midlands,
         west-midlands, east-of-england, london, south-east, south-west
Organisations: charities, businesses, schools, universities, local-authorities, public-bodies, large-companies, individuals
Themes: education, health, disability, poverty, overseas-aid, housing, faith, arts-culture-heritage-science,
        sport, animals, environment, community-development, armed-forces, equality, recreation

Public facts only: confirm deadlines and eligibility on each scheme's official guidance before applying.
Docs: https://opengrant.co.uk/developers/sdk`;

const FLAGS_WITH_VALUES = new Set(["region", "organisation", "theme", "closes-before", "limit", "offset", "name", "charity", "base-url"]);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h") flags.help = true;
    else if (arg === "-v") flags.version = true;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (inline !== undefined) flags[key] = inline;
      else if (FLAGS_WITH_VALUES.has(key)) {
        const value = argv[++i];
        if (value === undefined) throw new OpenGrantError(`--${key} needs a value`);
        flags[key] = value;
      } else flags[key] = true;
    } else positional.push(arg);
  }
  return { positional, flags };
}

function str(value: string | true | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function int(value: string | true | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new OpenGrantError(`--${name} must be a whole number`);
  return n;
}

function money(n: number | null | undefined): string | null {
  return n == null ? null : `£${n.toLocaleString("en-GB")}`;
}

function formatGrant(g: Grant): string {
  const award = g.award && (g.award.min != null || g.award.max != null) ? [money(g.award.min), money(g.award.max)].filter(Boolean).join(" – ") : null;
  return [
    `${g.title}`,
    `  ${g.funder} · ${g.statusLabel ?? g.status}${g.deadlineUk ? ` · closes ${g.deadlineUk}` : ""}${award ? ` · ${award}` : ""}`,
    g.where?.length ? `  Where: ${g.where.join(", ")}` : null,
    g.whoCanApply?.length ? `  Who can apply: ${g.whoCanApply.join(", ")}` : null,
    `  ${g.url}`,
    g.officialGuidanceUrl ? `  Official guidance: ${g.officialGuidanceUrl}` : null,
  ].filter(Boolean).join("\n");
}

async function main(argv: string[]): Promise<void> {
  const { positional, flags } = parseArgs(argv);
  const [command, ...rest] = positional;
  if (flags.version) return void console.log(VERSION);
  if (flags.help || !command) return void console.log(HELP);
  const client = new OpenGrant({ baseUrl: str(flags["base-url"]) });
  const json = flags.json === true;
  const print = (value: unknown, text: () => string) => console.log(json ? JSON.stringify(value, null, 2) : text());
  const filters: SearchGrantsParams = {
    q: rest.join(" ") || undefined,
    region: str(flags.region),
    organisation: str(flags.organisation),
    theme: str(flags.theme),
    closesBefore: str(flags["closes-before"]),
  };

  switch (command) {
    case "search": {
      const result = await client.searchGrants({ ...filters, includeRecentlyClosed: flags["recently-closed"] === true || undefined, limit: int(flags.limit, "limit"), offset: int(flags.offset, "offset") });
      return print(result, () => [`${result.total.toLocaleString("en-GB")} matching schemes (showing ${result.offset + 1}–${result.offset + result.returned})`, "", ...result.results.map(formatGrant).join("\n\n").split("\n"), "", `All results: ${result.resultsUrl}`].join("\n"));
    }
    case "count": {
      const result = await client.countGrants(filters);
      return print(result, () => `${result.total.toLocaleString("en-GB")} matching schemes\n${result.resultsUrl}`);
    }
    case "grant": {
      if (!rest[0]) throw new OpenGrantError("Give a grant id: opengrant grant <id>");
      const grant = await client.getGrant(rest[0]);
      return print(grant, () => formatGrant(grant) + (grant.summary ? `\n\n${grant.summary}` : ""));
    }
    case "funder": {
      const name = str(flags.name);
      const charity = str(flags.charity);
      const lookup = charity ? { charityNumber: charity } : name ? { name } : rest[0] ? { slug: rest[0] } : null;
      if (!lookup) throw new OpenGrantError('Give a funder slug, --name "Funder name" or --charity <number>');
      const result = await client.getFunder(lookup);
      if (result.matches) return print(result, () => ["Several funders match. Run again with one of these slugs:", ...result.matches.map((m) => `  ${m.slug}  ${m.name} (${m.openSchemes} open)`)].join("\n"));
      return print(result.funder, () => `${result.funder.name}\n\n${result.funder.summary ?? ""}`.trim());
    }
    default:
      throw new OpenGrantError(`Unknown command "${command}". Run opengrant --help`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? `opengrant: ${error.message}` : error);
  process.exitCode = 1;
});
