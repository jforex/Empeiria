"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import AuthBadge from "../components/AuthBadge";

type Repo = { handle: string; repoFullName: string; category: string; avatarUrl?: string | null };
type Paid = { repo: string; amount: number; tx: string };
const MAX = 5;

export default function Brainstorm() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ brainstorm: string; paid: Paid[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setAuthed(!!d.authed)).catch(() => setAuthed(false));
    fetch("/api/devs").then((r) => r.json()).then((d) => {
      if (d.ok) {
        const flat: Repo[] = [];
        for (const dev of d.devs) for (const r of dev.repos) flat.push({ handle: r.handle, repoFullName: r.repoFullName, category: r.category, avatarUrl: dev.avatar });
        setRepos(flat);
      }
    }).catch(() => {});
  }, []);

  function toggle(handle: string) {
    setSelected((s) => s.includes(handle) ? s.filter((h) => h !== handle) : (s.length >= MAX ? s : [...s, handle]));
  }

  async function brainstorm() {
    if (selected.length < 2 || !prompt.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/brainstorm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: selected, prompt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "brainstorm failed");
      setResult({ brainstorm: d.brainstorm, paid: d.paid ?? [], total: d.total ?? 0 });
    } catch (e) { setError((e as Error).message); }
    finally { setRunning(false); }
  }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo1.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/marketplace">Ask</a><a href="/brainstorm" className="active">Brainstorm</a><a href="/create">Create</a><AuthBadge /></nav>
      </header>

      <section className="band hero-b">
        <div className="inner">
          <div className="eyebrow">cross-repo brainstorm</div>
          <h1>Combine repos. Get ideas. Pay every maintainer.</h1>
          <p className="lede">Select two or more repositories and the Brainstorm Agent draws on all of their code to invent things you could build by combining them — paying each repo&apos;s maintainer on-chain. Something a single-model assistant can&apos;t do.</p>
        </div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          {authed === false && (
            <div className="gate">
              <p>Sign in with GitHub to brainstorm across repos.</p>
              <a className="btn btn-solid" href="/api/auth/github">Sign in with GitHub</a>
            </div>
          )}

          {authed && !result && (
            <>
              <div className="step-label">1 · pick repos to combine <span className="sel-count">{selected.length}/{MAX}</span></div>
              <div className="repo-select">
                {repos.map((r) => {
                  const on = selected.includes(r.handle);
                  return (
                    <button key={r.handle} type="button" className={`rs-card ${on ? "rs-on" : ""}`} onClick={() => toggle(r.handle)} disabled={!on && selected.length >= MAX}>
                      {r.avatarUrl && <img src={r.avatarUrl} alt="" className="rs-avatar" />}
                      <div className="rs-body">
                        <div className="rs-name">{r.repoFullName.split("/")[1]}</div>
                        <div className="rs-cat">{r.category}</div>
                      </div>
                      <span className="rs-check">{on ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>

              <div className="step-label">2 · what should they combine into?</div>
              <textarea className="bq" rows={3} placeholder="e.g. a tool that helps solo developers ship faster…" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} />

              {error && <div className="err">{error}</div>}
              <button className="btn btn-solid brainstorm-go" onClick={brainstorm} disabled={running || selected.length < 2 || !prompt.trim()}>
                {running ? "Brainstorming across repos…" : `Brainstorm · $${(0.02 * selected.length).toFixed(2)} (${selected.length} maintainer${selected.length === 1 ? "" : "s"} paid)`}
              </button>
              {selected.length < 2 && <div className="hint">select at least 2 repos</div>}
            </>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="answer-final">
                <div className="answer-label">the brainstorm</div>
                <div className="answer-md"><ReactMarkdown>{result.brainstorm}</ReactMarkdown></div>
              </div>
              <div className="payout">
                <div className="payout-head">maintainers paid on-chain — ${result.total.toFixed(4)} total</div>
                {result.paid.map((p, i) => (
                  <div key={i} className="prow">
                    <div className="prow-name">{p.repo}</div>
                    <div className="prow-pay">
                      {p.amount > 0
                        ? <>earned ${p.amount.toFixed(4)} · <a href={`https://testnet.arcscan.app/tx/${p.tx}`} target="_blank" rel="noopener noreferrer">{p.tx.slice(0, 10)}…</a></>
                        : <span className="prow-fail">{p.tx}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost" onClick={() => { setResult(null); setSelected([]); setPrompt(""); }}>Brainstorm again →</button>
            </motion.div>
          )}
        </div>
      </section>

      <footer className="ft"><div className="inner ft-in"><span>Settled in USDC on Arc.</span><span>Built for the Lepton Agents Hackathon.</span></div></footer>
    </div>
  );
}

const css = `
body { margin: 0; background: #FBF7F0; }
.pg { --ink:#1A1A2E; --paper:#FBF7F0; --gold:#B8923E; --violet:#6B5B95; --clay:#C1543A; --line:#e6ddcb; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
.hd { display: flex; justify-content: space-between; align-items: center; padding: 1.75rem clamp(1.5rem,5vw,5rem); max-width: 1100px; margin: 0 auto; }
.logo { display: inline-flex; align-items: center; gap: 0.6rem; font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; text-decoration: none; color: var(--ink); }
.logo-img { height: 34px; width: auto; display: block; mix-blend-mode: multiply; }
.nav { display: flex; gap: 1.75rem; align-items: center; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.7; }
.nav a:hover, .nav a.active { opacity: 1; }
.band { padding: clamp(2.5rem,6vw,4.5rem) clamp(1.5rem,5vw,5rem); }
.band-alt { background: #fff; }
.inner { max-width: 720px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.lede { font-size: clamp(1.1rem,2vw,1.28rem); line-height: 1.6; color: #3a3446; max-width: 56ch; margin: 0; }
.btn { padding: 0.85rem 1.6rem; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; text-decoration: none; display: inline-block; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.err { color: var(--clay); font-size: 0.9rem; margin-top: 0.9rem; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 720px; margin: 0 auto; }
.hero-b { padding-top: 3rem; }
.hero-b h1 { font-family: Newsreader, Georgia, serif; font-weight: 500; font-size: clamp(1.9rem, 4vw, 2.8rem); line-height: 1.1; margin: 0.3rem 0 0.8rem; color: var(--ink); }
.step-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; font-weight: 700; margin: 1.6rem 0 0.9rem; display: flex; align-items: center; gap: 0.6rem; }
.sel-count { background: var(--ink); color: var(--paper); border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.7rem; letter-spacing: 0; }
.repo-select { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.7rem; }
.rs-card { display: flex; align-items: center; gap: 0.6rem; padding: 0.8rem; border: 1.5px solid var(--line); border-radius: 12px; background: #fff; cursor: pointer; text-align: left; transition: all 0.12s; }
.rs-card:hover:not(:disabled) { border-color: var(--gold); }
.rs-card:disabled { opacity: 0.4; cursor: not-allowed; }
.rs-on { border-color: var(--ink); background: #faf8f3; }
.rs-avatar { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; }
.rs-body { flex: 1; min-width: 0; }
.rs-name { font-family: ui-monospace, monospace; font-size: 0.85rem; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-cat { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8a7d62; }
.rs-check { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; border: 1.5px solid var(--line); color: var(--ink); }
.rs-on .rs-check { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.bq { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem; font-size: 1rem; font-family: inherit; resize: vertical; outline: none; color: var(--ink); background: #fff; }
.bq:focus { border-color: var(--gold); }
.brainstorm-go { margin-top: 1.2rem; }
.hint { font-size: 0.8rem; color: #8a7d62; margin-top: 0.5rem; }
.gate { text-align: center; padding: 3rem 1rem; }
.gate p { color: #6a6256; margin-bottom: 1.2rem; }
.answer-final { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.5rem; margin: 1.2rem 0; }
.answer-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: #8a7d62; font-weight: 600; margin-bottom: 0.8rem; }
.answer-md { color: var(--ink); line-height: 1.65; font-size: 0.97rem; }
.answer-md p { margin: 0 0 1.05rem; } .answer-md p:last-child { margin-bottom: 0; }
.answer-md h1, .answer-md h2, .answer-md h3 { font-family: Newsreader, Georgia, serif; font-weight: 600; margin: 1.3rem 0 0.6rem; line-height: 1.25; }
.answer-md h1 { font-size: 1.4rem; } .answer-md h2 { font-size: 1.2rem; } .answer-md h3 { font-size: 1.05rem; }
.answer-md ul, .answer-md ol { margin: 0.6rem 0 1rem; padding-left: 1.5rem; }
.answer-md li { margin: 0.5rem 0; }
.answer-md strong { font-weight: 700; color: var(--ink); }
.answer-md code { background: #f3efe6; padding: 0.12rem 0.4rem; border-radius: 5px; font-family: ui-monospace, monospace; font-size: 0.86em; color: #8a4b2f; }
.payout { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.3rem; margin-bottom: 1.2rem; }
.payout-head { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7d62; font-weight: 700; margin-bottom: 0.9rem; }
.prow { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px solid var(--line); flex-wrap: wrap; gap: 0.5rem; }
.prow:first-of-type { border-top: none; }
.prow-name { font-family: ui-monospace, monospace; font-size: 0.85rem; font-weight: 600; color: var(--ink); }
.prow-pay { font-size: 0.82rem; color: #3f8c5f; }
.prow-pay a { color: var(--violet); }
.prow-fail { color: #c0392b; }
`;
