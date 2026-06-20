"use client";

import { useState, useEffect } from "react";
import FlowDiagram from "./components/FlowDiagram";
import { motion } from "framer-motion";

type Ledger = {
  stats: { contributors: number; experiences: number; queries: number; totalPaid: number };
  recent: { handle: string; title: string; amount: number }[];
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function Landing() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  useEffect(() => {
    fetch("/api/ledger").then((r) => r.ok && r.json().then(setLedger)).catch(() => {});
  }, []);

  const hasPayouts = ledger && ledger.recent.length > 0;

  return (
    <div className="pg">
      <style>{css}</style>

      {/* ===== HERO: full-bleed image ===== */}
      <section className="hero">
        <div className="hero-img" />
        <div className="hero-veil" />

        <header className="hd">
          <a href="/" className="logo">empeiria</a>
          <nav className="nav">
            <a href="/ask">Ask</a>
            <a href="/speak">Speak</a>
          </nav>
        </header>

        <div className="hero-body">
          <motion.h1 initial="hidden" animate="show" custom={0} variants={fadeUp}>
            Lived experience,<br />finally worth something.
          </motion.h1>
          <motion.p className="lede" initial="hidden" animate="show" custom={1} variants={fadeUp}>
            The hardest things you've come through are worth real money to someone
            facing them now. Empeiria pays the people who've been there — the moment
            their experience helps.
          </motion.p>

          <motion.div className="doors" initial="hidden" animate="show" custom={2} variants={fadeUp}>
            <div className="door lit">
              <span className="lit-border" aria-hidden />
              <div className="door-in">
                <div className="eyebrow">if you're struggling</div>
                <h2>Ask someone who survived it.</h2>
                <p>An agent reads real accounts from people who've lived it, and pays only the ones it actually uses.</p>
                <a href="/ask" className="btn btn-solid">Ask a question →</a>
              </div>
            </div>
            <div className="door lit">
              <span className="lit-border lit-gold" aria-hidden />
              <div className="door-in">
                <div className="eyebrow">if you've been there</div>
                <h2>Get paid for what you learned.</h2>
                <p>Share your story as text, voice, or video. Stay anonymous, earn every time it helps a stranger.</p>
                <a href="/speak" className="btn btn-ghost">Speak your experience →</a>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="scroll-cue" aria-hidden>scroll</div>
      </section>

      {/* ===== PROOF ===== */}
      <section className="band">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="stats">
            <div className="stat"><span className="sn">${(ledger?.stats.totalPaid ?? 0).toFixed(4)}</span><span className="sl">paid to contributors</span></div>
            <div className="stat"><span className="sn">{ledger?.stats.contributors ?? 0}</span><span className="sl">anonymous voices</span></div>
            <div className="stat"><span className="sn">{ledger?.stats.queries ?? 0}</span><span className="sl">questions answered</span></div>
          </div>
          <div className="feed">
            <div className="eyebrow">recent payouts — real, anonymous, on-chain</div>
            {hasPayouts ? (
              ledger!.recent.slice(0, 5).map((r, i) => (
                <motion.div key={i} className="frow"
                  initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                  <span className="fhandle">{r.handle}</span>
                  <span className="ftitle">{r.title}</span>
                  <span className="famt">+${r.amount.toFixed(6)}</span>
                </motion.div>
              ))
            ) : (
              <div className="empty">No payouts yet. When someone asks and an experience helps, the payment appears here — live.</div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ===== HOW ===== */}
      <section className="band band-alt">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="eyebrow">how it works</div>
          <ol className="steps">
            <li><b>Someone asks,</b> setting a small budget cap for the answer.</li>
            <li><b>The agent decides</b> — keeping experiences that genuinely fit, discarding the rest.</li>
            <li><b>It pays for what it uses,</b> in proportion to how much each experience shaped the answer. Unused budget is refunded.</li>
            <li><b>Everyone stays anonymous.</b> Contributors earn into private wallets. No names, ever.</li>
          </ol>
        </motion.div>
 </section>

      <section className="band">
        <div className="inner">
          <FlowDiagram />
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
.logo { font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700;
  text-decoration: none; color: var(--ink); }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.75; }
.nav a:hover { opacity: 1; }
.hero-body { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column;
  justify-content: center; max-width: 1100px; width: 100%; margin: 0 auto; padding: 2rem 0 4rem; }
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
.ft { background: var(--ink); padding: 2rem clamp(1.5rem, 5vw, 5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; }
@media (max-width: 620px) {
  .doors { grid-template-columns: 1fr; }
  .stats { gap: 1.75rem; }
  .ft-in { flex-direction: column; gap: 0.5rem; }
  .frow { grid-template-columns: 5rem 1fr auto; }
}
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
