"use client";

import { useState } from "react";
import { MatchView } from "@/components/MatchView";
import { SEATS } from "@/rules/geometry";
import { applyMove, createMatch } from "@/rules/match";
import type { MatchMode, MatchState, Move, Seat } from "@/rules/types";

/**
 * Hot-seat board for playing the variant locally against the pure rules
 * engine, with no network in the way. This is the fastest way to find out
 * whether the cross-board drops are actually fun.
 */
export default function LocalPage() {
  const [mode, setMode] = useState<MatchMode>("2v2");
  const [match, setMatch] = useState<MatchState>(() => createMatch("2v2"));
  const [error, setError] = useState<string | null>(null);

  function handleMove(seat: Seat, move: Move) {
    try {
      setMatch(applyMove(match, seat, move));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function reset(next: MatchMode) {
    setMode(next);
    setMatch(createMatch(next));
    setError(null);
  }

  return (
    <main className="shell">
      <h1 className="title">Cross Reality Chess — hot seat</h1>
      <p className="subtitle">
        All four seats on one screen. Captures on either board land in your
        partner&apos;s hand on the other.
      </p>

      <div className="card">
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => reset(mode === "2v2" ? "1v1" : "2v2")}
          >
            Mode: {mode === "2v2" ? "2v2 (boards run independently)" : "1v1 (strict turn cycle)"}
          </button>
          <button type="button" className="btn" onClick={() => reset(mode)}>
            New match
          </button>
          <a className="btn" href="/">
            Lobby
          </a>
        </div>
      </div>

      <MatchView
        match={match}
        controlled={SEATS}
        onMove={handleMove}
        error={error}
      />
    </main>
  );
}
