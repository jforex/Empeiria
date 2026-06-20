"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function Speak() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function join() {
    if (!email.trim()) return;
    setStatus("loading"); setMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "creator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="pg">
      <style>{css}</style>

      <header className="hd">
        <a href="/" className="logo">empeiria</a>
        <nav className="nav">
          <a href="/ask">Ask</a>
          <a href="/speak" className="active">Speak</a>
        </nav>
      </header>

      <section className="band hero">
        <motion.div className="inner" initial="hidden" animate="show" custom={0} variants={fadeUp}>
          <div className="eyebrow">speak your experience</div>
          <h1>What you survived<br />could carry someone else through.</h1>
          <p className="lede">
            Somewhere, someone is facing the exact thing you already made it through.
            Your experience is the map they don't have. Share it once — and every time
            it helps a stranger, you earn. You're never named. You just get paid.
          </p>
        </motion.div>
      </section>

      <section className="band band-alt">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="eyebrow">three ways to share</div>
          <div className="ways">
            <div className="way">
              <div className="way-mark">A</div>
              <h3>Write it</h3>
              <p>Type your experience in your own words. The honest, specific version — what happened, what you did, what you'd tell someone in it now.</p>
            </div>
            <div className="way">
              <div className="way-mark">B</div>
              <h3>Speak it</h3>
              <p>Record a voice note. Talking is easier than writing — we transcribe it, and the words enter the pool just the same.</p>
            </div>
            <div className="way">
              <div className="way-mark">C</div>
              <h3>Film it</h3>
              <p>Upload a video of your own. We transcribe what you said; your experience becomes searchable and payable. Your own footage only.</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="band">
        <motion.div className="inner"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="eyebrow">why it's worth it</div>
          <ul className="why">
            <li><b>You stay anonymous.</b> No name, no face, no byline. You're a private wallet that fills up.</li>
            <li><b>You earn from use, not posting.</b> When the agent uses your experience to help someone, you're paid in proportion to how much it mattered.</li>
            <li><b>Small payments add up.</b> A single experience can help many people over time — each a tiny payment that was never possible before sub-cent settlement.</li>
            <li><b>It only has to be yours.</b> Real, lived, first-person. That's the whole bar.</li>
          </ul>
        </motion.div>
      </section>

      <section className="band band-alt">
        <motion.div className="inner join-wrap"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={fadeUp}>
          <div className="join lit">
            <span className="lit-border lit-gold" aria-hidden />
            <div className="join-in">
              {status === "done" ? (
                <>
                  <h2>You're on the list.</h2>
                  <p className="join-p">We'll reach out the moment contributing opens. Your experience will be worth something.</p>
                </>
              ) : (
                <>
                  <div className="eyebrow">be first to contribute</div>
                  <h2>Contributing opens soon.</h2>
                  <p className="join-p">
                    We're onboarding the first anonymous contributors now. Leave your email
                    and you'll be among the first to share — and earn.
                  </p>
                  <div className="join-row">
                    <input
                      className="join-input" type="email" placeholder="you@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && join()}
                    />
                    <button className="btn btn-solid" onClick={join} disabled={status === "loading" || !email.trim()}>
                      {status === "loading" ? "Joining…" : "Join the waitlist"}
                    </button>
                  </div>
                  {status === "error" && <div className="join-err">{msg}</div>}
                </>
              )}
            </div>
          </div>
        </motion.div>
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
.hd { display: flex; justify-content: space-between; align-items: center;
  padding: 1.75rem clamp(1.5rem, 5vw, 5rem); max-width: 1100px; margin: 0 auto; }
.logo { font-size: 1.15rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; text-decoration: none; color: var(--ink); }
.nav { display: flex; gap: 1.75rem; }
.nav a { color: var(--ink); text-decoration: none; font-size: 0.92rem; font-weight: 600; opacity: 0.7; }
.nav a:hover, .nav a.active { opacity: 1; }
.band { padding: clamp(3rem, 7vw, 5.5rem) clamp(1.5rem, 5vw, 5rem); }
.band-alt { background: #fff; }
.hero { padding-top: clamp(1.5rem, 4vw, 3rem); }
.inner { max-width: 760px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.5rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem, 2vw, 1.3rem); line-height: 1.6; color: #3a3446; max-width: 50ch; margin: 0; }
.ways { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.way { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 1.4rem; }
.way-mark { font-family: ui-monospace, monospace; font-size: 0.9rem; font-weight: 700; color: var(--gold); width: 2rem; height: 2rem; border: 1.5px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
.way h3 { font-family: Newsreader, Georgia, serif; font-size: 1.25rem; font-weight: 500; margin: 0 0 0.5rem; }
.way p { font-size: 0.95rem; line-height: 1.5; color: #4a4456; margin: 0; }
.why { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.1rem; }
.why li { font-size: 1.1rem; line-height: 1.55; color: #4a4456; padding-left: 1.3rem; position: relative; }
.why li::before { content: "—"; position: absolute; left: 0; color: var(--gold); font-weight: 700; }
.why b { color: var(--ink); }
.join-wrap { display: flex; justify-content: center; }
.join { position: relative; border-radius: 18px; width: 100%; }
.join-in { position: relative; z-index: 1; background: var(--paper); border-radius: 16px; padding: 2.2rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0;
  background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.join h2 { font-family: Newsreader, Georgia, serif; font-size: 1.7rem; font-weight: 500; margin: 0 0 0.7rem; }
.join-p { font-size: 1rem; line-height: 1.55; color: #4a4456; margin: 0 0 1.5rem; max-width: 46ch; }
.join-row { display: flex; gap: 0.7rem; flex-wrap: wrap; }
.join-input { flex: 1; min-width: 220px; padding: 0.8rem 1rem; border: 1px solid var(--line); border-radius: 10px; font-size: 1rem; background: #fff; color: var(--ink); outline: none; }
.join-input:focus { border-color: var(--gold); }
.btn { display: inline-block; text-align: center; padding: 0.8rem 1.4rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; text-decoration: none; cursor: pointer; border: none; transition: transform 0.12s; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.join-err { color: #C1543A; font-size: 0.9rem; margin-top: 0.8rem; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem, 5vw, 5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 760px; margin: 0 auto; }
@media (max-width: 620px) {
  .ways { grid-template-columns: 1fr; }
  .ft-in { flex-direction: column; gap: 0.5rem; }
}
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
