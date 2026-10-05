// Minimal ESM loader resolving this project's "@/..." tsconfig path alias to src/...,
// so a plain Node script (no bundler) can import a src/lib/*.ts module directly. Used
// only by scripts/test-reminder-milestones.mjs — app code never runs under this.
import { readFile } from "node:fs/promises";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href;
    return nextResolve(target, context);
  }
  return nextResolve(specifier, context);
}

// src/lib/*.ts imports seed/*.json the plain way (no `with { type: "json" }`), which
// bundlers accept but Node's spec-compliant ESM loader doesn't — declaring the format
// here is the documented way around that for a plain `node` run.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    return { format: "json", shortCircuit: true, source: await readFile(new URL(url), "utf8") };
  }
  return nextLoad(url, context);
}
