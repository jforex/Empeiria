"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

type TextResult =
  | { accepted: true; claimKey: string; domain: string; quality: number; title: string; reason: string; con?: { label: string; feeRate: number } | null; anchor?: { storyHash: string; txHash: string } | null }
  | { accepted: false; reason: string };

type AudioResult =
  | { accepted: true; claimKey: string; domain: string; quality: number; title: string; reason: string; transcript: string; transcriptionTx: string | null; quote: { price: number; breakdown: string }; surcharge: number; totalFee: number; con?: { label: string; feeRate: number } | null; anchor?: { storyHash: string; txHash: string } | null }
  | { accepted: false; declined?: boolean; reason: string; transcript?: string };

export default function Speak() {
  const [mode, setMode] = useState<"text" | "voice">("text");

  // text
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tStage, setTStage] = useState<"idle" | "judging" | "result">("idle");
  const [tResult, setTResult] = useState<TextResult | null>(null);

  // voice
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [vStage, setVStage] = useState<"idle" | "uploading" | "transcribing" | "result">("idle");
  const [vResult, setVResult] = useState<AudioResult | null>(null);
  const [vStatus, setVStatus] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [returningKey, setReturningKey] = useState("");

  async function submitText() {
    if (!title.trim() || body.trim().length < 120) return;
    setTStage("judging"); setError(null); setTResult(null);
    try {
      const res = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, claimKey: returningKey.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setTimeout(() => { setTResult(data); setTStage("result"); }, 600);
    } catch (e) { setError((e as Error).message); setTStage("idle"); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioDuration(Math.round((Date.now() - startRef.current) / 1000));
        stream.getTracks().forEach((t) => t.stop());
      };
      startRef.current = Date.now();
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError("Could not access microphone. You can upload an audio file instead.");
    }
  }
  function stopRecording() { mediaRef.current?.stop(); setRecording(false); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setAudioBlob(f);
      const audio = new Audio(URL.createObjectURL(f));
      audio.onloadedmetadata = () => setAudioDuration(Math.round(audio.duration));
    }
  }

  async function submitVoice() {
    if (!audioBlob) return;
    setError(null); setVResult(null);
    try {
      setVStage("uploading"); setVStatus("Uploading your audio…");
      const ext = audioBlob.type.includes("webm") ? "webm" : "m4a";
      const path = `audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, audioBlob, { contentType: audioBlob.type });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("submissions").getPublicUrl(path);

      setVStage("transcribing");
      setVStatus("The Fees Agent is paying the Transcription Agent to convert your voice to text…");
      const res = await fetch("/api/submit-audio", {
        method: "POST", headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ audioUrl: pub.publicUrl, title: "", durationSec: audioDuration, claimKey: returningKey.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setVResult(data); setVStage("result");
    } catch (e) { setError((e as Error).message); setVStage("idle"); }
  }

  function resetAll() {
    setTitle(""); setBody(""); setTStage("idle"); setTResult(null);
    setAudioBlob(null); setAudioDuration(0); setVStage("idle"); setVResult(null); setError(null);
  }

  return (
    <div className="pg">
      <style>{css}</style>
      <header className="hd">
       <a href="/" className="logo"><img src="/empeiria-logo1.png" alt="" className="logo-img" />empeiria</a>
        <nav className="nav"><a href="/ask">Ask</a><a href="/speak" className="active">Speak</a></nav>
      </header>

      <section className="band hero">
        <motion.div className="inner" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="eyebrow">speak your experience</div>
          <h1>What you survived<br />could carry someone else through.</h1>
          <p className="lede">Share it once — by writing, or in your own voice. A gate agent confirms it's real lived experience, then it enters the pool. Every time it helps a stranger, you earn. You're never named.</p>
        </motion.div>
      </section>

      <section className="band band-alt">
        <div className="inner">
          {tStage !== "result" && vStage !== "result" && (
            <>
             <div className="modes">
                <button className={`mode ${mode === "text" ? "mode-on" : ""}`} onClick={() => setMode("text")}>Write it</button>
                <button className={`mode ${mode === "voice" ? "mode-on" : ""}`} onClick={() => setMode("voice")}>Speak it</button>
              </div>
              <div className="returning">
                <span className="returning-label">Shared before?</span>
                <input className="returning-input" placeholder="Paste your claim key (EMP-XXXX-XXXX) to keep earnings together" value={returningKey} onChange={(e) => setReturningKey(e.target.value)} />
              </div>

              {mode === "text" ? (
                <div className="form lit">
                  <span className="lit-border lit-gold" aria-hidden />
                  <div className="form-in">
                    <input className="f-title" placeholder="Give it a short title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={tStage === "judging"} maxLength={80} />
                    <textarea className="f-body" rows={9} disabled={tStage === "judging"} placeholder="Tell it in your own words — what you actually went through, what you did, what you'd tell someone facing it now." value={body} onChange={(e) => setBody(e.target.value)} />
                    <div className="f-row">
                      <span className="f-count">{body.trim().length < 120 ? `${120 - body.trim().length} more characters` : "ready"}</span>
                      <button className="btn btn-solid" onClick={submitText} disabled={tStage === "judging" || !title.trim() || body.trim().length < 120}>
                        {tStage === "judging" ? "Gate agent reading…" : "Submit experience →"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form lit">
                  <span className="lit-border lit-gold" aria-hidden />
                  <div className="form-in voice-in">
                    <p className="voice-hint">Record your experience aloud, or upload an audio file. The Transcription Agent — a paid agent — will convert it to text. You only pay through the platform; your voice becomes searchable experience.</p>
                    <div className="voice-controls">
                      {!recording ? (
                        <button className="btn btn-solid" onClick={startRecording} disabled={vStage !== "idle"}>● Record</button>
                      ) : (
                        <button className="btn btn-rec" onClick={stopRecording}>■ Stop recording</button>
                      )}
                      <span className="voice-or">or</span>
                      <label className="btn btn-ghost upload-label">
                        Upload audio
                        <input type="file" accept="audio/*" onChange={onFile} disabled={vStage !== "idle"} hidden />
                      </label>
                    </div>
                    {audioBlob && vStage === "idle" && (
                      <div className="audio-ready">
                        <span>✓ Audio ready{audioDuration ? ` · ${audioDuration}s` : ""}</span>
                        <button className="btn btn-solid" onClick={submitVoice}>Transcribe & submit →</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {error && <div className="f-err">{error}</div>}
            </>
          )}

          {/* text judging */}
          <AnimatePresence>
            {tStage === "judging" && (
              <motion.div className="judging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="pulse" /> The gate agent is reading your experience…
              </motion.div>
            )}
          </AnimatePresence>

          {/* voice progress */}
          <AnimatePresence>
            {(vStage === "uploading" || vStage === "transcribing") && (
              <motion.div className="judging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="pulse" /> {vStatus}
              </motion.div>
            )}
          </AnimatePresence>

          {/* text result */}
          <AnimatePresence>
            {tStage === "result" && tResult && (
              <ResultCard result={tResult} onReset={resetAll} onRevise={() => { setTStage("idle"); setTResult(null); }} />
            )}
          </AnimatePresence>

          {/* voice result */}
          <AnimatePresence>
            {vStage === "result" && vResult && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {vResult.accepted ? (
                  <div className="verdict accept lit">
                    <span className="lit-border lit-gold" aria-hidden />
                    <div className="verdict-in">
                      <div className="eyebrow">transcribed & accepted</div>
                      <h2>"{vResult.title}"</h2>
                      <div className="transcript-box">
                        <div className="tb-label">what the Transcription Agent heard</div>
                        <p className="tb-text">{vResult.transcript}</p>
                      </div>
                      <div className="agent-line">
                        <span>Transcription Agent quoted <b>${vResult.quote.price.toFixed(6)}</b></span>
                        <span className="agent-bd">{vResult.quote.breakdown}</span>
                        {vResult.surcharge > 0 && <span className="agent-bd">+ ${vResult.surcharge.toFixed(6)} clarity surcharge (hard audio)</span>}
                        {vResult.transcriptionTx && <span className="agent-bd">paid · tx {vResult.transcriptionTx.slice(0, 10)}…</span>}
                      </div>
                      <p className="v-reason">{vResult.reason}</p>
                      <div className="v-meta">
                        <div><span className="v-k">domain</span><span className="v-v">{vResult.domain}</span></div>
                        <div><span className="v-k">quality</span><span className="v-v">{Math.round(vResult.quality * 100)}%</span></div>
                      </div>
                      <div className="claim">
                        <div className="claim-label">your private claim key — save it</div>
                        <div className="claim-key">{vResult.claimKey}</div>
                        <div className="claim-note">No account, no name. <a href="/earnings" style={{ color: "var(--gold)", fontWeight: 600 }}>Check earnings →</a></div>
                      </div>
                      {vResult.anchor && (
                        <div className="anchor">
                          <div className="anchor-label">⛓ anchored on Arc — permanent proof you authored this</div>
                          <div className="anchor-row"><span>story hash</span><code>{vResult.anchor.storyHash.slice(0, 18)}…</code></div>
                          <div className="anchor-row"><span>anchor tx</span><code>{vResult.anchor.txHash.slice(0, 18)}…</code></div>
                        </div>
                      )}
                      <button className="btn btn-ghost" onClick={resetAll}>Share another →</button>
                    </div>
                  </div>
                ) : (
                  <div className="verdict reject">
                    <div className="verdict-in">
                      <div className="eyebrow reject-eye">{vResult.declined ? "transcription declined" : "not yet accepted"}</div>
                      {vResult.transcript && (
                        <div className="transcript-box"><div className="tb-label">transcript</div><p className="tb-text">{vResult.transcript}</p></div>
                      )}
                      <p className="v-reason">{vResult.reason}</p>
                      <button className="btn btn-solid" onClick={resetAll}>Try again →</button>
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
            <li><b>A gate agent judges every submission.</b> Only genuine lived experience enters the pool.</li>
            <li><b>Voice becomes text, autonomously.</b> A Transcription Agent — paid by the platform via on-chain micropayment — converts your audio. No human touches it.</li>
            <li><b>You earn from use, not posting.</b> When the answer agent uses your experience, you're paid in proportion to how much it mattered.</li>
          </ul>
        </div>
      </section>

      <footer className="ft"><div className="inner ft-in"><span>Settled in USDC on Arc.</span><span>Built for the Lepton Agents Hackathon.</span></div></footer>
    </div>
  );
}

function ResultCard({ result, onReset, onRevise }: { result: TextResult; onReset: () => void; onRevise: () => void }) {
  return (
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
              <div className="claim-label">your private claim key — save it</div>
              <div className="claim-key">{result.claimKey}</div>
              <div className="claim-note">No account, no name. <a href="/earnings" style={{ color: "var(--gold)", fontWeight: 600 }}>Check earnings →</a></div>
            </div>
            {result.anchor && (
              <div className="anchor">
                <div className="anchor-label">⛓ anchored on Arc — permanent proof you authored this</div>
                <div className="anchor-row"><span>story hash</span><code>{result.anchor.storyHash.slice(0, 18)}…</code></div>
                <div className="anchor-row"><span>anchor tx</span><code>{result.anchor.txHash.slice(0, 18)}…</code></div>
              </div>
            )}
            <button className="btn btn-ghost" onClick={onReset}>Share another →</button>
          </div>
        </div>
      ) : (
        <div className="verdict reject">
          <div className="verdict-in">
            <div className="eyebrow reject-eye">not yet accepted</div>
            <p className="v-reason">{result.reason}</p>
            <button className="btn btn-solid" onClick={onRevise}>Revise and resubmit →</button>
          </div>
        </div>
      )}
    </motion.div>
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
.hero { padding-top: clamp(1.5rem,4vw,3rem); }
.inner { max-width: 720px; margin: 0 auto; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: #8a7d62; margin-bottom: 0.9rem; font-weight: 600; }
.reject-eye { color: var(--clay); }
.hero h1 { font-family: Newsreader, Georgia, serif; font-size: clamp(2.2rem,5vw,3.4rem); line-height: 1.1; font-weight: 500; margin: 0 0 1.5rem; letter-spacing: -0.02em; }
.lede { font-size: clamp(1.1rem,2vw,1.3rem); line-height: 1.6; color: #3a3446; max-width: 54ch; margin: 0; }
.modes { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.returning { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.returning-label { font-size: 0.82rem; color: #8a7d62; font-weight: 600; white-space: nowrap; }
.returning-input { flex: 1; min-width: 240px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-family: ui-monospace, monospace; font-size: 0.85rem; padding: 0.55rem 0.8rem; outline: none; color: var(--ink); }
.returning-input:focus { border-color: var(--gold); }
.returning-input::placeholder { font-family: ui-sans-serif, system-ui, sans-serif; color: #b3a890; }
.mode { padding: 0.6rem 1.3rem; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; font-size: 0.92rem; font-weight: 600; cursor: pointer; color: #8a8073; transition: all 0.15s; }
.mode-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
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
.voice-in { text-align: left; }
.voice-hint { font-size: 1rem; line-height: 1.55; color: #4a4456; margin: 0 0 1.5rem; }
.voice-controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.voice-or { color: #a3998a; font-size: 0.9rem; }
.upload-label { display: inline-block; }
.audio-ready { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line); flex-wrap: wrap; }
.audio-ready > span { font-family: ui-monospace, monospace; font-size: 0.9rem; color: #3f8c5f; }
.btn { padding: 0.8rem 1.5rem; border-radius: 10px; font-size: 0.98rem; font-weight: 600; cursor: pointer; border: none; transition: transform 0.12s; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn-solid { background: var(--ink); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.btn-rec { background: var(--clay); color: #fff; animation: rec 1.2s ease-in-out infinite; }
@keyframes rec { 50% { opacity: 0.6; } }
.f-err { color: var(--clay); font-size: 0.9rem; margin-top: 0.8rem; }
.judging { display: flex; align-items: center; gap: 0.7rem; color: #8a7d62; font-size: 1.05rem; padding: 1.5rem 0; line-height: 1.5; }
.pulse { width: 10px; height: 10px; border-radius: 50%; background: var(--gold); flex-shrink: 0; animation: p 1s ease-in-out infinite; }
@keyframes p { 0%,100% { opacity: 0.3; transform: scale(0.8);} 50% { opacity: 1; transform: scale(1.2);} }
.verdict h2 { font-family: Newsreader, Georgia, serif; font-size: 1.6rem; font-weight: 500; margin: 0 0 0.8rem; }
.transcript-box { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 1.1rem; margin-bottom: 1.2rem; }
.tb-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8a7d62; margin-bottom: 0.5rem; font-weight: 600; }
.tb-text { font-family: Newsreader, Georgia, serif; font-size: 1.1rem; line-height: 1.5; margin: 0; color: var(--ink); font-style: italic; }
.agent-line { display: flex; flex-direction: column; gap: 0.2rem; background: #f7f0e0; border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 1.2rem; }
.agent-line > span:first-child { font-size: 0.95rem; color: #6e561f; }
.agent-bd { font-family: ui-monospace, monospace; font-size: 0.74rem; color: #8a7d62; }
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
.anchor { background: #f2eff7; border: 1px solid #ddd4ea; border-radius: 12px; padding: 1.1rem; margin-bottom: 1.5rem; }
.anchor-label { font-size: 0.78rem; color: var(--violet); font-weight: 600; margin-bottom: 0.7rem; }
.anchor-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 0.25rem 0; }
.anchor-row span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8a8073; }
.anchor-row code { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--violet); }
.why { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.1rem; }
.why li { font-size: 1.08rem; line-height: 1.55; color: #4a4456; padding-left: 1.3rem; position: relative; }
.why li::before { content: "—"; position: absolute; left: 0; color: var(--gold); font-weight: 700; }
.why b { color: var(--ink); }
.ft { background: var(--ink); padding: 2rem clamp(1.5rem,5vw,5rem); }
.ft-in { display: flex; justify-content: space-between; font-size: 0.82rem; color: #b8b2c2; max-width: 720px; margin: 0 auto; }
@media (max-width: 620px) { .ft-in { flex-direction: column; gap: 0.5rem; } }
@media (prefers-reduced-motion: reduce) { .lit-border { animation: none; } }
`;
