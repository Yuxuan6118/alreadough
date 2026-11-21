/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { dailyCleanup } from "../lib/maintenance";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

/**
 * Sent with every response. No page may be framed by another site (so nobody can overlay the pay or
 * "delete everything" buttons), browsers must not guess content types, links do not leak full URLs, and
 * the microphone is only for this site (voice recording). A full script CSP is not set: the app relies on
 * inline scripts that would first need nonces.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  "Strict-Transport-Security": "max-age=31536000",
};

function withSecurityHeaders(response: Response) {
  if (response.status === 101) return response; // websocket upgrades (dev server) must pass through untouched
  const secured = new Response(response.body, response); // copies status and headers into a mutable response
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return withSecurityHeaders(await route(request, env, ctx));
  },
  /** Daily at 03:17 UTC (wrangler.jsonc "triggers"): remove expired sessions, old limit counters and old crash reports. */
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(dailyCleanup(env.DB)
      .then((removed) => console.log("daily cleanup", removed))
      .catch((error) => console.error("daily cleanup failed", String(error))));
  },
};

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/_vinext/image") {
    // Without the Cloudflare Images add-on there is no IMAGES binding; fall back
    // to serving the requested source asset unoptimized rather than erroring.
    if (!env.IMAGES) {
      // Only proxy same-origin asset paths, never an arbitrary/absolute URL.
      const source = url.searchParams.get("url") || "";
      if (!source.startsWith("/") || source.startsWith("//")) return new Response("Not found", { status: 404 });
      return env.ASSETS.fetch(new Request(new URL(source, url.origin)));
    }
    const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
    return handleImageOptimization(request, {
      fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
      transformImage: async (body, { width, format, quality }) => {
        const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
        return result.response();
      },
    }, allowedWidths);
  }

  return handler.fetch(request, env, ctx);
}

export default worker;
