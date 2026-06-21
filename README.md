# Empeiria

**An autonomous knowledge marketplace driven by x402 agentic payments.**

People anonymously share lived experience — by writing or by voice. When someone else asks a question, a network of autonomous agents routes it, competes to do the work, judges which experiences genuinely help, synthesizes an answer, and settles payment to the contributors in USDC on Arc — all without a human in the loop. Contributors earn the moment their experience is used, into private wallets, under no name.

🔗 **Live:** https://empeiria.vercel.app
⛓️ **Settlement:** USDC on Arc Testnet, via Circle Gateway + x402 micropayments

---

## Why this exists

The hardest things a person comes through — losing money, surviving burnout, leaving a relationship — are worth real money to someone facing them now. But the people who lived them have no way to be paid for that knowledge, and no way to share it without exposing themselves.

Empeiria turns lived experience into a paid, anonymous, agent-run market. The contributor never negotiates, never sets a price, never reveals who they are. Autonomous agents do all the economic work: pricing, judging, paying, and refunding.

---

## What the agents decide (no human in the loop)

Empeiria is built around real autonomous economic decisions, not scripted flows:

- **Which resources are worth paying for** — a Router agent weighs each Specialist's price against its reputation before paying.
- **How to allocate a budget across services** — a sequential escrow ledger spends a query's budget down step by step, checking what remains before each payment and refusing anything it can't afford.
- **When to cache vs. re-fetch paid work** — if a near-identical question was judged recently, the system reuses that paid judgment instead of paying again, and refunds the saving to the asker.
- **Quality vs. price between competing providers** — multiple Specialist agents bid on each question; the Router picks the best value (lowest price-per-reputation) and the bidding is shown live.

---

## Architecture

```
                          ASK SIDE
   ┌────────┐   budget    ┌────────┐   routes    ┌──────────┐
   │ Asker  │ ─────────▶ │ Escrow │ ─────────▶ │  Router  │
   └────────┘  (USDC cap) └────────┘             └────┬─────┘
                                                       │ runs a market
                                          ┌────────────┴────────────┐
                                          ▼     (specialists bid)    ▼
                                   ┌─────────────┐           ┌─────────────┐
                                   │ Specialist  │  ...      │ Specialist  │
                                   │   (Vega)    │           │  (Orion)    │
                                   └──────┬──────┘           └─────────────┘
                                          │ Router pays best value (x402)
                                          ▼ judges relevance / reuses cache
                                   ┌─────────────┐
                                   │ Experience  │  ◀── anchored on Arc
                                   │    Pool     │
                                   └──────┬──────┘
                                          │ pays per use (x402)
                                          ▼
                                   ┌─────────────┐  referral cut   ┌──────┐
                                   │ Contributor │ ──────────────▶ │ Con  │
                                   └─────────────┘                 └──────┘
                          ─────────────────────────────────────────────────
                          CONTRIBUTE SIDE (voice)
   ┌────────┐   audio    ┌──────────────┐  pays (x402)  ┌──────────────────┐
   │ Speaker│ ─────────▶│  Fees Agent  │ ────────────▶ │ Transcription Ag.│
   └────────┘            └──────────────┘  (priced by    └────────┬─────────┘
                          judges fairness   length/load)           │ Whisper
                                                                    ▼
                                                            ┌──────────────┐
                                                            │ Gate Agent   │ verifies it's
                                                            └──────┬───────┘ real lived experience
                                                                   ▼
                                                            Experience Pool
```

### The agents

| Agent | Role |
|-------|------|
| **Router** | Classifies the question, runs the specialist market, pays the winner, orchestrates the budget ledger. |
| **Specialists** | Compete per domain with their own price + reputation. Judge each experience for relevance. Reputation accrues from work. |
| **Contributors** | Anonymous authors of experiences. Paid per use, proportional to how much they shaped the answer. |
| **Cons** | Representative agents that onboard contributors and take a referral cut from their earnings. |
| **Fees Agent** | Pays for external services (transcription) and refuses overcharging — judging fairness, not raw price. |
| **Transcription Agent** | A paid external service that prices itself by audio length, congestion, and reputation. |
| **Gate Agent** | Verifies every submission is genuine first-person lived experience before it enters the pool. |

---

## The economic loop (a real query, end to end)

1. **Escrow.** A question arrives with a USDC budget cap, held in escrow.
2. **Routing.** The Router classifies the domain and opens it to competing Specialists.
3. **Bidding.** Each Specialist quotes a price (effort × scarcity × reputation). The Router picks the best value and pays it via x402.
4. **Judgment — or cache.** The paid Specialist judges each experience for relevance. If a near-identical question was judged recently, it reuses that work for free and refunds the saving.
5. **Synthesis.** An answer is written using only the experiences that survived judgment.
6. **Payout.** The escrow is spent down sequentially — highest-contribution experiences first, each gated by the running balance. Contributors are paid; their Con takes a referral cut; a platform fee is taken; the remainder is refunded to the asker.

Every payment is a real settlement, surfaced live in the UI as it happens.

---

## On-chain provenance

Every accepted experience is anchored on Arc: the platform writes a real transaction whose calldata carries `keccak256(story) + contributor address`, creating a permanent, tamper-proof link between an anonymous contributor and their exact words — provenance without identity.

**Verifiable anchor transactions (Arc Testnet):**
- `0xa0342285efde8d9dc42c967a8429cbe16da2af480f90af724141423579268bdb`
- `0x0734fff7130fb9183770cdebbe23f7e8c466c00ae17ef77e9d54f55446115a64`

> View on the Arc Testnet explorer. (Payments between agents settle through Circle Gateway's batched x402 layer, which aggregates many sub-cent micropayments into on-chain settlements — the mechanism that makes paying per-use economically viable.)

---

## Mapping to the hackathon RFBs

**RFB 01 — Autonomous agents that pay for resources.**
The Router and Fees agents make real cost-vs-value decisions, allocate a budget across services with a sequential ledger, cache vs. re-fetch paid work, and choose between competing providers on price and quality — settling every decision on-chain.

**RFB 03 — Agent-to-agent networks with pricing and fairness.**
Specialists form a live market: they bid, accrue reputation, and win or lose work on value. The Fees Agent enforces fairness by refusing overcharging. Cons add a representative/referral layer. Pricing emerges from supply, demand, and reputation, not fixed rates.

**RFB 06 — Anonymous creator monetization.**
Contributors earn into private wallets with only a claim key — no account, no name. They never set a price or negotiate; agents handle all of it. On-chain anchoring proves authorship without revealing identity.

---

## Stack

- **Frontend / orchestration:** Next.js (App Router), TypeScript, server-sent events for the live agent stream
- **Payments:** Circle Gateway + x402 micropayments, forked from `circlefin/arc-nanopayments`
- **Chain:** Arc Testnet (USDC-native, sub-second finality) — network `eip155:5042002`
- **Data / vectors:** Supabase (Postgres + pgvector)
- **LLM:** Groq (Llama 3.3 70B) for classification, judgment, synthesis
- **Embeddings:** Google `gemini-embedding-001` (768-dim) for retrieval + cache similarity
- **Transcription:** Groq Whisper large-v3
- **Provenance:** viem, direct Arc transactions

---

## Run it locally

```bash
git clone https://github.com/jforex/Empeiria.git
cd Empeiria
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Required environment (see `.env.example`):
- Supabase URL + service role / publishable keys
- Groq API key (chat + Whisper)
- Google AI Studio key (embeddings)
- Arc Testnet buyer/seller wallet keys + Circle Gateway config
- `BASE_URL` (agents call the app's own API routes)

---

## A note on honesty

Everything here settles for real — real Whisper transcription, real autonomous pricing, real on-chain anchors, real USDC payouts. Nothing is simulated. The escrow is logical accounting (held / released / refunded), framed as escrow accounting rather than a smart-contract lock. Storage policies are permissive for the testnet demo and would be tightened for production. The Transcription Agent is paid for work it actually performs even if the content is later rejected by the Gate — defensible, like paying a translator regardless of what the document says.

---

Built for the Lepton Agents Hackathon.
