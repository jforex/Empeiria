"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Dash {
creator: { handle: string; name: string; agentLabel: string; tagline: string | null; category: string; bio: string | null; totalEarned: number; joinedAt: string; avatarUrl: string | null; isRepo: boolean; repoFullName: string | null; repoUrl: string | null; repoStars: number };
  knowledge: { contentPieces: number; totalChunks: number; totalUses: number; content: { name: string; type: string; chunks: number; status: string; at: string }[] };
}

export default function CreatorProfile() {
  const [handle, setHandle] = useState("");

  useEffect(() => {
    // read handle from the URL path on the client (prerender-safe)
    const parts = window.location.pathname.split("/");
    setHandle(decodeURIComponent(parts[parts.length - 1] || ""));
  }, []);
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<string | null>(null);
  const [docsTx, setDocsTx] = useState<string | null>(null);
  const [docsBusy, setDocsBusy] = useState(false);
  const [deps, setDeps] = useState<string | null>(null);
  const [depsTx, setDepsTx] = useState<string | null>(null);
  const [depsBusy, setDepsBusy] = useState(false);
  const [tests, setTests] = useState<string | null>(null);
  const [testsTx, setTestsTx] = useState<string | null>(null);
  const [testsBusy, setTestsBusy] = useState(false);
  const [agentErr, setAgentErr] = useState<string | null>(null);

  async function runDocs() {
    setDocsBusy(true); setAgentErr(null); setDocs(null); setDocsTx(null);
    try {
      const res = await fetch("/api/agents/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "documentation failed");
      setDocs(d.docs); setDocsTx(d.paid?.tx ?? null);
    } catch (e) { setAgentErr((e as Error).message); }
    finally { setDocsBusy(false); }
  }
async function runDeps() {
    setDepsBusy(true); setAgentErr(null); setDeps(null); setDepsTx(null);
    try {
      const res = await fetch("/api/agents/deps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "dependency analysis failed");
      setDeps(d.report); setDepsTx(d.paid?.tx ?? null);
    } catch (e) { setAgentErr((e as Error).message); }
    finally { setDepsBusy(false); }
  }
  async function runTests() {
    setTestsBusy(true); setAgentErr(null); setTests(null); setTestsTx(null);
    try {
      const res = await fetch("/api/agents/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "testing analysis failed");
      setTests(d.report); setTestsTx(d.paid?.tx ?? null);
    } catch (e) { setAgentErr((e as Error).message); }
    finally { setTestsBusy(false); }
  }
  const [loading, setLoading] = useState(true);

useEffect(() => {
    if (!handle) return;
    fetch(`/api/creator/dashboard?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); else setError(d.error ?? "not found"); })
      .catch(() => setError("failed to load"))
      .finally(() => setLoading(false));
  }, [handle]);

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo1.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/marketplace">Ask</a><a href="/create">Create</a></nav>
      </header>

      <section className="band">
        <div className="inner">
          {loading && <div className="muted">Loading…</div>}
          {error && <div className="muted">No creator found at <b>@{handle}</b>. <a href="/create" style={{ color: "var(--gold)", fontWeight: 600 }}>Create your agent →</a></div>}

          {data && (
            <>
              <motion.div className="profile" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
               <div className="profile-head">
                  {data.creator.avatarUrl
                    ? <img src={data.creator.avatarUrl} alt="" className="profile-avatar" />
                    : <span className="profile-avatar profile-avatar-ph">{data.creator.name.charAt(0).toUpperCase()}</span>}
                  <div className="cat-tag">{data.creator.isRepo ? "github repo" : data.creator.category}</div>
                </div>
               <h1>{data.creator.agentLabel}</h1>
                {data.creator.repoFullName && (
                  <a className="repo-link" href={data.creator.repoUrl ?? `https://github.com/${data.creator.repoFullName}`} target="_blank" rel="noopener noreferrer">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                    {data.creator.repoFullName}{data.creator.repoStars > 0 ? ` · ★ ${data.creator.repoStars}` : ""}
                  </a>
                )}
                <div className="byline">by {data.creator.name} · @{data.creator.handle}</div>
                {data.creator.tagline && <p className="tagline">{data.creator.tagline}</p>}
                {data.creator.bio && <p className="bio">{data.creator.bio}</p>}

                <div className="stats">
                  <div className="stat"><span className="stat-num">${data.creator.totalEarned.toFixed(4)}</span><span className="stat-label">earned</span></div>
                <div className="stat"><span className="stat-num">{data.knowledge.contentPieces}</span><span className="stat-label">{data.creator.isRepo ? "files" : "sources"}</span></div>
                  <div className="stat"><span className="stat-num">{data.knowledge.totalChunks}</span><span className="stat-label">knowledge chunks</span></div>
                  <div className="stat"><span className="stat-num">{data.knowledge.totalUses}</span><span className="stat-label">times used</span></div>
                </div>

                <a className="btn btn-solid ask-cta" href={`/marketplace`}>Ask this agent → <span className="ask-handle">@{data.creator.handle}</span></a>
                {data.creator.isRepo && (
                  <div className="agent-svc">
                    <div className="sources-head">agent services — the repo agent pays specialists on-chain</div>
                    <div className="agent-btns">
                      <button className="btn btn-ghost agent-btn" onClick={runDocs} disabled={docsBusy}>{docsBusy ? "Docs Agent working…" : "🤖 Generate docs ($0.02)"}</button>
                      <button className="btn btn-ghost agent-btn" onClick={runDeps} disabled={depsBusy}>{depsBusy ? "Dependency Agent working…" : "📦 Analyze deps ($0.02)"}</button>
                      <button className="btn btn-ghost agent-btn" onClick={runTests} disabled={testsBusy}>{testsBusy ? "Testing Agent working…" : "🧪 Suggest tests ($0.02)"}</button>
                    </div>
                    {agentErr && <div className="err" style={{ marginTop: "0.6rem" }}>{agentErr}</div>}
                    {docsTx && <div className="agent-paid">✓ paid Documentation Agent $0.02 · <a href={`https://testnet.arcscan.app/tx/${docsTx}`} target="_blank" rel="noopener noreferrer">{docsTx.slice(0,10)}…</a></div>}
                    {docs && <pre className="agent-out">{docs}</pre>}
                    {depsTx && <div className="agent-paid">✓ paid Dependency Agent $0.02 · <a href={`https://testnet.arcscan.app/tx/${depsTx}`} target="_blank" rel="noopener noreferrer">{depsTx.slice(0,10)}…</a></div>}
                    {deps && <pre className="agent-out">{deps}</pre>}
                    {testsTx && <div className="agent-paid">✓ paid Testing Agent $0.02 · <a href={`https://testnet.arcscan.app/tx/${testsTx}`} target="_blank" rel="noopener noreferrer">{testsTx.slice(0,10)}…</a></div>}
                    {tests && <pre className="agent-out">{tests}</pre>}
                  </div>
                )}
              </motion.div>

              {data.knowledge.content.length > 0 && (
                <div className="sources">
                 <div className="sources-head">{data.creator.isRepo ? "files this agent has read" : "knowledge in this agent"}</div>
                  {data.knowledge.content.map((c, i) => (
                    <div key={i} className="src-row">
                      <span className="src-name">{c.name || "untitled"}</span>
                      <span className="src-meta">{c.type} · {c.chunks} chunks · {c.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
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
.pg { --ink:#1A1A2E; --paper:#FBF7F0; --gold:#B8923E; --violet:#6B5B95; --line:#e6ddcb; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
.hd { display: flex; justify-content: space-between; align-items: center; padding: 1.75rem clamp(1.5rem,5vw,5rem); max-width: 1100px; margin: 0 auto; width: 100%; }
.logo { display: inline-flex; align-items: center; gap: 0.6rem; font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; text-decoration: none; color: var(--ink); }
.logo-img { height: 34px; width: auto; display: block; mix-blend-mode: multiply; }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.7; }
.nav a:hover { opacity: 1; }
.band { padding: clamp(2rem,5vw,4rem) clamp(1.5rem,5vw,5rem); flex: 1; }
.inner { max-width: 640px; margin: 0 auto; }
.muted { color: #8a8073; font-size: 1.05rem; }
.profile { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 2.2rem; margin-bottom: 1.5rem; }
.profile-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.2rem; }
.profile-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.profile-avatar-ph { display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--paper); font-family: Newsreader, Georgia, serif; font-size: 1.7rem; font-weight: 500; }
.cat-tag { display: inline-block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); font-weight: 600; background: #fbf3e0; padding: 0.3rem 0.7rem; border-radius: 999px; }
.profile h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(1.8rem,4vw,2.5rem); font-weight: 500; margin: 0 0 0.4rem; line-height: 1.1; }
.byline { font-size: 0.92rem; color: #8a8073; margin-bottom: 1.2rem; }
.repo-link { display: inline-flex; align-items: center; gap: 0.5rem; font-family: ui-monospace, monospace; font-size: 0.95rem; color: var(--violet); text-decoration: none; margin: 0.2rem 0 0.8rem; padding: 0.4rem 0.8rem; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.repo-link:hover { border-color: var(--violet); }
.tagline { font-size: 1.15rem; line-height: 1.5; color: #3a3446; margin: 0 0 0.8rem; }
.bio { font-size: 1rem; line-height: 1.6; color: #4a4456; margin: 0 0 1.5rem; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 1.4rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 1.6rem; }
.stat { display: flex; flex-direction: column; gap: 0.25rem; }
.stat-num { font-family: ui-monospace, monospace; font-size: 1.25rem; font-weight: 700; color: var(--gold); }
.stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8073; }
.btn { padding: 0.9rem 1.6rem; border-radius: 11px; font-size: 1rem; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; transition: transform 0.12s; }
.btn:hover { transform: translateY(-2px); }
.btn-solid { background: var(--ink); color: var(--paper); }
.ask-cta { width: 100%; justify-content: center; }
.agent-svc { margin-top: 1.6rem; padding-top: 1.4rem; border-top: 1px solid var(--line); }
.agent-btns { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.8rem; }
.agent-btn { flex: 1; min-width: 160px; }
.agent-paid { font-family: ui-monospace, monospace; font-size: 0.8rem; color: #3f8c5f; margin-top: 0.8rem; }
.agent-paid a { color: var(--violet); }
.agent-out { margin-top: 0.8rem; padding: 1rem; background: #fff; border: 1px solid var(--line); border-radius: 10px; font-family: ui-monospace, monospace; font-size: 0.76rem; line-height: 1.5; white-space: pre-wrap; max-height: 300px; overflow-y: auto; color: var(--ink); }
.ask-handle { font-family: ui-monospace, monospace; opacity: 0.7; font-size: 0.9rem; }
.sources { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 1.5rem; }
.sources-head { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.src-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 0.6rem 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.src-name { font-family: Newsreader, Georgia, serif; font-size: 1.05rem; }
.src-meta { font-family: ui-monospace, monospace; font-size: 0.76rem; color: #8a8073; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 640px; margin: 0 auto; }
@media (max-width: 560px) { .stats { grid-template-columns: repeat(2, 1fr); } }
`;
