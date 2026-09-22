"use client";

import { use, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { MatchView } from "@/components/MatchView";
import {
  currentUser,
  firebaseConfigured,
  firestore,
  postJson,
} from "@/lib/firebaseClient";
import {
  decodeState,
  isFull,
  seatsFor,
  seatsOfTeam,
  type MatchDoc,
} from "@/lib/matchDoc";
import { SEATS } from "@/rules/geometry";
import type { Move, Seat, Team } from "@/rules/types";

const SEAT_NAMES: Record<Seat, string> = {
  chessWhite: "Chess · White",
  chessBlack: "Chess · Black",
  xiangqiRed: "Xiangqi · Red",
  xiangqiBlack: "Xiangqi · Black",
};

const TEAM_NAMES: Record<Team, string> = {
  teamA: "Team A — Xiangqi Red + Chess Black",
  teamB: "Team B — Xiangqi Black + Chess White",
};

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const configured = firebaseConfigured();
  const [document, setDocument] = useState<MatchDoc | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Player");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let stop = () => {};
    currentUser()
      .then((user) => {
        setUid(user.uid);
        stop = onSnapshot(
          doc(firestore(), "matches", id),
          (snap) =>
            setDocument(snap.exists() ? (snap.data() as MatchDoc) : null),
          (e) => setError(e.message),
        );
      })
      .catch((e: Error) => setError(e.message));
    return () => stop();
  }, [configured, id]);

  const match = useMemo(
    () => (document ? decodeState(document.state) : null),
    [document],
  );
  const mySeats = useMemo(
    () => (document && uid ? seatsFor(document, uid) : []),
    [document, uid],
  );

  async function claim(seats: Seat[]) {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/matches/${id}/seat`, { seats, name: displayName });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await postJson(`/api/matches/${id}/seat`, { release: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/matches/${id}/start`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(seat: Seat, move: Move) {
    setError(null);
    try {
      await postJson(`/api/matches/${id}/move`, { seat, move });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!configured) {
    return (
      <main className="shell">
        <h1 className="title">Match</h1>
        <div className="card">
          <p>
            Firebase is not configured. See <code>.env.local.example</code>, or
            play on the <a href="/local">hot seat board</a>.
          </p>
        </div>
      </main>
    );
  }

  if (error && !document) {
    return (
      <main className="shell">
        <div className="banner banner--error">{error}</div>
      </main>
    );
  }

  if (!document || !match) {
    return (
      <main className="shell">
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  const waiting = document.status === "waiting";

  return (
    <main className="shell">
      <h1 className="title">{document.name}</h1>
      <p className="subtitle">
        {document.mode} · {TEAM_NAMES.teamA} vs {TEAM_NAMES.teamB}
      </p>

      {error ? <div className="banner banner--error">{error}</div> : null}

      {waiting ? (
        <div className="card">
          <h2 className="panel__title">Take a seat</h2>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="input"
              value={displayName}
              maxLength={24}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {document.mode === "2v2" ? (
            <div className="row">
              {SEATS.map((seat) => {
                const occupant = document.seats[seat];
                const mine = occupant?.uid === uid;
                return (
                  <button
                    key={seat}
                    type="button"
                    className="btn"
                    disabled={busy || (Boolean(occupant) && !mine)}
                    onClick={() => claim([seat])}
                  >
                    {SEAT_NAMES[seat]}
                    {occupant ? ` — ${occupant.name}${mine ? " (you)" : ""}` : " — open"}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="row">
              {(["teamA", "teamB"] as Team[]).map((team) => {
                const seats = seatsOfTeam(team);
                const occupant = document.seats[seats[0]];
                const mine = occupant?.uid === uid;
                return (
                  <button
                    key={team}
                    type="button"
                    className="btn"
                    disabled={busy || (Boolean(occupant) && !mine)}
                    onClick={() => claim(seats)}
                  >
                    {TEAM_NAMES[team]}
                    {occupant ? ` — ${occupant.name}${mine ? " (you)" : ""}` : " — open"}
                  </button>
                );
              })}
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            {mySeats.length > 0 ? (
              <button type="button" className="btn" disabled={busy} onClick={leave}>
                Stand up
              </button>
            ) : null}
            {document.host === uid ? (
              <button
                type="button"
                className="btn"
                disabled={busy || !isFull(document)}
                onClick={start}
              >
                {isFull(document) ? "Start match" : "Waiting for players…"}
              </button>
            ) : (
              <span className="subtitle" style={{ margin: 0 }}>
                Waiting for the host to start.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {mySeats.length === 0 && !waiting ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            You are watching this match. Moves are disabled.
          </p>
        </div>
      ) : null}

      <MatchView match={match} controlled={mySeats} onMove={handleMove} />
    </main>
  );
}
