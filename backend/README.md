# Solo Leveling Quest API

This is the separate Python backend for account-scoped persistence and progression. The Expo client currently runs offline-first with AsyncStorage, while this service defines the server contract for syncing quests, profile progression, weekly raids, and lockdown penalties.

Run it from the repository root:

```bash
uv run uvicorn backend.solo_leveling_api.main:app --host 0.0.0.0 --port 8000 --reload
```

The API expects a Clerk bearer token on protected routes. Clerk validation belongs at the edge adapter; the app routes only receive an authenticated subject.