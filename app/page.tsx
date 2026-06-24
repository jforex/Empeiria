"use client";
import { useState, useEffect } from "react";
import EconomyMap from "./components/EconomyMap";
import { motion } from "framer-motion";

type Creator = {
  handle: string; name: string; agentLabel: string; tagline: string | null;
  category: string; earned: number; chunks: number; avatarUrl: string | null;
  isRepo?: boolean; repoFullName?: string | null; repoStars?: number;
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function Landing() {
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    fetch("/api/creators").then((r) => r.json()).then((d) => { if (d.ok) setCreators(d.creators); }).catch(() => {});
  }, []);

  const totalEarned = creators.reduce((s, c) => s + c.earned, 0);

  return (
    <div className="pg">
      <style>{css}</style>
      <section className="hero">
        <div className="hero-img" />
        <div className="hero-veil" />
        <header className="hd">
          <a href="/" className="logo"><img src="/empeiria-logo.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav">
            <a href="/marketplace">Ask a repo</a>
            <a href="/create">Connect a repo</a>
          </nav>
        </header>
        <div className="hero-body">
        <motion.div className="hero-eyebrow" initial="hidden" animate="show" custom={0} variants={fadeUp}>
            Open source, finally paid · maintainers earn in USDC on Arc via x402
          </motion.div>
          <motion.h1 initial="hidden" animate="show" custom={0} variants={fadeUp}>
            Turn your repository<br />into an AI teammate.
          </motion.h1>
          <motion.p className="lede" initial="hidden" animate="show" custom={1} variants={fadeUp}>
            Connect any GitHub repo and it becomes an agent that answers questions
            about the codebase — architecture, onboarding, implementation. Developers
            pay per answer; the maintainer earns every time their repo helps someone.
          </motion.p>
          <motion.div className="doors" initial="hidden" animate="show" custom={2} variants={fadeUp}>
            <div className="door lit">
              <span className="lit-border" aria-hidden />
            <div className="door-in">
                <div className="eyebrow">if you're using a codebase</div>
                <h2>Ask any repo.</h2>
                <p>Stop digging through docs and source. Ask the repo's agent how something works, how to integrate it, or where to start — and pay a few cents per answer.</p>
                <a href="/marketplace" className="btn btn-solid">Ask a repo →</a>
              </div>
            </div>
            <div className="door lit">
              <span className="lit-border lit-gold" aria-hidden />
             <div className="door-in">
                <div className="eyebrow">if you maintain a repo</div>
                <h2>Get paid for your work.</h2>
                <p>Connect your GitHub repo in seconds. It becomes an AI teammate that answers questions for you — and earns you USDC every time a developer uses it.</p>
                <a href="/create" className="btn btn-ghost">Connect a repo →</a>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="scroll-cue" aria-hidden>scroll</div>
      </section>

      <section className="band">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="grid-head">
            <div>
             <div className="eyebrow">live repo agents</div>
              <h3 className="grid-title">Repo agents earning right now.</h3>
            </div>
            <div className="grid-stat">
              <span className="gs-num">${totalEarned.toFixed(4)}</span>
              <span className="gs-label">paid to maintainers</span>
            </div>
          </div>
          {creators.length > 0 ? (
            <div className="cgrid">
              {creators.map((c, i) => (
                <motion.a key={c.handle} href={`/creator/${c.handle}`} className="ccard"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                 <div className="cc-top">
                    {c.avatarUrl
                      ? <img src={c.avatarUrl} alt="" className="cc-avatar" />
                      : <span className="cc-avatar cc-avatar-ph">{c.name.charAt(0).toUpperCase()}</span>}
                    <div className="cc-cat">{c.category}</div>
                  </div>
                 <div className="cc-agent">{c.agentLabel}</div>
                  <div className="cc-by">{c.repoFullName ? c.repoFullName : c.name}{typeof c.repoStars === "number" && c.repoStars > 0 ? ` · ★ ${c.repoStars}` : ""}</div>
                  {c.tagline && <div className="cc-tag">{c.tagline}</div>}
                  <div className="cc-foot">
                    <span className="cc-earned">${c.earned.toFixed(4)} earned</span>
                    <span className="cc-chunks">{c.chunks} chunk{c.chunks === 1 ? "" : "s"}</span>
                  </div>
                </motion.a>
              ))}
            </div>
          ) : (
           <div className="empty">No repos connected yet. <a href="/create" style={{ color: "var(--gold)", fontWeight: 600 }}>Connect the first repo →</a></div>
          )}
        </motion.div>
      </section>

      <section className="band band-alt">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
         <div className="eyebrow">how it works — a repo becomes a paid teammate</div>
          <p className="how-lede">Maintainers own their code; developers rent its knowledge, one answer at a time. Agents retrieve from the real repo, synthesize, and settle payments in USDC on Arc via x402 micropayments — every step a real on-chain decision.</p>
          <div className="how-grid">
          <div className="how-card"><div className="how-num">01</div><div className="how-title">Connect a repo</div><p>Paste a GitHub URL. Empeiria ingests the docs and source, chunks and embeds them into an agent that knows the codebase.</p></div>
            <div className="how-card"><div className="how-num">02</div><div className="how-title">You ask, with a budget</div><p>Pick a tier — simple, detailed, or analysis. That price is held and spent down as creators' knowledge is used to answer you.</p></div>
           <div className="how-card"><div className="how-num">03</div><div className="how-title">The agent answers from real code</div><p>The most relevant files and docs are retrieved and synthesized into one answer — citing where in the repo it came from.</p></div>
           <div className="how-card"><div className="how-num">04</div><div className="how-title">Maintainers are paid per use</div><p>The repo's maintainer earns for every answer their codebase provides. Settled instantly via x402 in USDC on Arc. Unused budget is refunded.</p></div>
            <div className="how-card"><div className="how-num">05</div><div className="how-title">Transparent by default</div><p>Every answer shows exactly who contributed, what percentage, and what they earned — with on-chain transaction references.</p></div>
           <div className="how-card"><div className="how-num">06</div><div className="how-title">Open source, finally paid</div><p>Maintainers never transfer their code — it's consulted, one answer at a time. Every question becomes revenue for the work they already shipped.</p></div>
          </div>
        </motion.div>
      </section>

      <section className="band">
        <div className="inner">
          <div className="how-map-label eyebrow">the whole economy, live</div>
          <EconomyMap activeNodes={new Set(["asker","escrow","router","specialist","pool","contributor","con","fees","transcription"])} pulses={[]} />
        </div>
      </section>

      <footer className="ft">
        <div className="inner ft-in">
          <span>Settled in USDC on Arc.</span>
          <span>Built for the Lepton Agents Hackathon.</span>
        </div>
      </footer>
    </div>
  );
}
const css = `
* { box-sizing: border-box; }
body { margin: 0; background: #FBF7F0; }
.pg { --ink:#1A1A2E; --paper:#FBF7F0; --gold:#B8923E; --violet:#6B5B95; --line:#e6ddcb;
  color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }

/* HERO */
.hero { position: relative; min-height: 100vh; display: flex; flex-direction: column;
  padding: 0 clamp(1.5rem, 5vw, 5rem); overflow: hidden; }
.hero-img { position: absolute; inset: 0; background: url("/landing-page.jpg") center / cover no-repeat;
  z-index: 0; }
.hero-veil { position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(180deg, rgba(251,247,240,0.55) 0%, rgba(251,247,240,0.30) 35%, rgba(251,247,240,0.65) 100%); }
.hd { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center;
  padding: 1.75rem 0; }
.logo { display: inline-flex; align-items: center; gap: 0.6rem; font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700;
  text-decoration: none; color: var(--ink); }
.logo-img { height: 34px; width: auto; display: block; }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.75; }
.nav a:hover { opacity: 1; }
.hero-body { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column;
  justify-content: center; max-width: 1100px; width: 100%; margin: 0 auto; padding: 2rem 0 4rem; }
.hero-eyebrow { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600; color: var(--gold); margin-bottom: 1.1rem; max-width: 60ch; line-height: 1.5; }
.hero-body h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.4rem, 6vw, 4rem);
  line-height: 1.08; font-weight: 500; margin: 0 0 1.5rem; letter-spacing: -0.02em; max-width: 16ch; }
.lede { font-size: clamp(1.1rem, 2vw, 1.35rem); line-height: 1.6; color: #3a3446; max-width: 46ch;
  margin: 0 0 3rem; }
.doors { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; max-width: 760px; }

/* frosted cards */
.door { position: relative; border-radius: 18px; }
.door-in { position: relative; z-index: 1; border-radius: 16px; padding: 1.6rem;
  background: rgba(255,255,255,0.55); backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid rgba(255,255,255,0.6); display: flex; flex-direction: column; height: 100%; margin: 2px;
  box-shadow: 0 8px 32px rgba(26,26,46,0.10); }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0;
  background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--violet) 12%, transparent 30%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
.lit-gold { background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); animation-delay: -2.2s; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.door h2 { font-family: Newsreader, Georgia, serif; font-size: 1.4rem; font-weight: 500; margin: 0.3rem 0 0.6rem; }
.door p { font-size: 0.98rem; line-height: 1.5; color: #4a4456; margin: 0 0 1.4rem; flex: 1; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.7rem; font-weight: 600; }
.btn { display: inline-block; text-align: center; padding: 0.8rem 1.3rem; border-radius: 10px;
  font-size: 0.98rem; font-weight: 600; text-decoration: none; cursor: pointer; transition: transform 0.12s; }
.btn:hover { transform: translateY(-2px); }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: rgba(255,255,255,0.4); color: var(--ink); border: 1.5px solid var(--ink); }
.scroll-cue { position: relative; z-index: 2; text-align: center; padding-bottom: 1.5rem;
  font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: #8a7d62; opacity: 0.7; }

/* BANDS */
.band { background: var(--paper); padding: clamp(3.5rem, 8vw, 6rem) clamp(1.5rem, 5vw, 5rem); }
.band-alt { background: #fff; }
.inner { max-width: 760px; margin: 0 auto; }
.stats { display: flex; gap: 3rem; padding-bottom: 2rem; margin-bottom: 2rem; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; }
.sn { font-family: ui-monospace, monospace; font-size: 2rem; color: var(--gold); font-weight: 600; }
.sl { font-size: 0.85rem; color: #8a8073; margin-top: 0.3rem; }
.frow { display: grid; grid-template-columns: 7rem 1fr auto; gap: 1rem; align-items: baseline; padding: 0.7rem 0; border-bottom: 1px dashed var(--line); }
.fhandle { font-family: ui-monospace, monospace; font-size: 0.82rem; color: var(--violet); }
.ftitle { font-family: Newsreader, Georgia, serif; font-size: 1.05rem; color: #463f52; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.famt { font-family: ui-monospace, monospace; color: var(--gold); font-weight: 600; font-size: 0.95rem; }
.empty { font-size: 1rem; line-height: 1.55; color: #8a8073; font-style: italic; padding: 0.5rem 0; }
.steps { list-style: none; counter-reset: s; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.1rem; }
.steps li { counter-increment: s; position: relative; padding-left: 2.6rem; font-size: 1.12rem; line-height: 1.5; color: #4a4456; }
.steps li::before { content: counter(s, decimal-leading-zero); position: absolute; left: 0; top: 0.15rem; font-family: ui-monospace, monospace; font-size: 0.85rem; color: var(--gold); font-weight: 700; }
.steps b { color: var(--ink); }
.how-lede { font-size: 1.15rem; line-height: 1.6; color: #3a3446; max-width: 60ch; margin: 0 0 2.5rem; }
.how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2rem; }
.how-card { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 1.5rem 1.4rem; transition: border-color 0.2s, transform 0.2s; }
.how-card:hover { border-color: var(--gold); transform: translateY(-3px); }
.how-num { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--gold); font-weight: 700; margin-bottom: 0.8rem; letter-spacing: 0.05em; }
.how-title { font-family: Newsreader, Georgia, serif; font-size: 1.22rem; font-weight: 500; color: var(--ink); margin-bottom: 0.6rem; line-height: 1.25; }
.how-card p { font-size: 0.96rem; line-height: 1.55; color: #4a4456; margin: 0; }
.how-map-label { margin-bottom: 1.5rem; }
@media (max-width: 900px) { .how-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .how-grid { grid-template-columns: 1fr; } }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem, 5vw, 5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; }
@media (max-width: 620px) {
  .doors { grid-template-columns: 1fr; }
  .stats { gap: 1.75rem; }
  .ft-in { flex-direction: column; gap: 0.5rem; }
  .frow { grid-template-columns: 5rem 1fr auto; }
}

/* ===== CREATOR GRID ===== */
.grid-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; margin-bottom: 2rem; flex-wrap: wrap; }
.grid-title { font-family: Newsreader, Georgia, serif; font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 500; margin: 0.4rem 0 0; line-height: 1.1; }
.grid-stat { display: flex; flex-direction: column; align-items: flex-end; }
.gs-num { font-family: ui-monospace, monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold); }
.gs-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8073; }
.cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.ccard { display: flex; flex-direction: column; gap: 0.4rem; padding: 1.4rem; background: #fff; border: 1px solid var(--line); border-radius: 14px; text-decoration: none; color: var(--ink); transition: transform 0.14s, box-shadow 0.14s; }
.ccard:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(26,26,46,0.08); border-color: var(--gold); }
.cc-top { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.2rem; }
.cc-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.cc-avatar-ph { display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--paper); font-family: Newsreader, Georgia, serif; font-size: 1.1rem; font-weight: 500; }
.cc-cat { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); font-weight: 600; }
.cc-agent { font-family: Newsreader, Georgia, serif; font-size: 1.25rem; font-weight: 500; line-height: 1.15; }
.cc-by { font-size: 0.82rem; color: #8a8073; }
.cc-tag { font-size: 0.9rem; color: #4a4456; line-height: 1.45; margin-top: 0.2rem; }
.cc-foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid var(--line); }
.cc-earned { font-family: ui-monospace, monospace; font-size: 0.85rem; font-weight: 700; color: var(--gold); }
.cc-chunks { font-family: ui-monospace, monospace; font-size: 0.74rem; color: #8a8073; }
.empty { color: #8a8073; font-size: 1.02rem; padding: 1.5rem 0; }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
