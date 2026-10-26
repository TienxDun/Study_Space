# Study Space (ZenStudy) - agent notes

Next.js 16 + React 19 + Tailwind v4 single-page app with Vietnamese UI. Local-first (localStorage); Firebase auth, D1 cloud sync, chat and LiveKit rooms are optional layers on top.

## Commands

- `npm run dev` - Turbopack on **http://localhost:3001** (not 3000).
- `npm test` - all Vitest unit tests (37 test suites, 233 tests). Single file: `npx vitest run src/__tests__/unit/study/<name>.test.ts`.
- `npm run test:load` - run 200 concurrent users (200 CCU) load test against Worker simulation.
- `npm run lint` - ESLint **and** `scripts/check-important.mjs`, which fails on `!important` outside `IMPORTANT-ALLOWED-START/END` blocks in `src/app/globals.css` and `src/app/styles/*.css`.
- `npx tsc --noEmit` - typecheck; there is no npm script for it.
- `npm run build` - local build stays in server mode. Static export to `out/` happens only when `CF_PAGES` is set by Cloudflare Pages. There is no GitHub Actions pipeline; run lint/typecheck/tests yourself.
- `npm run build:web` - Cloudflare Pages **web** build (`next build` + `scripts/strip-admin-export.mjs`). Cloudflare never sees the gitignored `src/app/admin`/`src/app/api`, so the export succeeds there; on a local machine those folders make Next reject the dynamic route handlers, so leave web export to Cloudflare (or move them aside temporarily). The strip step fails if `out/` is missing and removes `out/admin`, `out/api`, `out/dev`.
- `npm run build:admin` - Cloudflare **Worker** admin build (`scripts/prepare-admin-bundle.mjs`); writes `admin-host/index.html` plus `_headers`, `_redirects` into `dist-admin/`. Deploy with `npx wrangler deploy --config wrangler.admin.jsonc`.
- `npx wrangler dev --config wrangler.admin.jsonc --port 8787` - chạy shell admin ở `http://localhost:8787/admin/`. `.dev.vars` (gitignored) đặt `ENVIRONMENT=development` để bỏ qua Access **chỉ khi** hostname là localhost; không bao giờ đặt biến này trong Production.
- `npm run sync:r2` - upload assets to R2 (reads `R2_*` from `.env.local`).

## Architecture

- The whole app is one client page: `src/app/page.tsx`. Central state and every open/close action live in `src/components/study/hooks/useStudySpaceState.ts`; new features must be threaded through it, then rendered in both layouts.
- Desktop/mobile split at 640px (`useIsMobile`): `StudyDesktopLayout` vs `StudyMobileLayout`. Mobile navigation is a stack (`useMobileStack`) mapped onto sheet flags by `syncScreenToStates`; do not add a second mobile state machine.
- Persistence is localStorage-first. Every key lives in `src/lib/storage-keys.ts`; never hardcode key strings. `src/lib/simple-cloud-sync.ts` mirrors the entire user workspace as a snapshot document (Save Game Document mode) to D1 via `workers/data-api` (`GET/POST /data`, ~2s debounce, offline auto-recovery, wipe on logout) and deliberately excludes machine-specific keys.
- Scenes, sounds and tracks are JSON in `src/data/assets/`, typed in `src/components/study/study-types.ts`. Asset URLs must go through `src/lib/asset-resolver.ts` (CDN env or `/study` fallback). `public/study/` is ~465 MB and gitignored, so never assume it exists in CI.
- `/api/*` is dev-only, guarded by `NODE_ENV === "development"`. `src/app/admin/` (limits + chat UI) and `src/app/api/` are gitignored, so they only exist on local machines; the web build strips `out/admin`, `out/api`, `out/dev` as a safety net. The admin Worker (`zenstudy-admin`, config in `wrangler.admin.jsonc`, code in `admin-worker/_worker.ts`) serves `admin-host/` from `npm run build:admin`, verifies the Cloudflare Access JWT on `/api/admin/*`, and proxies other paths to `env.ASSETS`. The scene studio is now `/dev/studio` (`src/app/dev/studio/page.tsx`, tracked but stripped from the web export); it edits `src/data/assets/scenes.json` and writes media into `public/study`.
- `workers/` are standalone Cloudflare Workers deployed by pasting into the dashboard - not built by Next. Backend setup order is in `docs/deployment/DEPLOY.md`; D1 schema and API are in `docs/guides/CLOUD_SYNC_GUIDE.md` and `workers/schema.sql`. The old plan is archived at `docs/archive/CLOUD_SYNC_PLAN.md`.
- Missing `NEXT_PUBLIC_*` Firebase/CDN/worker URLs degrade the app to local-only. `src/lib/firebase-config.ts` exists so the Firebase SDK is only imported when configured.

## Conventions

- UI copy and code comments are Vietnamese; write new ones in Vietnamese.
- Tailwind v4 is CSS-first: semantic tokens live in `src/app/styles/tokens.css` (`panel`, `line`, `accent-*`). Prefer them over raw palette colors. Admin has its own spec in `src/app/admin/DESIGN.md`; mobile UI must follow `docs/guides/mobile-style-guide.md`.
- No `!important` outside the allowed marker blocks (enforced by `npm run lint:css`).
- ESLint intentionally disables `no-explicit-any`, `react-hooks/exhaustive-deps` and `react-hooks/set-state-in-effect`; do not "fix" that config.
- Tests run in Node by default. Add `// @vitest-environment happy-dom` as the first line when a test needs DOM APIs.
- The `sm:` breakpoint in Tailwind and `useIsMobile` are both 640px; keep mobile/desktop behavior aligned with that value.

## Deploy

- Push to `main` → Cloudflare Pages builds the web static export (`CF_PAGES=1`), and since 2026-10-27 a `Workers Builds: zenstudy-admin` check also builds and deploys the admin Worker from `wrangler.admin.jsonc` (push `db8b078` → version `bdc9a5d8` with `FLAGS`/`DB`/`R2`/`ASSETS` intact). Before that date the Worker only changed by manual deploy, so treat `npm run build:admin` + `npx wrangler deploy --config wrangler.admin.jsonc` as the fallback if the check is missing or fails. `chat-proxy`/`livekit-rooms` are still pasted from the dashboard. GitHub Actions/Pages was removed on 2026-10-25. Assets come from `NEXT_PUBLIC_STUDY_CDN_URL` (R2). The admin Worker sits behind Cloudflare Access for a single email.
- `NEXT_PUBLIC_*` values are baked at build time; changing them requires a rebuild. `.env.local` is gitignored - worker secrets belong in Cloudflare, never in this repo.
- `wrangler.admin.jsonc` is the only source for the admin Worker's bindings (`FLAGS` → KV `CHAT_QUOTA` key `cfg:flags`, `DB` → D1 `zenspace`, `R2` → bucket `study-space`, `ASSETS`). `keep_vars` preserves dashboard Text vars only; any binding added just in the dashboard is dropped on the next deploy, so declare it in the config.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
