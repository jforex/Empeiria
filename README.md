# Empeiria

**Turn your GitHub repository into a paid AI teammate.**

Connect any repo and Empeiria reads its docs and source to build an agent that answers questions about the codebase — architecture, onboarding, implementation, integration. Developers pay a few cents per answer; the maintainer earns every time their repo helps someone. Settled in USDC on Arc via x402 micropayments.

🔗 **Live:** https://empeiria.vercel.app
📦 **CLI:** https://www.npmjs.com/package/empeiria
⛓️ **Settlement:** USDC on Arc Testnet · Circle Gateway + x402

---

## Ask any repo from your terminal

```bash
# inside a git repo — it auto-detects and asks THIS repo
npx empeiria ask "how does the auth middleware work"

# or target any connected repo directly
npx empeiria ask "@jforex-empeiria how does the x402 payment flow work"
```

The repo's agent answers from its real code, and the maintainer is paid on-chain — live, in your terminal.

---

## The problem

Open-source maintainers answer the same questions over and over — in issues, in Discord, in DMs — for free. Documentation goes stale. New contributors can't find their footing. And the people who built and maintain the code earn nothing for the knowledge they keep giving away.

Empeiria turns a repository into an agent that handles those questions *and* pays the maintainer for it. The code becomes a teammate that's always available, and every answer is revenue for work already shipped.

---

## How it works

**Connect a repo.** Paste a GitHub URL. Empeiria pulls the repo's docs and source via the GitHub API, chunks and embeds them (each chunk tagged with its file path), and stands up an agent that knows the codebase. It also auto-registers a GitHub webhook so the agent **re-syncs automatically on every push** — your teammate is never out of date.

**Ask it anything.** Tag `@owner-repo` to ask a specific repo, or — from the CLI inside a git project — just ask and it targets the current repo automatically. The agent retrieves the most relevant files, synthesizes an answer, and cites where in the repo it came from.

**The maintainer earns.** Each answer settles a micropayment in USDC on Arc to the repo's wallet. Tiered pricing — simple ($0.01), detailed ($0.03), analysis ($0.05) — with a 10% platform fee. Empty or failed answers are never charged: the asker is refunded in full.

**Withdraw on-chain.** Maintainers withdraw their balance to their own wallet as a real USDC transfer, verifiable on the Arc explorer.

**One identity, all your repos.** Sign in with GitHub — no passwords, no per-repo keys. Every repo you connect is grouped under your GitHub identity, with **pooled earnings** across all of them and a single withdrawal. Your dashboard loads your repos automatically.

---

## Agent economy — agents that pay agents

A repo agent doesn't just earn — it can **spend** its earnings hiring specialist agents to do deeper work. Each is a real agent-to-agent payment, settled on-chain via x402. Live today:

- **Documentation Agent** — reads the repo's code and generates structured Markdown docs (overview, key modules, setup, API surface). The repo agent pays it $0.02 per run.
- **Dependency Agent** — fetches the repo's current manifests and queries **npm and PyPI live** to flag dependencies that are a major version behind, reporting declared-vs-latest with real registry data. The repo agent pays it $0.02 per run.
- **Testing Agent** — reads the repo's source, identifies key exports that appear untested, and generates test scaffolding stubs. The repo agent pays it $0.02 per run.

Every invocation is a genuine USDC transfer between agent wallets, logged and verifiable on the Arc explorer. Anyone can trigger them from a repo's public page and watch the repo agent pay a specialist agent in real time.

**Roadmap — more specialists, same pattern:**

- **Security Agent** — surface risky patterns and dependency concerns, grounded in a real CVE/advisory source (not LLM guesses).

The thesis: open knowledge communities become *agent-native economies*, where agents transact with each other to compound value — and the humans who own the underlying work get paid at every step.

## On-chain proof

Earnings settle and withdraw as real USDC on Arc Testnet, independently verifiable:

- **Explorer:** https://testnet.arcscan.app
- USDC is native on Arc; transfers use the system contract `0x3600000000000000000000000000000000000000`.

---

## Architecture

MAINTAINER DEVELOPER
┌──────────┐ connect repo ┌───────────┐ ask (tier = budget)
│ GitHub │ ──────────────▶ │ Developer │ ───────────────▶ ┌──────────────┐
│ repo │ GitHub API └───────────┘ │ Escrow ledger│
└────┬──────┘ docs + source └──────┬───────┘
│ chunk + embed (file-tagged) │ retrieve
▼ ▼
┌──────────────────┐ most relevant files ┌─────────────────────────────┐
│ Repo knowledge │ ◀──────────────────────────────── │ Retrieval (@repo or mesh) │
│ (pgvector) │ └──────────────┬──────────────┘
└──────────────────┘ │ synthesize + cite
▼
┌────────────────────────────────────────────┐
│ maintainer paid per use via x402 │
│ 10% platform fee · empty answers refunded │
│ USDC on Arc Testnet │
└────────────────────────────────────────────┘

**Stack:** Next.js 16 (Turbopack) · Supabase + pgvector · GitHub REST API + OAuth + webhooks · Gemini embeddings (768-dim) · Groq (Llama 3.3 70B synthesis) · Circle Gateway + x402 on Arc Testnet · viem · npm + PyPI registries (live dependency checks).

---

## The CLI

Published as [`empeiria`](https://www.npmjs.com/package/empeiria). Live API by default; override with `EMPEIRIA_API_URL`.

| Command | What it does |
|---|---|
| `ask "question"` | Inside a git repo, asks **that repo** automatically |
| `ask "@owner-repo question"` | Ask a specific repo's agent |
| `ask … --tier simple\|detailed\|analysis` | $0.01 / $0.03 / $0.05 |
| `repos` | List connected repo agents |
| `connect` | Connect your GitHub repo |
| `earnings <ACCESS-KEY>` | Check a repo's earnings |
| `stats` | Live traction |

---

## Surfaces

- `/` — landing: the problem, how it works, the live agent economy, and the maintainer community
- `/create` — sign in with GitHub → your dashboard (all your repos, pooled earnings, withdraw), or connect a new repo
- `/marketplace` — ask any repo, with a live streaming feed of retrieval + on-chain payment
- `/creator/[handle]` — a repo agent's public page: GitHub link, stars, files it has read, and the three specialist agents (docs · deps · tests) anyone can trigger

---

## Honest notes

- **Testnet.** Settlement is on Arc Testnet with test USDC.
- **Custodial (for now).** Repo wallets are platform-custodied; earnings are a ledger claim paid out from the treasury on withdrawal — a real on-chain USDC transfer to the maintainer's address. Direct per-payment settlement into each repo's wallet is the natural next step.
- **Auto-sync caveat.** A push re-ingests the repo automatically via webhook. The receiver acks GitHub instantly and re-ingests in the background; for large repos the ingest runs past GitHub's 10s delivery window, so a fully queued/worker-backed pipeline is the next refinement.

