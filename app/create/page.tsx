"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const CATEGORIES = ["startups", "marketing", "design", "coding", "finance", "crypto", "education", "general"];

export default function Create() {
  const [step, setStep] = useState<1 | 2 | 3 | "dash">(1);
  const [earned, setEarned] = useState(0);
  const [wDest, setWDest] = useState("");
  const [wAmount, setWAmount] = useState("");
 const [wResult, setWResult] = useState<string | null>(null);
  const [dashAvatar, setDashAvatar] = useState<string | null>(null);

  // profile
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("startups");
  const [agentLabel, setAgentLabel] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [creator, setCreator] = useState<{ creatorId: string; handle: string; name: string; agentLabel: string; accessKey?: string } | null>(null);
  const [returnKey, setReturnKey] = useState("");
  const [returning, setReturning] = useState(false);

  // knowledge
  const [contentMode, setContentMode] = useState<"text" | "audio">("text");
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [ingested, setIngested] = useState<{ chunks: number }[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setAvatarBusy(true); setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `creator-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("submissions").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
    } catch (e) { setError((e as Error).message); }
    finally { setAvatarBusy(false); }
  }

  async function createProfile() {
    if (!name.trim() || handle.trim().length < 3) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/creator/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, handle, category, agentLabel, agentTagline: tagline, avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "signup failed");
      setCreator(data);
      setStep(2);
 } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

async function changeAvatar(file: File) {
    setAvatarBusy(true); setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `creator-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("submissions").getPublicUrl(path);
      const res = await fetch("/api/creator/update-avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: returnKey, avatarUrl: pub.publicUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "update failed");
      setDashAvatar(pub.publicUrl);
    } catch (e) { setError((e as Error).message); }
    finally { setAvatarBusy(false); }
  }

  async function withdraw() {
    if (!wDest.trim() || !wAmount) return;
    setBusy(true); setError(null); setWResult(null);
    try {
      const res = await fetch("/api/creator/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: returnKey, destination: wDest, amount: Number(wAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "withdrawal failed");
      setWResult(data.txHash);
      setEarned((e) => e - Number(wAmount));
      setWAmount(""); setWDest("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function accessReturn() {
    if (returnKey.trim().length < 4) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/creator/access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: returnKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "access failed");
    setCreator({ creatorId: data.creatorId, handle: data.handle, name: data.name, agentLabel: data.agentLabel });
      setEarned(data.totalEarned ?? 0);
      setDashAvatar(data.avatarUrl ?? null);
      setReturning(true);
      setStep("dash");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function ingest() {
    if (!creator) return;
    setBusy(true); setError(null);
    try {
      let body: Record<string, unknown> = { creatorId: creator.creatorId, sourceName: sourceName || undefined };
      if (contentMode === "audio") {
        if (!audioBlob) throw new Error("choose an audio file");
        const ext = audioBlob.type.includes("webm") ? "webm" : "m4a";
        const path = `creator-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("submissions").upload(path, audioBlob, { contentType: audioBlob.type });
        if (upErr) throw new Error(`upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("submissions").getPublicUrl(path);
        body.audioUrl = pub.publicUrl;
      } else {
        if (text.trim().length < 100) throw new Error("paste at least a paragraph of your knowledge");
        body.text = text;
      }
      const res = await fetch("/api/creator/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.accepted === false) throw new Error(data.error ?? data.reason ?? "ingestion failed");
      setIngested((prev) => [...prev, { chunks: data.chunks }]);
      setText(""); setSourceName(""); setAudioBlob(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const totalChunks = ingested.reduce((s, x) => s + x.chunks, 0);

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
        <a href="/" className="logo"><img src="/empeiria-logo.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/ask">Ask</a><a href="/create" className="active">Create</a></nav>
      </header>

      <section className="band hero">
        <div className="inner">
          <div className="eyebrow">become a creator</div>
          <h1>Turn what you know<br />into a paid AI agent.</h1>
          <p className="lede">Upload your writing, talks, or notes. Empeiria builds them into a knowledge agent. Every time someone learns from it, you earn — in real money, on-chain.</p>
        </div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          <div className="steps-rail">
           <span className={`srail ${step === "dash" || step >= 1 ? "on" : ""}`}>1 · Profile</span>
            <span className={`srail ${step !== "dash" && step >= 2 ? "on" : ""}`}>2 · Knowledge</span>
            <span className={`srail ${step !== "dash" && step >= 3 ? "on" : ""}`}>3 · Live</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
               <div className="card-in">
                  <div className="avatar-row">
                    <label className="avatar-pick">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="avatar-img" /> : <span className="avatar-ph">{avatarBusy ? "…" : "+"}</span>}
                      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                    </label>
                    <div className="avatar-hint">Add a photo<br /><span>your agent carries it</span></div>
                  </div>
                  <input className="f-line" placeholder="Your name (e.g. Jane Doe)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                  <div className="handle-row">
                    <span className="at">@</span>
                    <input className="f-line nomargin" placeholder="handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={20} />
                  </div>
                  <div className="cats">
                    {CATEGORIES.map((c) => (
                      <button key={c} className={`cat ${category === c ? "cat-on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
                    ))}
                  </div>
                  <input className="f-line" placeholder="Agent name (optional, e.g. Startup Mentor Agent)" value={agentLabel} onChange={(e) => setAgentLabel(e.target.value)} maxLength={60} />
                  <input className="f-line" placeholder="One-line tagline (optional)" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={100} />
               {error && <div className="err">{error}</div>}
                  <button className="btn btn-solid" onClick={createProfile} disabled={busy || !name.trim() || handle.length < 3}>
                    {busy ? "Creating…" : "Create my agent →"}
                  </button>
                  <div className="return-row">
                    <span className="return-label">Already have an agent?</span>
                    <input className="return-input" placeholder="Paste access key (EMP-XXXX-XXXX)" value={returnKey} onChange={(e) => setReturnKey(e.target.value)} />
                    <button className="return-btn" onClick={accessReturn} disabled={busy || returnKey.trim().length < 4}>Load →</button>
                  </div>
                </div>
              </motion.div>
            )}
            {step === 2 && creator && (
              <motion.div key="s2" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in">
                  <div className="agent-banner">
                    <b>{creator.agentLabel}</b> · @{creator.handle}
                    {totalChunks > 0 && <span className="chunk-tag">{totalChunks} knowledge chunks added</span>}
                  </div>
                  <div className="modes">
                    <button className={`mode ${contentMode === "text" ? "mode-on" : ""}`} onClick={() => setContentMode("text")}>Paste text</button>
                    <button className={`mode ${contentMode === "audio" ? "mode-on" : ""}`} onClick={() => setContentMode("audio")}>Upload audio</button>
                  </div>
                  {contentMode === "text" ? (
                    <>
                      <input className="f-line" placeholder="Source name (e.g. my pricing playbook)" value={sourceName} onChange={(e) => setSourceName(e.target.value)} maxLength={80} />
                      <textarea className="f-body" rows={8} placeholder="Paste your article, newsletter, notes, transcript — the knowledge you want your agent to know." value={text} onChange={(e) => setText(e.target.value)} />
                    </>
                  ) : (
                    <div className="audio-pick">
                      <label className="btn btn-ghost">
                        {audioBlob ? "✓ Audio selected" : "Choose audio file"}
                        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => setAudioBlob(e.target.files?.[0] ?? null)} />
                      </label>
                      <input className="f-line" placeholder="Source name (e.g. my podcast episode)" value={sourceName} onChange={(e) => setSourceName(e.target.value)} maxLength={80} />
                      <p className="hint">Your audio is transcribed by a paid Transcription Agent, then added to your knowledge.</p>
                    </div>
                  )}
                  {error && <div className="err">{error}</div>}
                  <div className="row2">
                    <button className="btn btn-solid" onClick={ingest} disabled={busy}>
                      {busy ? "Building your agent…" : "Add to my agent →"}
                    </button>
                    {totalChunks > 0 && (
                      <button className="btn btn-ghost" onClick={() => setStep(3)}>Done — go live →</button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === "dash" && creator && (
              <motion.div key="dash" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in">
                 <div className="dash-id">
                    <label className="avatar-pick dash-avatar">
                      {dashAvatar ? <img src={dashAvatar} alt="" className="avatar-img" /> : <span className="avatar-ph">{avatarBusy ? "…" : creator.name.charAt(0).toUpperCase()}</span>}
                      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) changeAvatar(f); }} />
                    </label>
                    <div>
                      <div className="eyebrow">your agent</div>
                      <h2 style={{ fontFamily: "Newsreader, Georgia, serif", fontWeight: 500, fontSize: "1.8rem", margin: "0.2rem 0 0" }}>{creator.agentLabel}</h2>
                      <div className="dash-change-hint">tap photo to change</div>
                    </div>
                  </div>
                  <div className="agent-banner">@{creator.handle}</div>
                 <div className="dash-earned">
                    <span className="de-num">${earned.toFixed(4)}</span>
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
                    <button className="btn btn-solid" onClick={withdraw} disabled={busy || !wDest.trim() || !wAmount || Number(wAmount) > earned}>
                      {busy ? "Sending…" : "Withdraw →"}
                    </button>
                  </div>
                  <div className="row2">
                    <button className="btn btn-ghost" onClick={() => setStep(2)}>Add more knowledge →</button>
                    <a className="btn btn-ghost" href={`/creator/${creator.handle}`}>View public profile →</a>
                  </div>
                </div>
              </motion.div>
            )}
            {step === 3 && creator && (
              <motion.div key="s3" className="card lit" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="lit-border lit-gold" aria-hidden />
                <div className="card-in live-in">
                  <div className="eyebrow">your agent is live</div>
                  <h2>{creator.agentLabel}</h2>
                  <p className="live-sub">{totalChunks} knowledge chunks · ready to earn</p>
              <div className="share-box">
                    <div className="share-label">anyone can now ask your agent directly:</div>
                    <code className="share-code">@{creator.handle} &lt;their question&gt;</code>
                  </div>
                  {creator.accessKey && (
                    <div className="key-box">
                      <div className="key-label">⚠ save your access key — you'll need it to add knowledge or withdraw later</div>
                      <code className="key-code">{creator.accessKey}</code>
                    </div>
                  )}
                  {creator.accessKey && (
                    <div className="key-box">
                      <div className="key-label">⚠ save your access key — you'll need it to add knowledge or withdraw earnings later</div>
                      <code className="key-code">{creator.accessKey}</code>
                    </div>
                  )}
                  <div className="row2">
                   <a className="btn btn-solid" href={`/marketplace`}>Try asking your agent →</a>
                    <button className="btn btn-ghost" onClick={() => setStep(2)}>Add more knowledge</button>
                  </div>
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
.inner { max-width: 680px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem,5vw,3.3rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.4rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem,2vw,1.28rem); line-height: 1.6; color: #3a3446; max-width: 54ch; margin: 0; }
.steps-rail { display: flex; gap: 1.5rem; margin-bottom: 2rem; }
.srail { font-size: 0.78rem; font-weight: 600; color: #b3a890; text-transform: uppercase; letter-spacing: 0.08em; }
.srail.on { color: var(--gold); }
.card { position: relative; border-radius: 18px; }
.card-in { position: relative; z-index: 1; background: var(--paper); border-radius: 16px; padding: 2rem; margin: 2px; }
.lit { padding: 0; }
.lit-border { position: absolute; inset: 0; border-radius: 18px; padding: 2px; z-index: 0; background: conic-gradient(from var(--ang,0deg), transparent 0%, var(--gold) 12%, transparent 30%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: spin 4.5s linear infinite; }
@property --ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --ang: 360deg; } }
.f-line { width: 100%; border: none; border-bottom: 1.5px solid var(--line); background: transparent; font-size: 1.05rem; padding: 0.6rem 0; margin-bottom: 1.3rem; outline: none; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
.f-line:focus { border-color: var(--gold); }
.nomargin { margin-bottom: 0; }
.handle-row { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 1.3rem; }
.at { font-size: 1.2rem; color: #8a7d62; font-family: ui-monospace, monospace; }
.cats { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 1.3rem; }
.cat { padding: 0.4rem 0.9rem; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; font-size: 0.82rem; font-weight: 600; cursor: pointer; color: #8a8073; text-transform: capitalize; }
.cat-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.f-body { width: 100%; border: 1px solid var(--line); border-radius: 12px; background: #fff; font-size: 1.02rem; line-height: 1.6; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1rem; outline: none; resize: vertical; color: var(--ink); margin-bottom: 1.2rem; }
.f-body:focus { border-color: var(--gold); }
.modes { display: flex; gap: 0.5rem; margin-bottom: 1.3rem; }
.mode { padding: 0.55rem 1.2rem; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; font-size: 0.9rem; font-weight: 600; cursor: pointer; color: #8a8073; }
.mode-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.agent-banner { font-size: 1rem; color: #3a3446; margin-bottom: 1.4rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
.agent-banner b { font-family: Newsreader, Georgia, serif; font-size: 1.2rem; font-weight: 500; }
.chunk-tag { font-family: ui-monospace, monospace; font-size: 0.72rem; color: #3f8c5f; background: #eaf5ee; padding: 0.2rem 0.6rem; border-radius: 999px; }
.audio-pick { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.2rem; }
.hint { font-size: 0.88rem; color: #8a8073; margin: 0; line-height: 1.5; }
.btn { padding: 0.8rem 1.5rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; text-decoration: none; display: inline-block; text-align: center; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.row2 { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; }
.err { color: var(--clay); font-size: 0.9rem; margin-bottom: 1rem; }
.live-in { text-align: center; }
.live-in h2 { font-family: Newsreader, Georgia, serif; font-size: 2rem; font-weight: 500; margin: 0 0 0.4rem; }
.live-sub { font-family: ui-monospace, monospace; font-size: 0.85rem; color: #3f8c5f; margin: 0 0 1.6rem; }
.share-box { background: #fff; border: 1px dashed var(--gold); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.6rem; }
.share-label { font-size: 0.78rem; color: #8a7d62; margin-bottom: 0.6rem; }
.share-code { font-family: ui-monospace, monospace; font-size: 1.05rem; color: var(--ink); font-weight: 600; }
.live-in .row2 { justify-content: center; }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 680px; margin: 0 auto; }
.avatar-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.6rem; }
.avatar-pick { width: 72px; height: 72px; border-radius: 50%; border: 2px dashed var(--line); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; background: #fff; flex-shrink: 0; transition: border-color 0.15s; }
.avatar-pick:hover { border-color: var(--gold); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-ph { font-size: 1.8rem; color: #b3a890; font-weight: 300; }
.avatar-hint { font-size: 0.9rem; color: var(--ink); font-weight: 600; line-height: 1.3; }
.avatar-hint span { font-weight: 400; color: #8a8073; font-size: 0.8rem; }
.return-row { display: flex; align-items: center;
.return-label { font-size: 0.82rem; color: #8a7d62; font-weight: 600; white-space: nowrap; }
.return-input { flex: 1; min-width: 180px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font-family: ui-monospace, monospace; font-size: 0.82rem; padding: 0.5rem 0.7rem; outline: none; color: var(--ink); }
.return-input:focus { border-color: var(--gold); }
.return-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 1.5px solid var(--ink); background: transparent; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--ink); }
.return-btn:disabled { opacity: 0.4; cursor: default; }
.dash-id { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
.dash-avatar { width: 64px; height: 64px; flex-shrink: 0; }
.dash-change-hint { font-size: 0.72rem; color: #b3a890; margin-top: 0.2rem; }
.dash-earned { display: flex; flex-direction: column;
.de-num { font-family: ui-monospace, monospace; font-size: 2rem; font-weight: 700; color: var(--gold); }
.de-label { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8073; }
.withdraw-box { margin-bottom: 1.4rem; }
.wb-head { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7d62; font-weight: 600; margin-bottom: 1rem; }
.de-label { margin-top: 0.3rem; }
.w-ok { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; color: #3f8c5f; font-size: 0.9rem; margin-bottom: 0.9rem; font-family: ui-monospace, monospace; }
.w-tx { color: var(--violet); text-decoration: underline; }
.w-copy { border: 1px solid var(--line); background: #fff; border-radius: 6px; font-size: 0.74rem; padding: 0.2rem 0.55rem; cursor: pointer; color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
.w-copy:hover { border-color: var(--gold); }
.key-box { background: #fdf6e3;
.key-label { font-size: 0.78rem; color: #8a6d1f; margin-bottom: 0.5rem; }
.key-code { font-family: ui-monospace, monospace; font-size: 1.15rem; color: var(--ink); font-weight: 700; letter-spacing: 0.05em; }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
