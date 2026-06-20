"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Result =
  | { accepted: true; claimKey: string; domain: string; quality: number; title: string; reason: string }
  | { accepted: false; reason: string };

export default function Speak() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [stage, setStage] = useState<"idle" | "judging" | "result">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || body.trim().length < 120) return;
    setStage("judging"); setError(null); setResult(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      // brief beat so the "judging" moment is felt
      setTimeout(() => { setResult(data); setStage("result"); }, 600);
    } catch (e) {
      setError((e as Error).message); setStage("idle");
    }
  }

  function reset() { setTitle(""); setBody(""); setResult(null); setStage("idle"); setError(null); }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo">empeiria</a>
        <nav className="nav"><a href="/ask">Ask</a><a href="/speak" className="active">Speak</a></nav>
      </header>

      <section className="band hero">
        <motion.div className="inner" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="eyebrow">speak your experience</div>
          <h1>What you survived<br />could carry someone else through.</h1>
          <p className="lede">Share it once. A gate agent reads it to confirm it's real, lived experience — then it enters the pool. Every time it helps a stranger, you earn. You're never named.</p>
        </motion.div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          {stage !== "result" && (
            <div className="form lit">
              <span className="lit-border lit-gold" aria-hidden />
              <div className="form-in">
                <div className="eyebrow">your experience</div>
                <input className="f-title" placeholder="Give it a short title"
                  value={title} onChange={(e) => setTitle(e.target.value)} disabled={stage === "judging"} maxLength={80} />
                <textarea className="f-body" rows={9} disabled={stage === "judging"}
                  placeholder="Tell it in your own words — what you actually went through, what you did, what you'd tell someone facing it now. The specific, honest version is what helps."
                  value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="f-row">
                  <span className="f-count">{body.trim().length < 120 ? `${120 - body.trim().length} more characters to submit` : "ready"}</span>
                  <button className="btn btn-solid" onClick={submit} disabled={stage === "judging" || !title.trim() || body.trim().length < 120}>
                    {stage === "judging" ? "Gate agent reading…" : "Submit experience →"}
                  </button>
                </div>
                {error && <div className="f-err">{error}</div>}
              </div>
            </div>
          )}

          <AnimatePresence>
            {stage === "judging" && (
              <motion.div className="judging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="pulse" /> The gate agent is reading your experience, judging whether it's genuine lived experience…
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {stage === "result" && result && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {result.accepted ? (
                  <div className="verdict accept lit">
                    <span className="lit-border lit-gold" aria-hidden />
                    <div className="verdict-in">
                      <div className="eyebrow">accepted into the pool</div>
                      <h2>"{result.title}"</h2>
                      <p className="v-reason">{result.reason}</p>
                      <div className="v-meta">
                        <div><span className="v-k">domain</span><span className="v-v">{result.domain}</span></div>
                        <div><span className="v-k">quality</span><span className="v-v">{Math.round(result.quality * 100)}%</span></div>
                      </div>
                      <div className="claim">
                        <div className="claim-label">your private claim key — save it to check your earnings</div>
                        <div className="claim-key">{result.claimKey}</div>
                        <div className="claim-note">No account, no name. This key is the only way to track what your experience earns.</div>
                      </div>
                      <button className="btn btn-ghost" onClick={reset}>Share another →</button>
                    </div>
                  </div>
                ) : (
                  <div className="verdict reject">
                    <div className="verdict-in">
                      <div className="eyebrow reject-eye">not yet accepted</div>
                      <p className="v-reason">{result.reason}</p>
                      <p className="reject-help">The pool holds real, first-person lived experience — what you personally went through, in specific detail. Try again with your own story.</p>
                      <button className="btn btn-solid" onClick={() => { setStage("idle"); setResult(null); }}>Revise and resubmit →</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section className="band">
        <div className="inner">
          <div className="eyebrow">how it works</div>
          <ul className="why">
            <li><b>A gate agent judges every submission.</b> Only genuine lived experience enters the pool — that's what keeps it worth paying for.</li>
            <li><b>You stay anonymous.</b> No name, no login. A private wallet earns on your behalf; a claim key lets you check it.</li>
            <li><b>You earn from use, not posting.</b> When the answer agent uses your experience, you're paid in proportion to how much it mattered.</li>
          </ul>
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
.logo { font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; text-decoration: none; color: var(--ink); }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.7; }
.nav a:hover, .nav a.active { opacity: 1; }
.band { padding: clamp(2.5rem,6vw,4.5rem) clamp(1.5rem,5vw,5rem); }
.band-alt { background: #fff; }
.hero { padding-top: clamp(1.5rem,4vw,3rem); }
.inner { max-width: 720px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.reject-eye { color: var(--clay); }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem,5vw,3.4rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.5rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem,2vw,1.3rem); line-height: 1.6; color: #3a3446; max-width: 52ch; margin: 0; }
.form, .verdict { position: relative; border-radius: 18px; }
.form-in, .verdict-in { position: relative; z-index: 1; background: var(--paper); border-radius: 16px; padding: 2rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.f-title { width: 100%; border: none; border-bottom: 1.5px solid var(--line); background: transparent; font-family: Newsreader, Georgia, serif; font-size: 1.4rem; padding: 0.4rem 0; margin-bottom: 1.2rem; outline: none; color: var(--ink); }
.f-title:focus { border-color: var(--gold); }
.f-body { width: 100%; border: 1px solid var(--line); border-radius: 12px; background: #fff; font-size: 1.05rem; line-height: 1.6; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1rem; outline: none; resize: vertical; color: var(--ink); }
.f-body:focus { border-color: var(--gold); }
.f-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; gap: 1rem; flex-wrap: wrap; }
.f-count { font-size: 0.82rem; color: #a3998a; font-family: ui-monospace, monospace; }
.btn { padding: 0.8rem 1.5rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.f-err { color: var(--clay); font-size: 0.9rem; margin-top: 0.8rem; }
.judging { display: flex; align-items: center; gap: 0.7rem; color: #8a7d62; font-size: 1.05rem; padding: 1.5rem 0; line-height: 1.5; }
.pulse { width: 10px; height: 10px; border-radius: 50%; background: var(--gold); flex-shrink: 0; animation: p 1s ease-in-out infinite; }
@keyframes p { 0%,100% { opacity: 0.3; transform: scale(0.8);} 50% { opacity: 1; transform: scale(1.2);} }
.verdict h2 { font-family: Newsreader, Georgia, serif; font-size: 1.6rem; font-weight: 500; margin: 0 0 0.8rem; }
.v-reason { font-size: 1.05rem; line-height: 1.55; color: #3a3446; margin: 0 0 1.5rem; }
.v-meta { display: flex; gap: 2.5rem; padding: 1rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 1.5rem; }
.v-meta > div { display: flex; flex-direction: column; gap: 0.2rem; }
.v-k { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a8073; }
.v-v { font-family: ui-monospace, monospace; font-size: 1.1rem; color: var(--gold); text-transform: capitalize; }
.claim { background: #fff; border: 1px dashed var(--gold); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.5rem; }
.claim-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7d62; margin-bottom: 0.6rem; font-weight: 600; }
.claim-key { font-family: ui-monospace, monospace; font-size: 1.5rem; font-weight: 700; color: var(--ink); letter-spacing: 0.05em; }
.claim-note { font-size: 0.82rem; color: #8a8073; margin-top: 0.6rem; line-height: 1.4; }
.reject .verdict-in { border: 1px solid #e8d5cf; }
.reject-help { font-size: 0.95rem; color: #6a6376; line-height: 1.5; margin: 0 0 1.5rem; }
.why { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.1rem; }
.why li { font-size: 1.08rem; line-height: 1.55; color: #4a4456; padding-left: 1.3rem; position: relative; }
.why li::before { content: "—"; position: absolute; left: 0; color: var(--gold); font-weight: 700; }
.why b { color: var(--ink); }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 720px; margin: 0 auto; }
@media (max-width: 620px) { .ft-in { flex-direction: column; gap: 0.5rem; } }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
