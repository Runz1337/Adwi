# Birthday Site

An interactive 3D birthday experience: a scroll-driven journey through a Three.js scene
with KTX2 textures, Draco-compressed glTF models, layered audio, and hand-gesture input.
Served as a fully static Next.js export.

## Run & Operate

- `pnpm --filter @workspace/birthday-site run dev` — serve the site (port 25071)
- `pnpm --filter @workspace/birthday-site run build` — bundle the static server to `dist/index.mjs`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- Required env: `PORT` — the listen port for the birthday site

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Site: prebuilt static Next.js export (no framework runtime at request time)
- Assets: Three.js, KTX2/Basis transcoder, Draco decoder, MediaPipe Vision WASM
- Server: `node:http` static file server, bundled with esbuild

## Where things live

- `artifacts/birthday-site/src/index.ts` — static server: MIME map, extensionless route
  resolution, HTTP range requests, cache-control tiers
- `artifacts/birthday-site/public/` — the static site export (67 MB, committed)
- `artifacts/birthday-site/.replit-artifact/artifact.toml` — port, run/build commands, `/` route
- `artifacts/birthday-site/build.mjs` — esbuild config for the server bundle

## Architecture decisions

- The export is served by a hand-written `node:http` server rather than a framework or
  Replit's static serving. It needs exact `Content-Type` values for `.ktx2`, `.glb`,
  `.wasm`, and `.task`, plus range requests so the `<audio>` and `<video>` elements can
  seek. This is the only moving part in the repo — no dependencies.
- Asset paths are absolute (`/og/...`, `/models/...`, `/_next/...`) because they are baked
  into the export. The site therefore owns the root route and cannot be mounted under a
  subpath without a base-path rewrite.
- `artifacts/birthday-site` replaced `artifacts/starter-app`, which held `/`.
- Cache tiers: `/_next/static`, `/basis`, `/draco` get 1 year immutable (content-hashed or
  never-changing); `/models`, `/mediapipe`, `/og` get 7 days; HTML is `no-cache`.
- The 67 MB of assets are committed rather than unzipped at build time, so autoscale
  deploys ship a self-contained image with no build-time dependency on `unzip`.

## Product

A single-page scroll journey (100 to -25) through staged 3D scenes with scroll-linked
camera moves, gesture interaction, ambient music, and a progress/XP UI.

## User preferences

- Serve the site at the root route `/`. Do not nest it under a subpath.

## Gotchas

- `pnpm run build` fails in `mockup-sandbox` because its Vite config requires `PORT`.
  Pre-existing and unrelated to the birthday site.
- `public/mediapipe/` (42 MB of WASM) is present but nothing in the bundle references
  those paths — hand tracking appears to load from a CDN at runtime instead. Left in
  place in case the local path is used again.
- The site is asset-heavy: budget ~67 MB on first load.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
