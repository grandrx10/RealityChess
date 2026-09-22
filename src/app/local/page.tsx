"use client";

import { useState } from "react";
import { MatchView } from "@/components/MatchView";
import { SEATS } from "@/rules/geometry";
import { applyMove, createMatch } from "@/rules/match";
import type { MatchMode, MatchState, Move, Seat } from "@/rules/types";

/** Hot seat: all four seats on one screen, running the engine locally. */
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
      <MatchView
        match={match}
        controlled={SEATS}
        onMove={handleMove}
        error={error}
        toolbar={
          <>
            <button
              type="button"
              className="icon-btn"
              title="2v2: boards run independently · 1v1: strict turn cycle"
              onClick={() => reset(mode === "2v2" ? "1v1" : "2v2")}
            >
              {mode}
            </button>
            <button
              type="button"
              className="icon-btn"
              title="New match"
              aria-label="New match"
              onClick={() => reset(mode)}
            >
              ↻
            </button>
          </>
        }
      />
    </main>
  );
}
