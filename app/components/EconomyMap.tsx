"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * The whole Empeiria economy as a live system map.
 * Every agent is a node; money and data animate along the edges as real
 * events fire. A single query lights only its path; the rest stays dimly
 * present so the full economy is always legible.
 */

type Pulse = { id: number; from: string; to: string; kind: "pay" | "data" };

// node positions on a 1000x560 canvas
const NODES: Record<string, { x: number; y: number; label: string; role: string; emoji: string }> = {
  // top row — the ask flow, left to right
  asker:        { x: 140, y: 110, label: "Developer",     role: "asks a question", emoji: "🧑‍💻" },
  escrow:       { x: 380, y: 110, label: "Escrow",        role: "holds budget",    emoji: "🔒" },
  specialist:   { x: 620, y: 110, label: "Repo Agent",    role: "answers from code", emoji: "📦" },
  pool:         { x: 860, y: 110, label: "Repo Knowledge", role: "ingested files",  emoji: "📚" },
  // payout — the maintainer earns
  contributor:  { x: 620, y: 280, label: "Maintainer",    role: "paid per use",    emoji: "✍️" },
  // platform fee
  fees:         { x: 380, y: 280, label: "Fees",          role: "platform 10%",    emoji: "🏛️" },
  // agent economy — the repo agent pays specialist agents
  con:          { x: 620, y: 450, label: "Docs Agent",    role: "paid by repo",    emoji: "🤖" },
  transcription:{ x: 860, y: 450, label: "Dependency Agent", role: "paid by repo",  emoji: "🧩" },
};
const EDGES: Array<{ from: string; to: string }> = [
  // ask flow
  { from: "asker", to: "escrow" },
  { from: "escrow", to: "specialist" },
  { from: "specialist", to: "pool" },
  // payout + fee
  { from: "escrow", to: "contributor" },
  { from: "escrow", to: "fees" },
  // agent economy — repo agent pays specialist agents
  { from: "specialist", to: "con" },
  { from: "specialist", to: "transcription" },
];
function edgePath(from: string, to: string): string {
  const a = NODES[from], b = NODES[to];
  // straight lines for a clean, legible grid flow
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export default function EconomyMap({
  activeNodes,
  pulses,
}: {
  activeNodes: Set<string>;
  pulses: Pulse[];
}) {
  return (
    <div className="emap">
      <style>{css}</style>
      <svg viewBox="0 0 1000 560" className="emap-svg" preserveAspectRatio="xMidYMid meet">
        {/* edges */}
        {EDGES.map((e, i) => {
          const lit = activeNodes.has(e.from) && activeNodes.has(e.to);
          return (
            <path key={i} d={edgePath(e.from, e.to)} className={`edge ${lit ? "edge-lit" : ""}`} fill="none" />
          );
        })}

        {/* animated money/data pulses */}
        <AnimatePresence>
          {pulses.map((p) => (
            <motion.circle
              key={p.id}
              r={6}
              className={p.kind === "pay" ? "pulse-pay" : "pulse-data"}
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: "easeInOut" }}
              style={{ offsetPath: `path('${edgePath(p.from, p.to)}')` } as React.CSSProperties}
            />
          ))}
        </AnimatePresence>

        {/* nodes */}
        {Object.entries(NODES).map(([id, n]) => {
          const lit = activeNodes.has(id);
          return (
            <g key={id} className={`node ${lit ? "node-lit" : ""}`} transform={`translate(${n.x},${n.y})`}>
              <circle r={30} className="node-bg" />
              <text className="node-emoji" textAnchor="middle" dy="8">{n.emoji}</text>
              <text className="node-label" textAnchor="middle" dy="50">{n.label}</text>
              <text className="node-role" textAnchor="middle" dy="64">{n.role}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const css = `
.emap { width: 100%; background: var(--paper, #FBF7F0); border: 1px solid var(--line, #e6ddcb); border-radius: 16px; padding: 1rem; }
.emap-svg { width: 100%; height: auto; display: block; }
.edge { stroke: #ddd4c4; stroke-width: 1.5; stroke-dasharray: 5 6; transition: stroke 0.4s; }
.edge-lit { stroke: #B8923E; stroke-width: 2; stroke-dasharray: none; }
.pulse-pay { fill: #B8923E; filter: drop-shadow(0 0 4px rgba(184,146,62,0.7)); }
.pulse-data { fill: #6B5B95; filter: drop-shadow(0 0 4px rgba(107,91,149,0.6)); }
.node-bg { fill: #fff; stroke: #e6ddcb; stroke-width: 1.5; transition: stroke 0.3s, filter 0.3s; }
.node-lit .node-bg { stroke: #B8923E; stroke-width: 2.5; filter: drop-shadow(0 0 6px rgba(184,146,62,0.3)); }
.node { opacity: 0.5; transition: opacity 0.3s; }
.node-lit { opacity: 1; }
.node-emoji { font-size: 24px; }
.node-label { font-family: Newsreader, Georgia, serif; font-size: 15px; fill: #1A1A2E; font-weight: 500; }
.node-role { font-family: ui-monospace, monospace; font-size: 9px; fill: #8a7d62; text-transform: uppercase; letter-spacing: 0.08em; }
@media (max-width: 620px) { .node-label { font-size: 13px; } .node-role { display: none; } }
`;
