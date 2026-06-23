#!/usr/bin/env node
/**
 * Empeiria CLI — ask the knowledge marketplace from your terminal.
 * Creators answer from their own expertise and get paid per use, on-chain (USDC on Arc).
 *
 * Live by default; override with EMPEIRIA_API_URL for local/forked instances.
 */

const API = process.env.EMPEIRIA_API_URL || "https://empeiria.vercel.app";

// ── tiny ansi helpers (no deps) ──
const c = {
  gold: (s) => `\x1b[38;5;179m${s}\x1b[0m`,
  ink: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[38;5;71m${s}\x1b[0m`,
  violet: (s) => `\x1b[38;5;104m${s}\x1b[0m`,
  red: (s) => `\x1b[38;5;167m${s}\x1b[0m`,
};

function banner() {
  console.log(c.gold("\n  ❦ EMPEIRIA") + c.dim("  — a knowledge marketplace where creators get paid per use\n"));
}

async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── ask: stream the live SSE ──
async function ask(args) {
  const tierFlag = args.indexOf("--tier");
  let tier = "detailed";
  if (tierFlag !== -1 && args[tierFlag + 1]) { tier = args[tierFlag + 1]; args.splice(tierFlag, 2); }
  const question = args.join(" ").trim();
  if (!question) { console.log(c.red("  Usage: empeiria ask \"your question\" [--tier simple|detailed|analysis]")); return; }

  banner();
  console.log(c.ink("  Q  ") + question);
  console.log(c.dim(`     tier: ${tier}\n`));

  const url = `${API}/api/creator-ask/stream?q=${encodeURIComponent(question)}&tier=${tier}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) { console.log(c.red(`  request failed: ${res.status}`)); return; }

  // parse SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let answer = "";
  const paid = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      let evt; try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
      switch (evt.type) {
        case "direct_target": console.log(c.violet(`  →  asking ${evt.name}'s agent directly (@${evt.handle})\n`)); break;
        case "retrieving": process.stdout.write(c.dim("  ·  searching creator knowledge…\n")); break;
        case "sources": console.log(c.dim(`  ·  found ${evt.count} passages from ${evt.creators} creator(s): ${evt.names.join(", ")}\n`)); break;
        case "no_match": console.log(c.red(`  ✕  ${evt.note}\n`)); break;
        case "synthesizing": process.stdout.write(c.dim("  ·  synthesizing…\n")); break;
        case "answer": answer = evt.answer; break;
        case "creator_paid": paid.push(evt); console.log(c.green(`  ◆  ${evt.name}`) + c.dim(` · ${evt.agent} — earned $${evt.amount.toFixed(6)} (${evt.pct}%)`) + (evt.tx ? c.dim(` · tx ${String(evt.tx).slice(0, 12)}…`) : "")); break;
        case "done":
          console.log("\n" + c.ink("  A  ") + (answer || evt.answer || "(no answer)").replace(/\n/g, "\n     "));
          console.log("");
          console.log(c.dim(`     spent $${(evt.spent ?? 0).toFixed(6)} · platform fee $${(evt.platformFee ?? 0).toFixed(6)} · refunded $${(evt.refunded ?? 0).toFixed(6)}`));
          console.log(c.dim(`     settled in USDC on Arc via x402\n`));
          return;
        case "error": console.log(c.red(`\n  error: ${evt.message}\n`)); return;
      }
    }
  }
}

// ── creators: list the marketplace ──
async function creators() {
  banner();
  const d = await getJSON("/api/creators");
  if (!d.creators?.length) { console.log(c.dim("  No creators yet. Be the first: empeiria share\n")); return; }
  console.log(c.ink("  Creator agents you can ask:\n"));
  for (const cr of d.creators) {
    console.log("  " + c.gold(cr.agentLabel) + c.dim(` · @${cr.handle} · ${cr.category}`));
    if (cr.tagline) console.log("    " + c.dim(cr.tagline));
    console.log("    " + c.dim(`by ${cr.name} — $${cr.earned.toFixed(4)} earned · ${cr.chunks} chunk(s)`));
    console.log(c.dim(`    ask: empeiria ask "@${cr.handle} <question>"\n`));
  }
}

// ── earnings: a creator's earnings via access key ──
async function earnings(args) {
  const key = (args[0] || "").trim();
  if (!key) { console.log(c.red("  Usage: empeiria earnings <ACCESS-KEY>")); return; }
  banner();
  const res = await fetch(`${API}/api/creator/access`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey: key }),
  });
  const d = await res.json();
  if (!res.ok) { console.log(c.red(`  ${d.error || "not found"}`)); return; }
  console.log("  " + c.gold(d.agentLabel) + c.dim(` · @${d.handle}`));
  console.log("  " + c.ink(`$${(d.totalEarned ?? 0).toFixed(4)}`) + c.dim(" earned and available to withdraw"));
  console.log(c.dim(`  withdraw at ${API}/create (paste your access key)\n`));
}

// ── stats: marketplace traction ──
async function stats() {
  banner();
  const d = await getJSON("/api/stats");
  console.log(c.ink("  Marketplace stats\n"));
  console.log("  " + c.gold(String(d.creators)) + c.dim("  creator agents"));
  console.log("  " + c.gold(String(d.knowledgeChunks)) + c.dim("  knowledge chunks"));
  console.log("  " + c.gold(String(d.questionsAsked)) + c.dim("  questions asked"));
  console.log("  " + c.gold(`$${(d.totalEarnedUsdc ?? 0).toFixed(4)}`) + c.dim("  earned by creators"));
  console.log("  " + c.gold(`$${(d.totalPaidOutUsdc ?? 0).toFixed(4)}`) + c.dim("  paid out on-chain\n"));
}

function share() {
  banner();
  console.log(c.ink("  Turn your knowledge into a paid AI agent:\n"));
  console.log("  " + c.gold(`${API}/create`));
  console.log(c.dim("  Upload your writing or audio — your agent earns every time it helps someone.\n"));
}

function help() {
  banner();
  console.log(c.ink("  Commands\n"));
  console.log("  " + c.gold("ask") + c.dim(" \"question\" [--tier simple|detailed|analysis]   ask the marketplace"));
  console.log("  " + c.gold("ask") + c.dim(" \"@handle question\"                            ask one creator directly"));
  console.log("  " + c.gold("creators") + c.dim("                                          list creator agents"));
  console.log("  " + c.gold("earnings") + c.dim(" <ACCESS-KEY>                              check a creator's earnings"));
  console.log("  " + c.gold("stats") + c.dim("                                             marketplace traction"));
  console.log("  " + c.gold("share") + c.dim("                                             become a creator"));
  console.log(c.dim(`\n  API: ${API}  (override with EMPEIRIA_API_URL)\n`));
}

const [cmd, ...rest] = process.argv.slice(2);
(async () => {
  try {
    switch (cmd) {
      case "ask": await ask(rest); break;
      case "creators": case "browse": await creators(); break;
      case "earnings": await earnings(rest); break;
      case "stats": await stats(); break;
      case "share": share(); break;
      case undefined: case "help": case "--help": case "-h": help(); break;
      default: console.log(c.red(`  unknown command: ${cmd}`)); help();
    }
  } catch (e) {
    console.log(c.red(`  error: ${e.message}`));
  }
})();
