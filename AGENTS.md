# Study Space (ZenStudy) - agent notes

Next.js 16 + React 19 + Tailwind v4 single-page app with Vietnamese UI. Local-first (localStorage); Firebase auth, D1 cloud sync, chat and LiveKit rooms are optional layers on top.

## Commands

- `npm run dev` - Turbopack on **http://localhost:3001** (not 3000).
- `npm test` - all Vitest unit tests (37 test suites, 233 tests). Single file: `npx vitest run src/__tests__/unit/study/<name>.test.ts`.
- `npm run test:load` - run 200 concurrent users (200 CCU) load test against Worker simulation.
- `npm run lint` - ESLint **and** `scripts/check-important.mjs`, which fails on `!important` outside `IMPORTANT-ALLOWED-START/END` blocks in `src/app/globals.css` and `src/app/styles/*.css`.
- `npx tsc --noEmit` - typecheck; there is no npm script for it.
- `npm run build` - local build stays in server mode. Static export to `out/` happens only when `GITHUB_ACTIONS` or `CF_PAGES` is set. CI runs build only, so run lint/typecheck/tests yourself.
- `npm run sync:r2` - upload assets to R2 (reads `R2_*` from `.env.local`).

## Architecture

- The whole app is one client page: `src/app/page.tsx`. Central state and every open/close action live in `src/components/study/hooks/useStudySpaceState.ts`; new features must be threaded through it, then rendered in both layouts.
- Desktop/mobile split at 640px (`useIsMobile`): `StudyDesktopLayout` vs `StudyMobileLayout`. Mobile navigation is a stack (`useMobileStack`) mapped onto sheet flags by `syncScreenToStates`; do not add a second mobile state machine.
- Persistence is localStorage-first. Every key lives in `src/lib/storage-keys.ts`; never hardcode key strings. `src/lib/simple-cloud-sync.ts` mirrors the entire user workspace as a snapshot document (Save Game Document mode) to D1 via `workers/data-api` (`GET/POST /data`, ~2s debounce, offline auto-recovery, wipe on logout) and deliberately excludes machine-specific keys.
- Scenes, sounds and tracks are JSON in `src/data/assets/`, typed in `src/components/study/study-types.ts`. Asset URLs must go through `src/lib/asset-resolver.ts` (CDN env or `/study` fallback). `public/study/` is ~465 MB and gitignored, so never assume it exists in CI.
- `/admin` and everything under `/api/*` are dev-only tools guarded by `NODE_ENV === "development"`; they are not part of the static export. `/admin/scenes` edits `src/data/assets/scenes.json` and writes media into `public/study`.
- `workers/` are standalone Cloudflare Workers deployed by pasting into the dashboard - not built by Next. Backend setup order is in `docs/DEPLOY.md`; D1 schema and API are in `docs/CLOUD_SYNC_GUIDE.md`, `docs/CLOUD_SYNC_PLAN.md` and `workers/schema.sql`.
- Missing `NEXT_PUBLIC_*` Firebase/CDN/worker URLs degrade the app to local-only. `src/lib/firebase-config.ts` exists so the Firebase SDK is only imported when configured.

## Conventions

- UI copy and code comments are Vietnamese; write new ones in Vietnamese.
- Tailwind v4 is CSS-first: semantic tokens live in `src/app/styles/tokens.css` (`panel`, `line`, `accent-*`). Prefer them over raw palette colors. Admin has its own spec in `src/app/admin/DESIGN.md`; mobile UI must follow `docs/mobile-style-guide.md`.
- No `!important` outside the allowed marker blocks (enforced by `npm run lint:css`).
- ESLint intentionally disables `no-explicit-any`, `react-hooks/exhaustive-deps` and `react-hooks/set-state-in-effect`; do not "fix" that config.
- Tests run in Node by default. Add `// @vitest-environment happy-dom` as the first line when a test needs DOM APIs.
- The `sm:` breakpoint in Tailwind and `useIsMobile` are both 640px; keep mobile/desktop behavior aligned with that value.

## Deploy

- Push to `main` builds the static export and deploys to GitHub Pages. Assets come from `NEXT_PUBLIC_STUDY_CDN_URL` (R2) and the subpath from `NEXT_PUBLIC_BASE_PATH`. Cloudflare Pages uses the same export path via `CF_PAGES`.
- `NEXT_PUBLIC_*` values are baked at build time; changing them requires a rebuild. `.env.local` is gitignored - worker secrets belong in Cloudflare, never in this repo.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
