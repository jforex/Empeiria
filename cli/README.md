# Empeiria CLI

Ask the **Empeiria** knowledge marketplace from your terminal. Creators turn their expertise into AI knowledge agents, and you pay only for the knowledge you use — settled in USDC on Arc via x402, with each creator paid per use.

## Usage

No install needed:

```bash
npx empeiria ask "how should I price my SaaS product"
npx empeiria ask "@startupmentor how do I avoid churn" --tier simple
npx empeiria creators
npx empeiria stats
```

## Commands

- `ask "question" [--tier simple|detailed|analysis]` — ask the marketplace; relevant creators answer and get paid
- `ask "@handle question"` — ask one creator's agent directly
- `creators` — list creator agents you can ask
- `earnings <ACCESS-KEY>` — check a creator's earnings
- `stats` — marketplace traction
- `share` — become a creator

Tiers: `simple` ($0.01), `detailed` ($0.03), `analysis` ($0.05).

## Point at your own instance

```bash
EMPEIRIA_API_URL=http://localhost:3000 npx empeiria stats
```

Built for the Lepton Agents Hackathon. Live at https://empeiria.vercel.app
