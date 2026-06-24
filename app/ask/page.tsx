"use client";

import EconomyMap from "../components/EconomyMap";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type LivePayout = { title: string; amount: number; contribution: number; tx: string | null };
type DoneData = {
  answer: string; domain: string; specialistFee: number; specialistTx?: string | null;
  spent: number; platformFee: number; refunded: number; paid: LivePayout[];
};
type FeedItem = { kind: "route" | "pay" | "judge-keep" | "judge-drop" | "write" | "info"; text: string; sub?: string };

const STAGES = ["classify", "specialist", "judge", "synthesize", "pay"] as const;
type Stage = typeof STAGES[number];

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [budget, setBudget] = useState(0.1);
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [active, setActive] = useState<Stage | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [pulses, setPulses] = useState<{ id: number; from: string; to: string; kind: "pay" | "data" }[]>([]);
  const pulseId = useRef(0);
  const [bids, setBids] = useState<{ label: string; price: number; reputation: number }[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  function lightNode(...ids: string[]) {
    setActiveNodes((prev) => { const n = new Set(prev); ids.forEach((i) => n.add(i)); return n; });
  }
  function firePulse(from: string, to: string, kind: "pay" | "data") {
    const id = ++pulseId.current;
    setPulses((p) => [...p, { id, from, to, kind }]);
    setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 1400);
  }
  const [done, setDone] = useState<DoneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  function push(item: FeedItem) {
    setFeed((f) => [...f, item]);
    setTimeout(() => feedRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 30);
  }
 function reset() { setFeed([]); setActive(null); setDomain(null); setDone(null); setError(null); setActiveNodes(new Set()); setPulses([]); setBids([]); setWinner(null); }

  function ask() {
    if (!question.trim()) return;
    reset(); setRunning(true);
    const es = new EventSource(`/api/ask/stream?q=${encodeURIComponent(question)}&budget=${budget}`);
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data);
    switch (evt.type) {
        case "start": setActive("classify"); lightNode("asker", "escrow"); firePulse("asker", "escrow", "pay"); push({ kind: "info", text: "Question received", sub: `budget $${evt.budget}` }); break;
        case "budget": push({ kind: "info", text: evt.note ?? "budget update", sub: `remaining $${(evt.remaining ?? 0).toFixed(6)}` }); break;
        case "classified": setDomain(evt.domain); lightNode("router"); firePulse("escrow", "router", "data"); push({ kind: "route", text: "Router classified the question", sub: evt.domain.toUpperCase() }); break;
        case "bid": setBids((b) => [...b, { label: evt.label, price: evt.price, reputation: evt.reputation }]); break;
        case "quote": setActive("specialist"); lightNode("specialist"); setWinner(evt.label); push({ kind: "route", text: `Router chose ${evt.label}`, sub: evt.reason ?? evt.breakdown }); break;
        case "quote": setActive("specialist"); lightNode("specialist"); push({ kind: "info", text: `${evt.label} specialist quotes $${evt.price.toFixed(6)}`, sub: evt.breakdown }); break;
        case "decision": push({ kind: "route", text: "Router decision", sub: evt.reason }); break;
        case "specialist_paid": setActive("judge"); lightNode("specialist"); firePulse("escrow", "specialist", "pay"); push({ kind: "pay", text: `Router paid the specialist`, sub: `$${evt.amount.toFixed(6)} · tx ${evt.tx?.slice(0,10)}…` }); break;
        case "retrieved": lightNode("pool"); firePulse("specialist", "pool", "data"); push({ kind: "info", text: `Specialist pulled ${evt.count} experiences to judge` }); break;
        case "judgment": push({ kind: evt.kept ? "judge-keep" : "judge-drop", text: evt.title, sub: `${evt.kept ? "kept" : "dropped"} · relevance ${evt.relevance.toFixed(2)} — ${evt.reason}` }); break;
        case "judging_done": push({ kind: "info", text: "Judging complete" }); break;
        case "synthesizing": setActive("synthesize"); lightNode("router"); push({ kind: "write", text: "Synthesizing the answer…" }); break;
        case "answer": break;
        case "out_of_budget": push({ kind: "judge-drop", text: "Out of budget", sub: evt.note }); break;
        case "payout": setActive("pay"); lightNode("contributor"); firePulse("escrow", "contributor", "pay"); push({ kind: "pay", text: `Paid contributor`, sub: `"${evt.title}" · $${evt.amount.toFixed(6)} · tx ${evt.tx?.slice(0,10)}…` }); break;
        case "con_cut": lightNode("con"); firePulse("contributor", "con", "pay"); push({ kind: "pay", text: `${evt.label} (agent) took commission`, sub: `${Math.round(evt.rate * 100)}% · $${evt.amount.toFixed(6)} · tx ${evt.tx?.slice(0,10)}…` }); break;
        case "done": lightNode("fees"); firePulse("escrow", "fees", "pay"); setDone(evt); setActive(null); setRunning(false); es.close(); break;
        case "cache_hit": lightNode("router"); push({ kind: "route", text: "Cache hit — reusing a recent judgment", sub: evt.note }); break;
        case "error": setError(evt.message); setRunning(false); es.close(); break;
      }
    };
    es.onerror = () => { setError("Connection lost"); setRunning(false); es.close(); };
  }

  const icon: Record<FeedItem["kind"], string> = {
    route: "🧭", pay: "◆", "judge-keep": "✓", "judge-drop": "✕", write: "✎", info: "·",
  };

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo1.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/ask" className="active">Ask</a><a href="/speak">Speak</a></nav>
      </header>

      <section className="band hero">
        <div className="inner">
          <div className="eyebrow">ask someone who survived it</div>
          <h1>What are you going through?</h1>
          <p className="lede">Ask in your own words. Watch the agents work — classify, pay a specialist, judge real experiences, and pay the people who helped — live, nothing hidden.</p>
          <div className="ask lit">
            <span className="lit-border" aria-hidden />
            <div className="ask-in">
              <textarea className="ask-input" rows={3}
                placeholder="e.g. My business is failing and I feel like a failure. How do I get through this?"
                value={question} onChange={(e) => setQuestion(e.target.value)} disabled={running} />
              <div className="ask-row">
                <label className="budget">you pay up to<span className="budget-prefix">$</span>
                  <input className="budget-num" type="number" min={0.02} max={1} step={0.01}
                    value={budget} disabled={running}
                    onChange={(e) => setBudget(Math.max(0.02, Math.min(1, parseFloat(e.target.value) || 0.02)))} />
                </label>
                <button className="btn btn-solid" onClick={ask} disabled={running || !question.trim()}>{running ? "Working…" : "Ask"}</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(running || feed.length > 0) && !done && (
        <section className="band band-alt">
          <div className="inner">
         <div className="flow-wrap">
              <EconomyMap activeNodes={activeNodes} pulses={pulses} />
            </div>
            {bids.length > 0 && (
              <div className="bidding">
                <div className="bidding-head">the bidding — {bids.length} specialist{bids.length > 1 ? "s" : ""} competed{winner ? `, router chose by best value` : ""}</div>
                <div className="bidding-row">
                  {bids.map((b, i) => (
                    <div key={i} className={`bid-chip ${winner === b.label ? "bid-win" : ""}`}>
                      <div className="bid-label">{b.label}{winner === b.label && <span className="bid-check"> ✓ chosen</span>}</div>
                      <div className="bid-meta"><span className="bid-price">${b.price.toFixed(6)}</span><span className="bid-rep">{b.reputation}% rep</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="feed-head"><span className="live-dot" /> live — happening now</div>
            <div className="feed" ref={feedRef}>
              <AnimatePresence initial={false}>
                {feed.map((f, i) => (
                  <motion.div key={i} className={`fitem fitem-${f.kind}`}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <span className="fitem-icon">{icon[f.kind]}</span>
                    <div className="fitem-body">
                      <div className="fitem-text">{f.text}</div>
                      {f.sub && <div className="fitem-sub">{f.sub}</div>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {running && <div className="fitem-cursor">▌</div>}
            </div>
          </div>
        </section>
      )}

      {error && <section className="band"><div className="inner err">{error}</div></section>}

      <AnimatePresence>
        {done && (
          <motion.section className="band band-alt"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inner out">
              <div className="block">
                <div className="eyebrow">the answer</div>
                <p className="answer">{done.answer || "No experience matched closely enough. Your budget was refunded."}</p>
              </div>
              {done.paid.length > 0 && (
                <div className="block">
                  <div className="eyebrow">who got paid for this answer</div>
                  {done.paid.map((p, i) => (
                    <div key={i} className="payrow">
                      <div className="paytitle">{p.title}</div>
                      <div className="paymeta">
                        <span className="amount">${p.amount.toFixed(6)}</span>
                        <span className="share">{Math.round(p.contribution * 100)}%</span>
                        {p.tx && <span className="tx">tx {p.tx.slice(0, 8)}…</span>}
                      </div>
                    </div>
                  ))}
                  <div className="totals">
                    <span>specialist ${done.specialistFee.toFixed(6)}</span>
                    <span>spent ${done.spent.toFixed(6)}</span>
                    <span>fee ${done.platformFee.toFixed(6)}</span>
                    <span>refunded ${done.refunded.toFixed(6)}</span>
                  </div>
                </div>
              )}
              <button className="btn btn-solid" onClick={reset} style={{ alignSelf: "flex-start" }}>Ask another</button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <footer className="ft"><div className="inner ft-in"><span>Settled in USDC on Arc.</span><span>Built for the Lepton Agents Hackathon.</span></div></footer>
    </div>
  );
}

const css = `
* { box-sizing: border-box; }
body { margin: 0; background: #FBF7F0; }
.pg { --ink:#1A1A2E; --paper:#FBF7F0; --gold:#B8923E; --violet:#6B5B95; --clay:#C1543A; --line:#e6ddcb; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
.hd { display: flex; justify-content: space-between; align-items: center; padding: 1.75rem clamp(1.5rem,5vw,5rem); max-width: 1100px; margin: 0 auto; }
.logo { display: inline-flex; align-items: center; gap: 0.6rem; font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; text-decoration: none; color: var(--ink); }
.logo-img { height: 34px; width: auto; display: block; mix-blend-mode: multiply; }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.7; }
.nav a:hover, .nav a.active { opacity: 1; }
.band { padding: clamp(2.5rem,6vw,4.5rem) clamp(1.5rem,5vw,5rem); }
.band-alt { background: #fff; }
.hero { padding-top: clamp(1rem,3vw,2rem); }
.inner { max-width: 760px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2rem,4.5vw,3rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.2rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.05rem,2vw,1.2rem); line-height: 1.6; color: #3a3446; max-width: 54ch; margin: 0 0 2.2rem; }
.ask { position: relative; border-radius: 18px; }
.ask-in { position: relative; z-index: 1; background: #fff; border-radius: 16px; padding: 1.2rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--violet) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.ask-input { width: 100%; border: none; outline: none; resize: vertical; font-size: 1.1rem; font-family: Newsreader, Georgia, serif; color: var(--ink); background: transparent; }
.ask-input::placeholder { color: #a99f8c; }
.ask-row { display: flex; align-items: center; justify-content: space-between; margin-top: 0.9rem; gap: 1rem; flex-wrap: wrap; }
.budget { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a8073; }
.budget-prefix { font-family: ui-monospace, monospace; color: var(--gold); font-size: 1rem; }
.budget-num { width: 4.5rem; padding: 0.35rem 0.5rem; border: 1px solid var(--line); border-radius: 8px; font-family: ui-monospace, monospace; font-size: 0.95rem; color: var(--ink); background: #fff; outline: none; }
.btn { padding: 0.75rem 1.6rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.flow-wrap { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 2rem 1.5rem; margin-bottom: 2rem; }
.bidding { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.1rem 1.3rem; margin-bottom: 2rem; }
.bidding-head { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; font-weight: 600; margin-bottom: 0.9rem; }
.bidding-row { display: flex; gap: 0.7rem; flex-wrap: wrap; }
.bid-chip { flex: 1; min-width: 150px; border: 1.5px solid var(--line); border-radius: 11px; padding: 0.7rem 0.9rem; background: var(--paper); opacity: 0.7; transition: all 0.2s; }
.bid-win { border-color: var(--gold); border-width: 2px; background: #fbf3e0; opacity: 1; box-shadow: 0 2px 10px rgba(184,146,62,0.15); }
.bid-label { font-family: Newsreader, Georgia, serif; font-size: 0.98rem; color: var(--ink); font-weight: 500; margin-bottom: 0.35rem; }
.bid-check { color: var(--gold); font-weight: 600; font-size: 0.82rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.bid-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.bid-price { font-family: ui-monospace, monospace; font-size: 0.95rem; color: var(--gold); font-weight: 600; }
.bid-rep { font-family: ui-monospace, monospace; font-size: 0.74rem; color: #8a8073; }
@media (max-width: 620px) { .bid-chip { min-width: 120px; } }
.feed-head { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clay); animation: blink 1.2s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.feed { display: flex; flex-direction: column; gap: 0.5rem; max-height: 380px; overflow-y: auto; }
.fitem { display: flex; gap: 0.85rem; align-items: flex-start; padding: 0.7rem 0.9rem; border-radius: 10px; background: var(--paper); border: 1px solid var(--line); }
.fitem-icon { font-family: ui-monospace, monospace; width: 1.4rem; height: 1.4rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.75rem; font-weight: 700; }
.fitem-route .fitem-icon { background: #ece8f2; color: var(--violet); }
.fitem-pay .fitem-icon { background: #f6f0e0; color: var(--gold); }
.fitem-judge-keep .fitem-icon { background: #e8f2ec; color: #3f8c5f; }
.fitem-judge-drop .fitem-icon { background: #f7ece8; color: var(--clay); }
.fitem-write .fitem-icon { background: #ece8f2; color: var(--violet); }
.fitem-info .fitem-icon { background: #f0ece2; color: #8a8073; }
.fitem-body { min-width: 0; }
.fitem-text { font-size: 0.95rem; color: var(--ink); font-weight: 500; line-height: 1.35; }
.fitem-sub { font-family: ui-monospace, monospace; font-size: 0.74rem; color: #6a6376; margin-top: 0.2rem; line-height: 1.4; }
.fitem-cursor { color: var(--gold); animation: blink 1s step-end infinite; font-family: ui-monospace, monospace; padding-left: 0.9rem; }
.out { display: flex; flex-direction: column; gap: 2.2rem; }
.answer { font-family: Newsreader, Georgia, serif; font-size: 1.35rem; line-height: 1.6; margin: 0; }
.payrow { display: flex; justify-content: space-between; align-items: baseline; padding: 0.75rem 0; border-bottom: 1px dashed var(--line); gap: 1rem; }
.paytitle { font-family: Newsreader, Georgia, serif; font-size: 1.05rem; }
.paymeta { display: flex; gap: 0.9rem; align-items: baseline; flex-shrink: 0; }
.amount { font-family: ui-monospace, monospace; color: var(--gold); font-weight: 600; }
.share { font-size: 0.78rem; color: #8a8073; }
.tx { font-family: ui-monospace, monospace; font-size: 0.74rem; color: var(--violet); }
.totals { display: flex; gap: 1.5rem; margin-top: 1.1rem; font-family: ui-monospace, monospace; font-size: 0.8rem; color: #8a8073; flex-wrap: wrap; }
.err { color: var(--clay); border-left: 2px solid var(--clay); padding-left: 0.8rem; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 760px; margin: 0 auto; }
@media (max-width: 620px) { .ft-in { flex-direction: column; gap: 0.5rem; } }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
