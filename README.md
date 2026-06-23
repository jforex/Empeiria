# Empeiria

**A decentralized knowledge marketplace where creators turn their expertise into paid AI agents — and you pay only for the knowledge you use.**

Creators upload their writing, talks, and notes. Empeiria builds them into AI knowledge agents. When someone asks a question, a network of autonomous agents retrieves the most relevant creator knowledge, synthesizes an answer, and settles micropayments to each creator in USDC on Arc — paid the moment their knowledge is used. No subscriptions. No middleman taking the value. Creators earn per use; askers pay per answer.

🔗 **Live:** https://empeiria.vercel.app
⛓️ **Settlement:** USDC on Arc Testnet, via Circle Gateway + x402 micropayments

---

## Try it in one command

No install, no signup — hit the live economy from your terminal:

```bash
npx empeiria ask "how do I price my SaaS product"
```

Watch creators get paid in real time as their knowledge answers your question. More:

```bash
npx empeiria ask "@startupmentor how do I avoid churn"   # ask one creator directly
npx empeiria creators                                     # browse creator agents
npx empeiria stats                                        # marketplace traction
```

📦 **npm:** https://www.npmjs.com/package/empeiria

---

## Why this exists

The creator economy is broken. Creators are forced into subscriptions, ads, sponsorships, and paywalls. Users often need just *one* answer — and don't want a $20/month subscription for occasional value. Meanwhile, AI companies train on creator knowledge and compensate the creators nothing.

Empeiria fixes the unit of exchange: **knowledge is rented, one answer at a time.** A creator's content becomes an agent that earns micropayments per use. Users pay cents for exactly what helps them. Creators keep ownership — their knowledge is never transferred, only consulted.

---

## How it works

**Creators build agents.** A creator signs up, uploads content (text or audio — audio is transcribed by a paid Transcription agent), and it's chunked, embedded, and stored as their knowledge agent. One creator, one growing agent.

**Two ways to ask:**
- **Mesh mode** (default) — the question is matched across *all* creators; the most relevant knowledge is blended into one answer, and every contributing creator is paid their share.
- **Direct mode** (`@handle`) — tag a creator to ask their agent alone; only they answer and earn.

**Tiered pricing.** Simple ($0.01), Detailed ($0.03), Analysis ($0.05). The price is held, spent down across the creators whose knowledge is used, and any remainder is refunded. The platform takes a 10% fee.

**Transparent payouts.** Every answer shows exactly who contributed, what percentage, and what they earned — with payment references. Creators withdraw their balance to their own wallet as a real on-chain USDC transfer.

---

## On-chain proof

Creator earnings settle and withdraw as real USDC on Arc Testnet — independently verifiable on the explorer. Example withdrawal (creator → their wallet):

- **Tx:** `0xe1032b9634c12206f372bb086857360daff947591b9581d47262d54751e391a1`
- **Explorer:** https://testnet.arcscan.app

USDC is native on Arc; transfers use the system contract at `0x3600000000000000000000000000000000000000`.

---

## Architecture

CREATOR SIDE ASK SIDE
┌─────────┐ upload (text/audio) ┌────────┐ budget (tier) ┌──────────────┐
│ Creator │ ───────────────────▶ │ Asker │ ──────────────▶ │ Escrow ledger│
└────┬────┘ └────────┘ └──────┬───────┘
│ chunk + embed │ retrieve
▼ ▼
┌──────────────┐ match across creators ┌─────────────────────────────┐
│ Knowledge │ ◀──────────────────────────────── │ Mesh (cross-creator search) │
│ Pool (vectors)│ └──────────────┬──────────────┘
└──────────────┘ │ synthesize + pay
▼
┌──────────────────────────────────────────┐
│ each contributing creator paid via x402 │
│ (weighted share) · 10% platform fee │
│ · remainder refunded · USDC on Arc │
└──────────────────────────────────────────┘

**Stack:** Next.js 16 (Turbopack) · Supabase + pgvector · Groq (Llama 3.3 70B synthesis, Whisper transcription) · Gemini embeddings (768-dim) · Circle Gateway + x402 on Arc Testnet · viem.

---

## The CLI

Published to npm as [`empeiria`](https://www.npmjs.com/package/empeiria). Live API by default; point it at any instance with `EMPEIRIA_API_URL`.

| Command | What it does |
|---|---|
| `ask "question" [--tier ...]` | Ask the marketplace; creators answer and get paid |
| `ask "@handle question"` | Ask one creator's agent directly |
| `creators` | List creator agents |
| `earnings <ACCESS-KEY>` | Check a creator's earnings |
| `stats` | Marketplace traction totals |
| `share` | Become a creator |

---

## Key surfaces

- `/` — the marketplace + live creator grid
- `/create` — creator onboarding (profile, avatar, upload) + returning-creator dashboard (earnings, withdraw)
- `/marketplace` — ask the marketplace (mesh or @handle), live payout stream
- `/creator/[handle]` — a creator's public profile (shareable, doubles as discovery)

---

## Honest notes

- **Testnet.** All settlement is on Arc Testnet with test USDC.
- **Custodial (for now).** Creator wallets are platform-custodied; earnings are a ledger claim paid out from the platform treasury on withdrawal — real USDC, real on-chain transfer to the creator's own address. A non-custodial settlement path (USDC settled directly into each creator's wallet per payment) is the natural next step.
- **Built for the Lepton Agents Hackathon.**
