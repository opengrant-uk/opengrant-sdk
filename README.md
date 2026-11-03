# OpenGrant SDK and CLI

Official JavaScript/TypeScript SDK and command-line tool for [OpenGrant](https://opengrant.co.uk), the UK grant search. Find open, rolling and forthcoming UK grant schemes and look up funders. Each result has its deadline, award range, where it applies, who can apply and the funder's official guidance link.

No API key, account or sign-in is needed. The SDK calls OpenGrant's read-only [MCP server](https://opengrant.co.uk/developers/mcp) over HTTPS and has no runtime dependencies. It needs Node 18 or later.

- Docs: https://opengrant.co.uk/developers/sdk
- API documentation: https://opengrant.co.uk/developers
- MCP server: https://opengrant.co.uk/mcp ([guide](https://opengrant.co.uk/developers/mcp))
- OpenAPI: https://opengrant.co.uk/openapi.json

## Install

```bash
npm install opengrant
```

## Use the SDK

```ts
import { OpenGrant } from "opengrant";

const og = new OpenGrant();

// Environment grants for charities in Wales closing before Christmas
const { total, results } = await og.searchGrants({
  theme: "environment",
  organisation: "charities",
  region: "wales",
  closesBefore: "2026-12-24",
});
for (const grant of results) console.log(grant.title, grant.deadlineUk, grant.url);

// How many community development grants are open?
const { total: count } = await og.countGrants({ theme: "community-development" });

// One scheme, by the UUID in https://opengrant.co.uk/opportunities/{id}
const grant = await og.getGrant("b59439a3-d612-4d8f-85fd-2f5ee5b576f1");

// A funder by slug, UK charity number or name
const result = await og.getFunder({ charityNumber: "SC003133" });
if (result.funder) console.log(result.funder.summary);
else console.log(result.matches); // several funders matched a name
```

| Method | MCP tool | Returns |
| --- | --- | --- |
| `searchGrants(params)` | `search_grants` | Matching schemes, soonest deadline first, with `total` and paging |
| `countGrants(params)` | `count_matching_grants` | The number of matching schemes and a link to the search |
| `getGrant(id)` | `get_grant` | Public facts for one scheme |
| `getFunder({ slug } \| { charityNumber } \| { name })` | `get_funder` | A funder profile, or the closest matches for an ambiguous name |
| `callTool(name, args)` | any | The parsed result of any OpenGrant MCP tool |

Search filters are `q`, `region`, `organisation`, `theme`, `closesBefore` (`YYYY-MM-DD`), `includeRecentlyClosed`, `limit` (1–25) and `offset`. Errors throw `OpenGrantError`. The public endpoint allows 60 requests per minute per client.

## Use the CLI

```bash
npx opengrant search "community energy" --region wales
npx opengrant search --theme health --organisation charities --closes-before 2026-12-31 --limit 5
npx opengrant count --region scotland
npx opengrant grant b59439a3-d612-4d8f-85fd-2f5ee5b576f1
npx opengrant funder --name "Gannochy"
npx opengrant funder --charity SC003133 --json
```

Add `--json` to any command for the raw result. Run `npx opengrant --help` for every option and filter value.

## Use with AI agents

- **MCP:** connect any MCP client to `https://opengrant.co.uk/mcp` (Streamable HTTP, no auth). See the [MCP guide](https://opengrant.co.uk/developers/mcp).
- **Agent plugin:** this repository is an [Agent Plugin](https://agent-plugins.org). It has a `plugin.json` manifest, the `opengrant` skill in `skills/` and the MCP server in `mcp.json`.
- **Coding agents:** [AGENTS.md](AGENTS.md) explains how to use and change this package.

## Responsible use

OpenGrant publishes public facts compiled from open data ([sources and licences](https://opengrant.co.uk/sources)). Statuses, deadlines and eligibility change. Check the funder's official guidance (`officialGuidanceUrl`) before advising anyone to apply. OpenGrant does not take applications.

## Licence

MIT
