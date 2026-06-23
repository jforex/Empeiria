"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EconomyMap from "../components/EconomyMap";

type Tier = "simple" | "detailed" | "analysis";
const TIERS: { id: Tier; label: string; price: number; desc: string }[] = [
  { id: "simple", label: "Simple", price: 0.01, desc: "A quick, direct answer" },
  { id: "detailed", label: "Detailed", price: 0.03, desc: "A thorough, practical answer" },
  { id: "analysis", label: "Analysis", price: 0.05, desc: "Deep strategic analysis" },
];

type Paid = { name: string; agent: string; amount: number; pct: number; tx: string | null };
type Done = { answer: string; paid: Paid[]; spent: number; platformFee: number; refunded: number; tier: string };

type FeedItem =
  | { kind: "info"; text: string; sub?: string }
  | { kind: "pay"; name: string; agent: string; amount: number; pct: number; tx: string | null };

export default function Marketplace() {
  const [question, setQuestion] = useState("");
  const [tier, setTier] = useState<Tier>("detailed");
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"mesh" | "direct" | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [done, setDone] = useState<Done | null>(null);
const [error, setError] = useState<string | null>(null);
const [creators, setCreators] = useState<{ handle: string; name: string; agentLabel: string; category: string; avatarUrl: string | null }[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [pulses, setPulses] = useState<{ id: number; from: string; to: string; kind: "pay" | "data" }[]>([]);
  const lightNode = (...ids: string[]) => setActiveNodes((prev) => { const n = new Set(prev); ids.forEach((i) => n.add(i)); return n; });
  const firePulse = (from: string, to: string, kind: "pay" | "data") => {
    const id = Date.now() + Math.random();
    setPulses((p) => [...p, { id, from, to, kind }]);
    setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 1400);
  };

  useEffect(() => {
    fetch("/api/creators").then((r) => r.json()).then((d) => { if (d.ok) setCreators(d.creators); }).catch(() => {});
  }, []);
  const esRef = useRef<EventSource | null>(null);

function reset() {
    setRunning(false); setMode(null); setTarget(null); setAnswer(""); setFeed([]); setDone(null); setError(null);
    setActiveNodes(new Set()); setPulses([]);
    esRef.current?.close();
  }
  function ask() {
    if (!question.trim()) return;
    reset();
    setRunning(true);
    const url = `/api/creator-ask/stream?q=${encodeURIComponent(question)}&tier=${tier}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      switch (evt.type) {
    case "start": setMode(evt.mode); lightNode("asker", "escrow"); firePulse("asker", "escrow", "pay"); break;
        case "direct_target": setTarget(evt.name); setFeed((f) => [...f, { kind: "info", text: `Asking ${evt.name}'s agent directly`, sub: `@${evt.handle} · ${evt.agent_label}` }]); break;
        case "retrieving": lightNode("router", "specialist"); firePulse("escrow", "router", "data"); firePulse("router", "specialist", "data"); setFeed((f) => [...f, { kind: "info", text: "Searching creator knowledge…" }]); break;
        case "sources": lightNode("pool"); firePulse("specialist", "pool", "data"); setFeed((f) => [...f, { kind: "info", text: `Found ${evt.count} relevant passages from ${evt.creators} creator${evt.creators > 1 ? "s" : ""}`, sub: evt.names.join(", ") }]); break;
        case "no_match": setFeed((f) => [...f, { kind: "info", text: evt.note }]); break;
        case "synthesizing": lightNode("specialist"); setFeed((f) => [...f, { kind: "info", text: "Synthesizing the answer…" }]); break;
        case "answer": setAnswer(evt.answer); break;
        case "creator_paid": lightNode("contributor"); firePulse("escrow", "contributor", "pay"); setFeed((f) => [...f, { kind: "pay", name: evt.name, agent: evt.agent, amount: evt.amount, pct: evt.pct, tx: evt.tx }]); break;
        case "done": lightNode("fees"); firePulse("escrow", "fees", "pay"); setDone(evt); setRunning(false); es.close(); break;
      }
    };
    es.onerror = () => { setRunning(false); es.close(); };
  }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/marketplace" className="active">Ask</a><a href="/create">Create</a></nav>
      </header>

      <section className="band hero">
        <div className="inner">
          <div className="eyebrow">ask the knowledge marketplace</div>
          <h1>Pay only for the<br />knowledge you use.</h1>
          <p className="lede">Ask a question and creator agents answer from real expertise. Pay a few cents — split across the creators whose knowledge helped. Tag <code>@handle</code> to ask one creator directly.</p>
        </div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          {!done && (
            <div className="ask-card lit">
              <span className="lit-border lit-gold" aria-hidden />
              <div className="ask-in">
               {creators.length > 0 && (
                  <div className="gallery">
                    <div className="gallery-label">ask a creator directly — tap one</div>
                    <div className="marquee">
                      <div className="marquee-track">
                        {[...creators, ...creators].map((c, i) => (
                          <button key={i} className="gcard" onClick={() => setQuestion(`@${c.handle} `)} disabled={running} type="button">
                            {c.avatarUrl
                              ? <img src={c.avatarUrl} alt="" className="gc-avatar" />
                              : <span className="gc-avatar gc-avatar-ph">{c.name.charAt(0).toUpperCase()}</span>}
                            <span className="gc-name">{c.name}</span>
                            <span className="gc-cat">{c.category}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <textarea className="q" rows={3} placeholder="Ask anything — or @handle to ask one creator (e.g. @startupmentor how do I price my SaaS?)" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={running} />
                <div className="tiers">
                  {TIERS.map((t) => (
                    <button key={t.id} className={`tier ${tier === t.id ? "tier-on" : ""}`} onClick={() => setTier(t.id)} disabled={running}>
                      <span className="tier-label">{t.label}</span>
                      <span className="tier-price">${t.price.toFixed(2)}</span>
                      <span className="tier-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>
                <button className="btn btn-solid ask-btn" onClick={ask} disabled={running || !question.trim()}>
                  {running ? "Working…" : `Ask · $${TIERS.find((t) => t.id === tier)!.price.toFixed(2)}`}
                </button>
                {error && <div className="err">{error}</div>}
              </div>
            </div>
          )}

          {(running || activeNodes.size > 0) && (
            <div style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
              <div className="gallery-label" style={{ marginBottom: "0.7rem" }}>the money flow, live</div>
              <EconomyMap activeNodes={activeNodes} pulses={pulses} />
            </div>
          )}

          {(running || feed.length > 0) && !done && (
            <div className="feed">
              <div className="feed-head"><span className="live-dot" /> live</div>
              <AnimatePresence initial={false}>
                {feed.map((f, i) => (
                  <motion.div key={i} className="fitem" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                    {f.kind === "pay" ? (
                      <div className="fpay">
                        <span className="fpay-icon">◆</span>
                        <div className="fpay-body">
                          <div className="fpay-name">{f.name} <span className="fpay-agent">· {f.agent}</span></div>
                          <div className="fpay-meta">earned ${f.amount.toFixed(6)} · {f.pct}% of the answer{f.tx ? ` · tx ${f.tx.slice(0, 10)}…` : ""}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="finfo"><span className="finfo-dot" /><div><div className="finfo-text">{f.text}</div>{f.sub && <div className="finfo-sub">{f.sub}</div>}</div></div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {answer && (
                <motion.div className="answer-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="answer-label">the answer</div>
                  <p>{answer}</p>
                </motion.div>
              )}
            </div>
          )}

          {done && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="answer-final">
                <div className="answer-label">the answer</div>
                <p>{done.answer || "No creator has shared knowledge on this yet — be the first to contribute."}</p>
              </div>
              {done.paid.length > 0 && (
                <div className="payout">
                  <div className="payout-head">who earned from this answer</div>
                  {done.paid.map((p, i) => (
                    <div key={i} className="prow">
                      <div className="prow-name">{p.name} <span className="prow-agent">· {p.agent}</span></div>
                      <div className="prow-right"><span className="prow-amt">${p.amount.toFixed(6)}</span><span className="prow-pct">{p.pct}%</span>{p.tx && <span className="prow-tx">tx {p.tx.slice(0, 8)}…</span>}</div>
                    </div>
                  ))}
                  <div className="psum">spent ${done.spent.toFixed(6)} · platform fee ${done.platformFee.toFixed(6)} · refunded ${done.refunded.toFixed(6)}</div>
                </div>
              )}
              <button className="btn btn-ghost" onClick={() => { setDone(null); setQuestion(""); }}>Ask another →</button>
            </motion.div>
          )}
        </div>
      </section>

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
.inner { max-width: 720px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem,5vw,3.3rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.4rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem,2vw,1.28rem); line-height: 1.6; color: #3a3446; max-width: 56ch; margin: 0; }
.lede code { font-family: ui-monospace, monospace; font-size: 0.9em; background: #f2eadb; padding: 0.1em 0.4em; border-radius: 5px; color: #6e561f; }
.ask-card { position: relative; border-radius: 18px; margin-bottom: 2rem; }
.ask-in { position: relative; z-index: 1; background: var(--paper); border-radius: 16px; padding: 1.8rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.gallery { margin-bottom: 1.4rem; }
.gallery-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; font-weight: 600; margin-bottom: 0.7rem; }
.marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.marquee-track { display: flex; gap: 0.7rem; width: max-content; animation: scroll 38s linear infinite; }
.marquee:hover .marquee-track { animation-play-state: paused; }
@keyframes scroll { to { transform: translateX(-50%); } }
.gcard { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; padding: 0.9rem 1rem; min-width: 110px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; cursor: pointer; transition: transform 0.12s, border-color 0.12s; }
.gcard:hover { transform: translateY(-3px); border-color: var(--gold); }
.gc-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
.gc-avatar-ph { display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--paper); font-family: Newsreader, Georgia, serif; font-size: 1.3rem; }
.gc-name { font-size: 0.85rem; font-weight: 600; color: var(--ink); white-space: nowrap; }
.gc-cat { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold); font-weight: 600; }
.q { width: 100%; border: 1px solid var(--line);
.q:focus { border-color: var(--gold); }
.tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin-bottom: 1.3rem; }
.tier { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.9rem; border-radius: 12px; border: 1.5px solid var(--line); background: var(--paper); cursor: pointer; text-align: left; transition: all 0.15s; }
.tier-on { border-color: var(--gold); border-width: 2px; background: #fbf3e0; }
.tier-label { font-weight: 600; font-size: 0.95rem; }
.tier-price { font-family: ui-monospace, monospace; color: var(--gold); font-weight: 700; font-size: 1.05rem; }
.tier-desc { font-size: 0.76rem; color: #8a8073; }
.btn { padding: 0.85rem 1.6rem; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; text-decoration: none; display: inline-block; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.ask-btn { width: 100%; }
.err { color: var(--clay); font-size: 0.9rem; margin-top: 0.9rem; }
.feed { margin-top: 1rem; }
.feed-head { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clay); animation: p 1s infinite; }
@keyframes p { 50% { opacity: 0.4; } }
.fitem { margin-bottom: 0.7rem; }
.finfo { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.7rem 0.9rem; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
.finfo-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--violet); margin-top: 0.4rem; flex-shrink: 0; }
.finfo-text { font-size: 0.95rem; color: var(--ink); }
.finfo-sub { font-size: 0.8rem; color: #8a8073; margin-top: 0.15rem; }
.fpay { display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.9rem 1rem; background: #fbf3e0; border: 1px solid #e8d9b3; border-radius: 10px; }
.fpay-icon { color: var(--gold); font-size: 1rem; }
.fpay-name { font-weight: 600; font-size: 0.98rem; }
.fpay-agent { color: #8a8073; font-weight: 400; }
.fpay-meta { font-family: ui-monospace, monospace; font-size: 0.76rem; color: #6e561f; margin-top: 0.2rem; }
.answer-live, .answer-final { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.5rem; margin: 1.2rem 0; }
.answer-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: #8a7d62; font-weight: 600; margin-bottom: 0.8rem; }
.answer-live p, .answer-final p { font-family: Newsreader, Georgia, serif; font-size: 1.18rem; line-height: 1.6; margin: 0; color: var(--ink); }
.payout { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 1.4rem; margin-bottom: 1.5rem; }
.payout-head { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.prow { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 0.6rem 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.prow-name { font-family: Newsreader, Georgia, serif; font-size: 1.05rem; }
.prow-agent { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.82rem; color: #8a8073; }
.prow-right { display: flex; align-items: baseline; gap: 0.8rem; }
.prow-amt { font-family: ui-monospace, monospace; color: var(--gold); font-weight: 700; }
.prow-pct { font-family: ui-monospace, monospace; font-size: 0.8rem; color: #8a8073; }
.prow-tx { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--violet); }
.psum { font-family: ui-monospace, monospace; font-size: 0.78rem; color: #8a8073; margin-top: 0.9rem; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 720px; margin: 0 auto; }
@media (max-width: 620px) { .tiers { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
