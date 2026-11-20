// Module resolution for tests: Node strips the TypeScript types itself; these hooks add what the bundler normally
// does: the "@/" path alias, imports without a .ts extension, and a stand-in for the Workers-only "cloudflare:workers".
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../../", import.meta.url);
const workers = new URL("./cloudflare-workers.mjs", import.meta.url).href;

function withExtension(url) {
  const path = fileURLToPath(url);
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
    if (existsSync(candidate) && !candidate.endsWith("/") && (candidate !== path || /\.[cm]?[jt]sx?$/.test(path))) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: workers, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const found = withExtension(new URL(specifier.slice(2), root));
    if (found) return { url: found, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const found = withExtension(new URL(specifier, context.parentURL));
    if (found) return { url: found, shortCircuit: true };
  }
  return next(specifier, context);
}
