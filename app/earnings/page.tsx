"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Report = {
  found: boolean;
  totalEarned?: number;
  con?: { label: string; fee_rate: number } | null;
  experiences?: { id: string; title: string; domain: string; quality_score: number; times_surfaced: number; times_paid: number }[];
  payouts?: { amount: number; reason: string; tx: string | null; when: string }[];
};

export default function Earnings() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (!key.trim()) return;
    setLoading(true); setError(null); setReport(null);
    try {
      const res = await fetch("/api/earnings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setReport(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/ask">Ask</a><a href="/speak">Speak</a></nav>
      </header>

      <section className="band hero">
        <div className="inner">
          <div className="eyebrow">your earnings</div>
          <h1>How is your experience doing?</h1>
          <p className="lede">Enter the private claim key you got when you contributed. Your representative agent will report what you've earned — no name, no login.</p>

          <div className="check lit">
            <span className="lit-border lit-gold" aria-hidden />
            <div className="check-in">
              <input className="key-input" placeholder="EMP-XXXX-XXXX"
                value={key} onChange={(e) => setKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && check()} />
              <button className="btn btn-solid" onClick={check} disabled={loading || !key.trim()}>
                {loading ? "Asking your agent…" : "Check earnings"}
              </button>
            </div>
          </div>
          {error && <div className="err">{error}</div>}
        </div>
      </section>

      {report && (
        <section className="band band-alt">
          <motion.div className="inner" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {!report.found ? (
              <div className="notfound">No contributor found for that claim key. Check it and try again.</div>
            ) : (
              <div className="report">
                <div className="topline">
                  <div className="total">
                    <span className="t-label">total earned</span>
                    <span className="t-val">${(report.totalEarned ?? 0).toFixed(6)}</span>
                  </div>
                  {report.con && (
                    <div className="agent">
                      <span className="t-label">represented by</span>
                      <span className="a-val">{report.con.label}</span>
                      <span className="a-rate">{Math.round(report.con.fee_rate * 100)}% commission</span>
                    </div>
                  )}
                </div>

                <div className="block">
                  <div className="eyebrow">your experiences</div>
                  {report.experiences && report.experiences.length > 0 ? report.experiences.map((e) => (
                    <div key={e.id} className="exp">
                      <div className="exp-title">{e.title}</div>
                      <div className="exp-meta">
                        <span>{e.domain}</span>
                        <span>quality {Math.round(e.quality_score * 100)}%</span>
                        <span>surfaced {e.times_surfaced}×</span>
                        <span>paid {e.times_paid}×</span>
                      </div>
                    </div>
                  )) : <div className="muted">No experiences yet.</div>}
                </div>

                <div className="block">
                  <div className="eyebrow">payout history</div>
                  {report.payouts && report.payouts.length > 0 ? report.payouts.map((p, i) => (
                    <div key={i} className="payrow">
                      <span className="p-reason">{p.reason}</span>
                      <span className="p-amt">${p.amount.toFixed(6)}</span>
                      {p.tx && <span className="p-tx">tx {p.tx.slice(0, 8)}…</span>}
                    </div>
                  )) : <div className="muted">No payouts yet. When your experience helps someone, it appears here — live, on-chain.</div>}
                </div>
              </div>
            )}
          </motion.div>
        </section>
      )}

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
.nav a:hover { opacity: 1; }
.band { padding: clamp(2.5rem,6vw,4.5rem) clamp(1.5rem,5vw,5rem); }
.band-alt { background: #fff; }
.hero { padding-top: clamp(1.5rem,4vw,3rem); }
.inner { max-width: 720px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2rem,4.5vw,3rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.2rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.05rem,2vw,1.2rem); line-height: 1.6; color: #3a3446; max-width: 52ch; margin: 0 0 2.2rem; }
.check { position: relative; border-radius: 16px; }
.check-in { position: relative; z-index: 1; background: #fff; border-radius: 14px; padding: 1rem; margin: 2px; display: flex; gap: 0.8rem; flex-wrap: wrap; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 16px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.key-input { flex: 1; min-width: 200px; border: 1px solid var(--line); border-radius: 10px; padding: 0.8rem 1rem; font-family: ui-monospace, monospace; font-size: 1.1rem; letter-spacing: 0.05em; outline: none; color: var(--ink); }
.key-input:focus { border-color: var(--gold); }
.btn { padding: 0.8rem 1.5rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.err, .notfound { color: var(--clay); margin-top: 1rem; }
.muted { color: #8a8073; font-style: italic; font-size: 0.95rem; }
.topline { display: flex; gap: 3rem; padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.total, .agent { display: flex; flex-direction: column; gap: 0.3rem; }
.t-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a8073; }
.t-val { font-family: ui-monospace, monospace; font-size: 2rem; color: var(--gold); font-weight: 600; }
.a-val { font-family: Newsreader, Georgia, serif; font-size: 1.5rem; }
.a-rate { font-family: ui-monospace, monospace; font-size: 0.78rem; color: var(--violet); }
.block { margin-top: 2rem; }
.exp { padding: 0.9rem 0; border-bottom: 1px dashed var(--line); }
.exp-title { font-family: Newsreader, Georgia, serif; font-size: 1.15rem; margin-bottom: 0.4rem; }
.exp-meta { display: flex; gap: 1.2rem; font-family: ui-monospace, monospace; font-size: 0.76rem; color: #8a8073; flex-wrap: wrap; text-transform: capitalize; }
.payrow { display: flex; gap: 1rem; align-items: baseline; padding: 0.7rem 0; border-bottom: 1px dashed var(--line); }
.p-reason { flex: 1; font-size: 0.95rem; color: #4a4456; }
.p-amt { font-family: ui-monospace, monospace; color: var(--gold); font-weight: 600; }
.p-tx { font-family: ui-monospace, monospace; font-size: 0.74rem; color: var(--violet); }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 720px; margin: 0 auto; }
@media (max-width: 620px) { .ft-in { flex-direction: column; gap: 0.5rem; } }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
