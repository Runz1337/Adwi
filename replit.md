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
- `pnpm run vercel:dev` — serve the export the way Vercel would (no server code)
- `pnpm run vercel:deploy` — deploy to Vercel production
- Required env: `PORT` — the listen port for the birthday site

## Deploy to Vercel

The export is already built and committed, so Vercel needs no install and no build.

- `vercel.json` (repo root) uses the **services** model: one service `birthday_site`
  rooted at `artifacts/birthday-site` with a no-op `installCommand`/`buildCommand` and
  `outputDirectory: public`, plus a catch-all top-level rewrite that sends `/(.*)` to that
  service. `.vercelignore` keeps the upload to the export only.
- `framework` is omitted, not set to `null`: the service schema types it as a string and the
  API rejects a null. Nothing is auto-detected in that root anyway, so the service resolves
  to a plain static output directory.
- **The project's Framework Preset must be `Services`.** Vercel shows a "Multiple
  applications detected" import screen for this repo — zero-config finds
  `artifacts/api-server` (Express) and `artifacts/mockup-sandbox` (Vite) but no framework
  in `artifacts/birthday-site`, because that package only ships a prebuilt export. Explicit
  `services` in `vercel.json` is what makes the import screen accept the project; the
  birthday site is never listed as a detected app.
- **Root Directory must be the repo root.** A root directory of `artifacts/birthday-site`
  finds no config and would serve that folder's source instead of the site.
- This config is for the static site only. `artifacts/api-server` and
  `artifacts/mockup-sandbox` are ignored and are not deployed.
- Assets are absolute paths and the site owns `/`, so it cannot be mounted under a subpath.
- Immutable caching is declared for `/og`, `/models`, `/basis` and `/mediapipe`.
  `/_next/static` is deliberately `public, max-age=0, must-revalidate` — see the
  hand-editing gotcha below. Vercel serves `.ktx2`/`.glb`/`.wasm`/`.task` with usable
  content types and the CDN handles range requests, so the hand-written server is not
  needed in production.
- Gotcha: `og/textures/love-city.png` is JPEG data under a `.png` name (as are several
  other files in that folder). Browsers sniff image content so it renders, but the served
  `Content-Type` is technically wrong.

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

- Vercel gets a single static service with no install and no build. The build/runtime keys
  that were top-level (`installCommand`, `buildCommand`, `outputDirectory`) moved into the
  service because
  those keys are invalid at the top level once `services` is present; `headers` and the
  rewrite stay at the top level since they are public routing.
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
- **Editing the prebuilt export by hand.** The React source is not in this repo, so text
  and JS changes are made directly in `public/`. Two rules:
  - Text lives in **both** `index.html` and the app chunk. React hydration re-renders from
    the chunk, so changing only `index.html` shows nothing (or a flash before hydration).
  - Editing a chunk **in place** does not reach browsers. `/_next/static` filenames are
    content hashes, so the URL is unchanged and any `immutable` cache pins the old bytes.
    Rename the chunk and update its references (`index.html`, `index.txt`,
    `__next._full.txt`, `__next.__PAGE__.txt`) when the content changes. `/_next/static` is
    now revalidated instead of immutable so future edits need less ceremony.
- Don't delete files under `public/og/textures/` — `love-city.png` and
  `love-letters-bg.png` are still referenced by the app chunk.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
