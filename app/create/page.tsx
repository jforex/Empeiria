"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Connected = {
  handle: string; accessKey: string; repo: string; agentLabel: string;
  filesIngested: number; chunks: number; stars: number;
};

export default function Connect() {
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Connected | null>(null);

  // returning maintainer
  const [returnKey, setReturnKey] = useState("");
  const [dash, setDash] = useState<{ handle: string; agentLabel: string; repoFullName: string | null; earned: number } | null>(null);
  const [wDest, setWDest] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [wResult, setWResult] = useState<string | null>(null);

  async function connect() {
    if (!repo.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/repo/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "connection failed");
      setResult(data);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function loadDash() {
    if (returnKey.trim().length < 4) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/creator/access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: returnKey }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "not found");
      // pull repo info from the dashboard endpoint
      const dr = await fetch(`/api/creator/dashboard?handle=${d.handle}`).then((r) => r.json());
      setDash({ handle: d.handle, agentLabel: d.agentLabel, repoFullName: dr?.creator?.repoFullName ?? null, earned: d.totalEarned ?? 0 });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function withdraw() {
    if (!wDest.trim() || !wAmount) return;
    setBusy(true); setError(null); setWResult(null);
    try {
      const res = await fetch("/api/creator/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: returnKey, destination: wDest, amount: Number(wAmount) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "withdrawal failed");
      setWResult(d.txHash);
      setDash((p) => p ? { ...p, earned: p.earned - Number(wAmount) } : p);
      setWAmount(""); setWDest("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/marketplace">Ask a repo</a><a href="/create" className="active">Connect a repo</a></nav>
      </header>

      <section className="band hero">
        <div className="inner">
          <div className="eyebrow">for maintainers</div>
          <h1>Turn your repo<br />into a paid AI teammate.</h1>
          <p className="lede">Connect a GitHub repository. Empeiria reads its docs and source and builds an agent that answers questions about your codebase — and earns you USDC every time a developer uses it.</p>
        </div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          <AnimatePresence mode="wait">
            {!result && !dash && (
              <motion.div key="connect" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in">
                  <div className="field-label">GitHub repository</div>
                  <input className="f-line" placeholder="github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") connect(); }} />
                  {error && <div className="err">{error}</div>}
                  <button className="btn btn-solid" onClick={connect} disabled={busy || !repo.trim()}>
                    {busy ? "Reading your repo… (this can take a minute)" : "Connect repository →"}
                  </button>
                  <div className="return-row">
                    <span className="return-label">Already connected?</span>
                    <input className="return-input" placeholder="Paste access key (EMP-XXXX-XXXX)" value={returnKey} onChange={(e) => setReturnKey(e.target.value)} />
                    <button className="return-btn" onClick={loadDash} disabled={busy || returnKey.trim().length < 4}>Open →</button>
                  </div>
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div key="done" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in live-in">
                  <div className="eyebrow">your repo agent is live</div>
                  <h2>{result.agentLabel}</h2>
                  <p className="live-sub">{result.repo} · {result.filesIngested} files · {result.chunks} chunks{result.stars > 0 ? ` · ★ ${result.stars}` : ""}</p>
                  <div className="share-box">
                    <div className="share-label">anyone can now ask your repo:</div>
                    <code className="share-code">@{result.handle} &lt;question&gt;</code>
                  </div>
                  <div className="key-box">
                    <div className="key-label">⚠ save your access key — you'll need it to withdraw earnings or re-sync</div>
                    <code className="key-code">{result.accessKey}</code>
                  </div>
                  <div className="row2">
                    <a className="btn btn-solid" href="/marketplace">Try asking your repo →</a>
                    <a className="btn btn-ghost" href={`/creator/${result.handle}`}>View public page →</a>
                  </div>
                </div>
              </motion.div>
            )}

            {dash && (
              <motion.div key="dash" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in">
                  <div className="eyebrow">your repo agent</div>
                  <h2 style={{ fontFamily: "Newsreader, Georgia, serif", fontWeight: 500, fontSize: "1.8rem", margin: "0.2rem 0 0.2rem" }}>{dash.agentLabel}</h2>
                  {dash.repoFullName && <div className="agent-banner">{dash.repoFullName}</div>}
                  <div className="dash-earned">
                    <span className="de-num">${dash.earned.toFixed(4)}</span>
                    <span className="de-label">available to withdraw</span>
                  </div>
                  <div className="withdraw-box">
                    <div className="wb-head">Withdraw earnings</div>
                    <input className="f-line" placeholder="Your wallet address (0x...)" value={wDest} onChange={(e) => setWDest(e.target.value)} />
                    <input className="f-line" placeholder="Amount in USDC" value={wAmount} onChange={(e) => setWAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                    {error && <div className="err">{error}</div>}
                    {wResult && (
                      <div className="w-ok">
                        <span>✓ Sent on-chain</span>
                        <a href={`https://testnet.arcscan.app/tx/${wResult}`} target="_blank" rel="noopener noreferrer" className="w-tx">{wResult.slice(0, 10)}…{wResult.slice(-8)}</a>
                        <button type="button" className="w-copy" onClick={() => navigator.clipboard.writeText(wResult)}>copy</button>
                      </div>
                    )}
                    <button className="btn btn-solid" onClick={withdraw} disabled={busy || !wDest.trim() || !wAmount || Number(wAmount) > dash.earned}>
                      {busy ? "Sending…" : "Withdraw →"}
                    </button>
                  </div>
                  <a className="btn btn-ghost" href={`/creator/${dash.handle}`}>View public page →</a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
.inner { max-width: 640px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem,5vw,3.3rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.4rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem,2vw,1.28rem); line-height: 1.6; color: #3a3446; max-width: 54ch; margin: 0; }
.card { position: relative; border-radius: 18px; }
.card-in { position: relative; z-index: 1; background: var(--paper); border-radius: 16px; padding: 2rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.field-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7d62; font-weight: 600; margin-bottom: 0.7rem; }
.f-line { width: 100%; border: none; border-bottom: 1.5px solid var(--line); background: transparent; font-size: 1.05rem; padding: 0.6rem 0; margin-bottom: 1.3rem; outline: none; color: var(--ink); font-family: ui-monospace, monospace; }
.f-line:focus { border-color: var(--gold); }
.btn { padding: 0.85rem 1.6rem; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; text-decoration: none; display: inline-block; text-align: center; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.row2 { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; }
.err { color: var(--clay); font-size: 0.9rem; margin-bottom: 1rem; }
.return-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.6rem; padding-top: 1.6rem; border-top: 1px solid var(--line); flex-wrap: wrap; }
.return-label { font-size: 0.82rem; color: #8a7d62; font-weight: 600; white-space: nowrap; }
.return-input { flex: 1; min-width: 180px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font-family: ui-monospace, monospace; font-size: 0.82rem; padding: 0.5rem 0.7rem; outline: none; color: var(--ink); }
.return-input:focus { border-color: var(--gold); }
.return-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 1.5px solid var(--ink); background: transparent; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--ink); }
.return-btn:disabled { opacity: 0.4; cursor: default; }
.live-in { text-align: center; }
.live-in h2 { font-family: Newsreader, Georgia, serif; font-size: 2rem; font-weight: 500; margin: 0 0 0.4rem; }
.live-sub { font-family: ui-monospace, monospace; font-size: 0.85rem; color: #3f8c5f; margin: 0 0 1.6rem; }
.share-box { background: #fff; border: 1px dashed var(--gold); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem; }
.share-label { font-size: 0.78rem; color: #8a7d62; margin-bottom: 0.6rem; }
.share-code { font-family: ui-monospace, monospace; font-size: 1.05rem; color: var(--ink); font-weight: 600; }
.key-box { background: #fdf6e3; border: 1px solid var(--gold); border-radius: 12px; padding: 1.1rem; margin-bottom: 1.6rem; }
.key-label { font-size: 0.78rem; color: #8a6d1f; margin-bottom: 0.5rem; }
.key-code { font-family: ui-monospace, monospace; font-size: 1.15rem; color: var(--ink); font-weight: 700; letter-spacing: 0.05em; }
.live-in .row2 { justify-content: center; }
.agent-banner { font-family: ui-monospace, monospace; font-size: 0.9rem; color: #8a8073; margin-bottom: 1.4rem; }
.dash-earned { display: flex; flex-direction: column; gap: 0.2rem; padding: 1.4rem 0; margin-bottom: 1.4rem; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.de-num { font-family: ui-monospace, monospace; font-size: 2rem; font-weight: 700; color: var(--gold); }
.de-label { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8073; }
.withdraw-box { margin-bottom: 1.4rem; }
.wb-head { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.w-ok { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; color: #3f8c5f; font-size: 0.9rem; margin-bottom: 0.9rem; font-family: ui-monospace, monospace; }
.w-tx { color: var(--violet); text-decoration: underline; }
.w-copy { border: 1px solid var(--line); background: #fff; border-radius: 6px; font-size: 0.74rem; padding: 0.2rem 0.55rem; cursor: pointer; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 640px; margin: 0 auto; }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
