# AGENTS.md

Guidance for AI coding agents working with the OpenGrant SDK and CLI.

## Using OpenGrant in a project

- Install with `npm install opengrant`. Import `{ OpenGrant }` from `"opengrant"`. It is an ES module with no runtime dependencies and needs Node 18+.
- No API key or auth. Do not invent one, and do not add an `Authorization` header.
- Use `searchGrants` to find schemes, `getGrant(id)` for one scheme, `getFunder({ slug | charityNumber | name })` for a funder, and `countGrants` for counts only.
- Filter values are fixed lists. `region`: england, scotland, wales, northern-ireland, north-east, north-west, yorkshire, east-midlands, west-midlands, east-of-england, london, south-east, south-west. `organisation`: charities, businesses, schools, universities, local-authorities, public-bodies, large-companies, individuals. `theme`: education, health, disability, poverty, overseas-aid, housing, faith, arts-culture-heritage-science, sport, animals, environment, community-development, armed-forces, equality, recreation. Unknown values throw an `OpenGrantError` that lists the valid ones.
- `closesBefore` is a UK date `YYYY-MM-DD`. `deadline` on results is a UK date when the source gave no time, otherwise an ISO instant. Show users `deadlineUk`.
- `getFunder({ name })` can return `{ matches }` instead of `{ funder }` when several funders match. Handle both.
- Cite each result's `url` (the OpenGrant page). Send users to `officialGuidanceUrl` for criteria and how to apply. OpenGrant does not take applications.
- Rate limit: 60 requests per minute per client. On HTTP 429 the error carries `status` 429; wait and retry.
- Agents without a Node runtime can call the MCP server at `https://opengrant.co.uk/mcp` directly, or read `https://opengrant.co.uk/llms-full.txt`.

## Changing this package

- Source is in `src/`: `index.ts` is the client, `cli.ts` is the `opengrant` binary. Build with `npm run build` (TypeScript to `dist/`).
- Keep zero runtime dependencies, and keep the client a thin wrapper over the MCP tools at https://opengrant.co.uk/mcp. The server's tool list is at `https://opengrant.co.uk/.well-known/mcp/server-card.json`.
- Use British English in user-facing text, and the words "scheme" and "funder".
- `plugin.json`, `mcp.json` and `skills/opengrant/SKILL.md` make this repo an Agent Plugin. Keep their `version` in step with `package.json`.
