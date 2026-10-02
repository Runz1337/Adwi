# Birthday Site

An interactive 3D birthday experience: a scroll-driven journey through a Three.js scene
with KTX2 textures, Draco-compressed glTF models, layered audio, and hand-gesture input.
The site itself is a fully static Next.js export; the "make a wish" form at the end posts to
a single Vercel Function that forwards the message to a Discord channel.

## Run & Operate

- `pnpm --filter @workspace/birthday-site run dev` — serve the site (port 25071)
- `pnpm --filter @workspace/birthday-site run build` — bundle the static server to `dist/index.mjs`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run vercel:dev` — serve the export the way Vercel would (no server code)
- `pnpm run vercel:deploy` — deploy to Vercel production
- Required env: `PORT` — the listen port for the birthday site
- Required env: `DISCORD_WEBHOOK_URL` — the Discord webhook wishes are posted to. The wish
  function returns `503` without it. **Never commit this value**; it is a bearer token that
  anyone holding it can post to your channel with.

## Wishes

The "make a wish" form at the end of the scroll posts to a Discord channel. There is no
database and nothing to read — the wishes *are* the Discord messages.

- The site calls `POST /api/wish` with `{"message": string}`. That is a Vercel Function
  (`wish-api/index.js`) which forwards the message to `DISCORD_WEBHOOK_URL` as an embed.
- Trims, rejects empty, and caps at 280 characters — the same limit the input's
  `maxLength: 80` sits under.
- `POST /api/wish` only. `GET /api/healthz` answers `{"status":"ok"}` for uptime checks.
- Rate limited to 5 per IP per 10 minutes, held in the instance's memory. Enough to stop one
  page from flooding the channel; not a real defence once requests spread across instances.
- Sends `allowed_mentions: { parse: [] }`, so a wish containing `@everyone` cannot ping
  anyone.
- Discord's own rate limit (HTTP 429) is surfaced to the visitor as `503`, not passed through.

## Deploy to Vercel

Two services on one domain, and neither one installs or builds anything.

- `vercel.json` (repo root) uses the **services** model with two services:
  - `birthday_site` — rooted at `artifacts/birthday-site`, no-op `installCommand`/`buildCommand`,
    `outputDirectory: public`. The export is already built and committed.
  - `wish_api` — rooted at `wish-api`, `entrypoint: "index.js"`, with `installCommand` and
    `buildCommand` set to `""` so both are skipped. The function has no dependencies, so
    there is nothing to install and nothing to compile.
- Top-level rewrites are evaluated in order: `/api/(.*)` goes to `wish_api`, then `/(.*)` to
  `birthday_site`.
- A service receives the **original** request path, so `wish-api/index.js` matches on
  `/api/wish` and `/api/healthz` itself rather than relying on a router.
- `framework` is omitted on both. Nothing is auto-detected in `artifacts/birthday-site`
  because that package only ships a prebuilt export, so it resolves to a plain static output
  directory.
- **The project's Framework Preset must be `Services`.** Vercel shows a "Multiple
  applications detected" import screen for this repo — zero-config finds
  `artifacts/mockup-sandbox` (Vite) but no framework in `artifacts/birthday-site`.
  Explicit `services` in `vercel.json` is what makes the import screen accept the project.
- **Root Directory must be the repo root.** A root directory of `artifacts/birthday-site`
  finds no config and would serve that folder's source instead of the site.
- Set `DISCORD_WEBHOOK_URL` on the Vercel project. It is a service-wide env var.
- `.vercelignore` keeps the upload to the export, `wish-api/index.js`, and `vercel.json`.
  `lib`, `scripts`, `artifacts/mockup-sandbox` and `pnpm-lock.yaml` are all excluded, because
  nothing in the upload is installed or built.
- `artifacts/mockup-sandbox` is not deployed.
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
- Static server: `node:http`, bundled with esbuild
- Wish API: one dependency-free ES module, run by Vercel as a Function

## Where things live

- `artifacts/birthday-site/src/index.ts` — static server: MIME map, extensionless route
  resolution, HTTP range requests, cache-control tiers
- `artifacts/birthday-site/public/` — the static site export (67 MB, committed)
- `artifacts/birthday-site/.replit-artifact/artifact.toml` — port, run/build commands, `/` route
- `artifacts/birthday-site/build.mjs` — esbuild config for the server bundle
- `wish-api/index.js` — the entire wish backend: validate, rate limit, forward to Discord

## Architecture decisions

- **Discord, not a database.** A birthday site gets a handful of wishes from a handful of
  people. A Postgres table meant provisioning a database, a schema, a migration story and a
  way to read the rows back; a webhook means a channel you are already in. `lib/db` and the
  `artifacts/api-server` package were removed rather than left dormant.
- **A Function, not the browser calling Discord directly.** Discord's webhook endpoint does
  send CORS headers, so the site could `fetch` the webhook itself and there would be no
  backend at all. But a webhook URL is a bearer token: shipping one in the site's JavaScript
  means anyone can view-source the page, lift it, and post to the channel forever. The only
  way to revoke that is to regenerate the webhook. One 100-line file that reads the URL from
  the environment is worth it.
- The Function has no dependencies and no build step, so `installCommand` and `buildCommand`
  are empty strings rather than `echo` no-ops — empty tells Vercel to skip them outright.
- Vercel gets two services. The build/runtime keys that were top-level (`installCommand`,
  `buildCommand`, `outputDirectory`) moved into the services because those keys are invalid
  at the top level once `services` is present; `headers` and the rewrites stay at the top
  level since they are public routing.
- The site calls the API with a hand-written `fetch("/api/wish", ...)` inside the app chunk.
  `@workspace/api-client-react` cannot be used there: the export is a static bundle, that
  package is not a dependency of it, and importing it would pull React Query into a page that
  only needs one POST.
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
camera moves, gesture interaction, ambient music, and a progress/XP UI. It ends on a
"make a wish" card where a visitor can leave a message that lands in a Discord channel.

## User preferences

- Serve the site at the root route `/`. Do not nest it under a subpath.
- Wishes go to Discord. No database, no integrations, nothing else to run or host.

## Gotchas

- **`DISCORD_WEBHOOK_URL` is a secret.** It grants unauthenticated write access to the
  channel. It lives in the Vercel project's env vars and nowhere in the repo. If it is ever
  committed, logged, or pasted into a public issue, regenerate the webhook in Discord's
  channel settings — deleting the old one is the only real fix.
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
  - Editing a chunk **in place** does not reach browsers if the URL is cached. `/_next/static`
    filenames are content hashes, so the URL does not change when the bytes do.
    `/_next/static` is now served `public, max-age=0, must-revalidate` instead of `immutable`,
    so in-place edits do reach browsers and no rename is needed. Renaming the chunk and
    updating its references (`index.html`, `index.txt`, `__next._full.txt`,
    `__next.__PAGE__.txt`) is still the escape hatch if that header ever goes back to
    `immutable` — but it breaks any visitor holding a cached `index.html` that names the old
    file, so prefer the in-place edit.
- The wish form's submit handler lives in
  `public/_next/static/chunks/a00828f47a022ab66.js`. It POSTs to `/api/wish` and cancels the
  "your wish is on its way" animation if the request fails. That `:after` text is a hardcoded
  CSS string, so a wish that fails to send still shows it briefly — the animation is cancelled
  on a non-OK response, but there is no message telling the visitor it failed.
- `lib/api-spec/openapi.yaml` still describes a `/wishes` API with `createWish`/`listWishes`
  in `lib/api-zod` and `lib/api-client-react`. None of that exists any more; the real endpoint
  is `POST /api/wish`. Left as-is because regenerating would also delete a hand-written
  `withQueryKey` helper that is sitting inside `lib/api-client-react/src/generated/api.ts`
  despite the "do not edit manually" header. Clean both up together.
- Don't delete files under `public/og/textures/` — `love-city.png` and
  `love-letters-bg.png` are still referenced by the app chunk.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
