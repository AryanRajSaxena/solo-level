# Solo Leveling Quest API

This is the separate Python backend for account-scoped persistence and progression. The Expo client currently runs offline-first with AsyncStorage, while this service defines the server contract for syncing quests, profile progression, weekly raids, and lockdown penalties.

Run it from the repository root:

```bash
uv run uvicorn backend.solo_leveling_api.main:app --host 0.0.0.0 --port 8000 --reload
```

The API expects a Supabase access token in the `Authorization: Bearer <token>` header on protected routes. It validates the token with the configured Supabase project's Auth service, so its signing-key configuration remains the source of truth.

## Progression and raid rules

- XP to the next level is `1,000 + ((current level - 1) × 100)`.
- Rank thresholds are D8, C15, B25, A35, and S50.
- A quest awards XP and one point to its primary stat only.
- Rest days are excluded from streak and raid requirements.
- The weekly raid snapshots every quest scheduled during that week and requires two completions for each. A background evaluator runs once per minute, closes an ended week once, stores `PASSED` or `FAILED`, and rolls the next raid. Claiming a passed raid is idempotent.
- Lockdown is intentionally zero-mercy for illness or travel: the standard 24-hour penalty is applied without a grace token.
