# Solo Leveling Quest

A dark anime-inspired daily quest RPG that turns workouts, coding, and personal routines into progression, hunter ranks, streaks, and weekly boss raids.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `uv run uvicorn backend.solo_leveling_api.main:app --host 0.0.0.0 --port 8000 --reload` — run the separate Python API

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/solo-leveling-quest/` — Expo mobile client
- `artifacts/solo-leveling-quest/context/QuestContext.tsx` — offline-first quest, progression, reminders, and penalty state
- `backend/solo_leveling_api/main.py` — FastAPI persistence/progression contract

## Architecture decisions

- The mobile client is offline-first so quest completion remains usable without a network connection.
- Clerk owns accounts and sessions; the Python service accepts Clerk bearer tokens at its protected boundary.
- Native social-app blocking is intentionally not claimed in the first build. The penalty is an in-app 24-hour lockdown with streak reset and XP loss.

## Product

- Daily preset and custom quests with per-quest weekday scheduling
- Hunter rank, level, XP, STR/INT/STAMINA/DISCIPLINE stats, streaks, titles, and weekly boss raid rewards
- Morning and evening notification scheduling
- Rest day planning and an in-app lockdown penalty that explains the manual/native-blocking roadmap

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
