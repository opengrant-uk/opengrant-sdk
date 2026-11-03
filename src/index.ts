/**
 * OpenGrant SDK: public facts for UK grant schemes and funders.
 * Calls the read-only OpenGrant MCP server (https://opengrant.co.uk/mcp) over plain HTTPS JSON-RPC.
 * No API key or account is needed.
 */

export const DEFAULT_BASE_URL = "https://opengrant.co.uk";
export const VERSION = "0.1.0";

export interface SearchGrantsParams {
  /** Keywords, e.g. a funder or programme name or a topic such as "community energy". */
  q?: string;
  /** UK nation or English region, e.g. "london", "wales", "scotland". */
  region?: string;
  /** Type of applicant, e.g. "charities", "businesses", "schools", "individuals". */
  organisation?: string;
  /** Cause area, e.g. "environment", "health". */
  theme?: string;
  /** Only schemes whose next deadline is on or before this UK date (YYYY-MM-DD). */
  closesBefore?: string;
  /** Also return schemes that closed in the last 90 days. */
  includeRecentlyClosed?: boolean;
  /** 1 to 25, default 10. */
  limit?: number;
  /** Skip this many results, for paging. */
  offset?: number;
}

export type CountGrantsParams = Pick<SearchGrantsParams, "q" | "region" | "organisation" | "theme" | "closesBefore">;

export interface Award {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface Grant {
  id: string;
  title: string;
  funder: string;
  funderUrl?: string;
  status: string;
  statusLabel?: string;
  opens?: string | null;
  /** UK date (YYYY-MM-DD) when the source gave no time, otherwise an ISO instant. */
  deadline?: string | null;
  /** The deadline in words, in UK time. */
  deadlineUk?: string | null;
  award?: Award;
  where?: string[];
  whoCanApply?: string[];
  fundingType?: string[];
  themes?: string[];
  summary?: string | null;
  source?: string;
  /** The funder's own guidance: check criteria and how to apply here. */
  officialGuidanceUrl?: string | null;
  applicationUrl?: string | null;
  lastVerified?: string | null;
  /** Canonical OpenGrant URL to cite. */
  url: string;
  markdownUrl?: string;
  [key: string]: unknown;
}

export interface SearchGrantsResult {
  total: number;
  offset: number;
  returned: number;
  nextOffset: number | null;
  results: Grant[];
  resultsUrl: string;
  [key: string]: unknown;
}

export interface CountGrantsResult {
  total: number;
  filters: Record<string, string>;
  resultsUrl: string;
}

export interface FunderMatch {
  name: string;
  slug: string;
  openSchemes: number;
  url: string;
}

export interface Funder {
  name: string;
  summary?: string;
  [key: string]: unknown;
}

export type FunderLookup = { slug: string } | { charityNumber: string } | { name: string };

/** A funder profile, or the closest matches when a name lookup is ambiguous. */
export type GetFunderResult = { funder: Funder; matches?: undefined } | { funder?: undefined; matches: FunderMatch[] };

export interface OpenGrantOptions {
  /** Defaults to https://opengrant.co.uk */
  baseUrl?: string;
  /** Custom fetch, e.g. for tests or proxies. Defaults to the global fetch (Node 18+). */
  fetch?: typeof fetch;
}

export class OpenGrantError extends Error {
  constructor(message: string, readonly tool?: string, readonly status?: number) {
    super(message);
    this.name = "OpenGrantError";
  }
}

export class OpenGrant {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;

  constructor(options: OpenGrantOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) throw new OpenGrantError("No fetch implementation found. Use Node 18+ or pass options.fetch.");
  }

  /** Open, rolling and forthcoming UK grant schemes, soonest deadline first. */
  searchGrants(params: SearchGrantsParams = {}): Promise<SearchGrantsResult> {
    return this.callTool<SearchGrantsResult>("search_grants", {
      q: params.q,
      region: params.region,
      organisation: params.organisation,
      theme: params.theme,
      closes_before: params.closesBefore,
      include_recently_closed: params.includeRecentlyClosed,
      limit: params.limit,
      offset: params.offset,
    });
  }

  /** How many schemes match, with a link to the matching search on the website. */
  countGrants(params: CountGrantsParams = {}): Promise<CountGrantsResult> {
    return this.callTool<CountGrantsResult>("count_matching_grants", {
      q: params.q,
      region: params.region,
      organisation: params.organisation,
      theme: params.theme,
      closes_before: params.closesBefore,
    });
  }

  /** Public facts for one scheme by its OpenGrant id (the UUID in /opportunities/{id}). */
  async getGrant(id: string): Promise<Grant> {
    return (await this.callTool<{ data: Grant }>("get_grant", { id })).data;
  }

  /** A funder's public profile by slug, UK charity number or name. */
  async getFunder(lookup: FunderLookup): Promise<GetFunderResult> {
    const args = "slug" in lookup ? { slug: lookup.slug } : "charityNumber" in lookup ? { charity_number: lookup.charityNumber } : { name: lookup.name };
    const result = await this.callTool<{ data?: Funder; matches?: FunderMatch[] }>("get_funder", args);
    return result.matches ? { matches: result.matches } : { funder: result.data as Funder };
  }

  /** Call any OpenGrant MCP tool by name and return its parsed JSON result. */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const cleanArgs = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    const response = await this.fetchImpl(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": `opengrant-sdk/${VERSION}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method: "tools/call", params: { name, arguments: cleanArgs } }),
    });
    if (!response.ok) {
      const retry = response.headers.get("Retry-After");
      throw new OpenGrantError(`OpenGrant returned HTTP ${response.status}${retry ? `; retry after ${retry}s` : ""}`, name, response.status);
    }
    const body = (await response.json()) as { error?: { message?: string }; result?: { isError?: boolean; content?: { type: string; text?: string }[] } };
    if (body.error) throw new OpenGrantError(body.error.message ?? "OpenGrant request failed", name);
    const text = body.result?.content?.find((c) => c.type === "text")?.text;
    if (text === undefined) throw new OpenGrantError("OpenGrant returned no content", name);
    const parsed = JSON.parse(text) as { error?: string };
    if (body.result?.isError) throw new OpenGrantError(parsed.error ?? text, name);
    return parsed as T;
  }
}
