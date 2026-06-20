"use client";

import { motion } from "framer-motion";

type Stage = "classify" | "specialist" | "judge" | "synthesize" | "pay" | null;

const NODES = [
  { id: "you", label: "You", role: "Searcher", emoji: "🧑", stages: ["classify"] },
  { id: "router", label: "Router", role: "Agent", emoji: "🧭", stages: ["classify", "synthesize", "pay"] },
  { id: "specialist", label: "Specialist", role: "Domain Agent", emoji: "🎓", stages: ["specialist", "judge"] },
  { id: "contributors", label: "Contributors", role: "Anonymous", emoji: "🔒", stages: ["pay"] },
];

const STAGE_VERB: Record<string, string> = {
  classify: "routing",
  specialist: "quoting",
  judge: "judging",
  synthesize: "writing",
  pay: "paying",
};

export default function FlowDiagram({
  activeStage = null,
  domainLabel,
}: { activeStage?: Stage; domainLabel?: string | null }) {
  const live = activeStage !== null && activeStage !== undefined;

  return (
    <div className="flow">
      <style>{css}</style>
      <div className="flow-track">
        {NODES.map((n, i) => {
          const lit = live ? n.stages.includes(activeStage as string) : false;
          const label = n.id === "specialist" && domainLabel ? `${domainLabel} specialist` : n.label;
          const status = lit ? STAGE_VERB[activeStage as string] : null;
          return (
            <div key={n.id} className="flow-cell">
              {i > 0 && (
                <div className="connector" aria-hidden>
                  <div className="connector-line" />
                  {live && (
                    <motion.div className="connector-dot"
                      animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
                  )}
                </div>
              )}
              <div className={`node ${lit ? "node-lit" : ""}`}>
                <motion.div className="node-avatar"
                  animate={
                    lit ? { scale: [1, 1.08, 1] }
                    : !live ? { boxShadow: ["0 0 0 0 rgba(184,146,62,0)", "0 0 0 7px rgba(184,146,62,0.10)", "0 0 0 0 rgba(184,146,62,0)"] }
                    : { scale: 1 }
                  }
                  transition={lit ? { duration: 1.1, repeat: Infinity } : { duration: 2.6, repeat: Infinity, delay: i * 0.6 }}>
                  <span className="node-emoji">{n.emoji}</span>
                </motion.div>
                <div className="node-label">{label}</div>
                <div className="node-role">{n.role}</div>
                {status && <div className="node-status">{status}…</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const css = `
.flow { --ink:#1A1A2E; --gold:#B8923E; --violet:#6B5B95; --line:#e6ddcb; width: 100%; }
.flow-track { display: flex; align-items: flex-start; justify-content: space-between; gap: 0; }
.flow-cell { display: flex; align-items: flex-start; flex: 1; min-width: 0; }
.flow-cell:first-child { flex: 0 0 auto; }
.connector { position: relative; flex: 1; height: 2px; margin-top: 31px; min-width: 28px; }
.connector-line { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, var(--line) 0 6px, transparent 6px 12px); }
.connector-dot { position: absolute; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 8px rgba(184,146,62,0.6); }
.node { text-align: center; width: 96px; flex: 0 0 auto; opacity: 0.5; transition: opacity 0.3s; }
.node-lit { opacity: 1; }
.node-avatar { width: 64px; height: 64px; border-radius: 50%; background: #fff; border: 1.5px solid var(--line); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.7rem; }
.node-lit .node-avatar { border-color: var(--gold); box-shadow: 0 0 0 5px rgba(184,146,62,0.16); }
.node-emoji { font-size: 1.7rem; }
.node-label { font-family: Newsreader, Georgia, serif; font-size: 0.95rem; font-weight: 500; color: var(--ink); line-height: 1.2; }
.node-role { font-family: ui-monospace, monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--violet); margin-top: 0.2rem; }
.node-status { font-family: ui-monospace, monospace; font-size: 0.66rem; color: var(--gold); margin-top: 0.45rem; font-weight: 600; }
@media (max-width: 620px) {
  .node { width: 70px; }
  .node-avatar { width: 52px; height: 52px; }
  .node-emoji { font-size: 1.4rem; }
  .node-label { font-size: 0.82rem; }
  .connector { min-width: 12px; margin-top: 25px; }
}
`;
