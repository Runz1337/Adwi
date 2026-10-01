import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

await import("esbuild").then(async ({ build }) => {
  await build({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: path.resolve(artifactDir, "dist"),
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    minify: process.env["NODE_ENV"] === "production",
    sourcemap: true,
  });
});
