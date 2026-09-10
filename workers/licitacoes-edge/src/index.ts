/**
 * Edge proxy for Monitor de Licitações.
 * Public hostname (Custom Domain) → Worker → ORIGIN_URL (Tunnel hostname).
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ExportedHandler<WorkerEnv = unknown> {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> | Response;
}

export interface Env {
  /** Upstream via Cloudflare Tunnel, e.g. https://licitacoes-origin.getgymsite.com.br */
  ORIGIN_URL: string;
  /** Optional comma-separated CORS allowlist; empty = reflect request Origin if same-site */
  CORS_ORIGINS?: string;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
]);

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allow = (env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!origin) return {};
  if (allow.length === 0 || allow.includes(origin) || allow.includes("*")) {
    return {
      "Access-Control-Allow-Origin": allow.includes("*") ? "*" : origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") ||
        "Authorization,Content-Type,X-API-Key",
      Vary: "Origin",
    };
  }
  return {};
}

function buildUpstream(request: Request, env: Env): URL {
  const incoming = new URL(request.url);
  const base = new URL(env.ORIGIN_URL);
  base.pathname = incoming.pathname;
  base.search = incoming.search;
  return base;
}

function filterRequestHeaders(src: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of src) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === "host") continue;
    out.set(k, v);
  }
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.ORIGIN_URL) {
      return Response.json(
        { error: "ORIGIN_URL binding missing" },
        { status: 500 },
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const upstreamUrl = buildUpstream(request, env);
    const init: RequestInit = {
      method: request.method,
      headers: filterRequestHeaders(request.headers),
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      // @ts-expect-error duplex required for streaming body in Workers
      init.duplex = "half";
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl.toString(), init);
    } catch (err) {
      console.error("origin fetch failed", err);
      return Response.json({ error: "origin unreachable" }, { status: 502 });
    }

    const headers = new Headers(upstream.headers);
    for (const h of HOP_BY_HOP) headers.delete(h);
    const extra = corsHeaders(request, env);
    for (const [k, v] of Object.entries(extra)) headers.set(k, v);
    headers.set("X-Edge-Proxy", "licitacoes-edge");

    // Avoid buffering large bodies
    const body = upstream.body;
    ctx.waitUntil(Promise.resolve());

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
