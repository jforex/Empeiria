"use client";
import { useState, useEffect } from "react";

type Me = { authed: boolean; owner?: string; avatar?: string };

export default function AuthBadge() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json())
      .then((d) => setMe({ authed: !!d.authed, owner: d.owner, avatar: d.avatar }))
      .catch(() => setMe({ authed: false }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  // while loading, render nothing (avoids flicker)
  if (!me) return null;

  if (!me.authed) {
    return <a href="/api/auth/github" className="authbadge-signin">Sign in</a>;
  }

  return (
    <div className="authbadge">
      <a href="/create" className="authbadge-me">
        {me.avatar && <img src={me.avatar} alt="" className="authbadge-avatar" />}
        <span className="authbadge-owner">@{me.owner}</span>
      </a>
      <button className="authbadge-out" onClick={logout} title="Sign out">↪</button>
      <style>{`
        .authbadge { display: inline-flex; align-items: center; gap: 0.5rem; }
        .authbadge-me { display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none; color: var(--ink); font-weight: 600; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 999px; border: 1px solid var(--line); }
        .authbadge-me:hover { border-color: var(--gold); }
        .authbadge-avatar { width: 22px; height: 22px; border-radius: 50%; }
        .authbadge-owner { font-size: 0.82rem; }
        .authbadge-out { background: none; border: none; cursor: pointer; color: #8a7d62; font-size: 1rem; padding: 0.2rem 0.3rem; line-height: 1; }
        .authbadge-out:hover { color: var(--ink); }
        .authbadge-signin { text-decoration: none; color: var(--ink); font-weight: 600; font-size: 0.85rem; padding: 0.3rem 0.8rem; border: 1px solid var(--ink); border-radius: 999px; }
        .authbadge-signin:hover { background: var(--ink); color: var(--paper); }
      `}</style>
    </div>
  );
}
