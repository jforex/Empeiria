
## ── LEPTON TRACTION PHASE (judged on traction during window) ──
Judging: product + TRACTION updates made during the window. No squashing commits
(the log is evidence). Use the CLI extensively — show a clear pattern of traction +
user onboarding/engagement.

Plan:
1. Empeiria CLI — real, npx-installable: `ask`, `share`, `earnings` streaming the
   live agent economy in the terminal. Hits APIs at empeiria.vercel.app.
2. Onboarding polish on web (convert visitors, retention loop).
3. Commit frequently + clearly. Drive real usage.

## Two ask modes (NEW)
- MESH (default): question -> all relevant creator chunks -> combine -> pay each per use.
- DIRECT (@handle tag): question -> one creator's chunks only -> that creator answers + earns.
- Same engine; direct mode filters chunks by creator_id (match_creator_chunks filter_creator param).

## PIVOT 2 — GitHub repo agents (full pivot)
Empeiria is now: connect a GitHub repo -> it becomes an AI agent that answers
questions about the codebase -> the maintainer earns per use (USDC on Arc via x402).
Targets the GitHub/OSS community (organizers pushed for real-community traction).

Locked decisions:
- FULL pivot to repos. Retire manual-creator framing (the engine stays; the framing changes).
- Reframe IN PLACE: /create becomes the repo-connect flow; landing + profile reframed.
- One agent per repo (repo = creator row, is_repo=true). Maintainer = the wallet that earns.
- Manual re-sync (re-connect repo re-ingests). Auto-sync webhook DEFERRED.
- Pitch: "Turn your repository into an AI teammate." Sub-agents (Docs/Security/etc) = vision, build ONE only if time.

Working core (proven): repo ingest (GitHub API -> chunk docs+source -> embed),
ask the repo agent about its own code, maintainer paid per use. Throttled embeds
(1200ms) + MAX_FILES=20 to respect Gemini rate limits.
