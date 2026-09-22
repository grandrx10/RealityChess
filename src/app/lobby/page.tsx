"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  currentUser,
  firebaseConfigured,
  firestore,
  postJson,
} from "@/lib/firebaseClient";
import type { MatchDoc } from "@/lib/matchDoc";
import { SEATS } from "@/rules/geometry";
import type { MatchMode } from "@/rules/types";

interface Row extends MatchDoc {
  id: string;
}

export default function LobbyPage() {
  const configured = firebaseConfigured();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("Open table");
  const [mode, setMode] = useState<MatchMode>("2v2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let stop = () => {};
    // Clients read straight from Firestore, so the list is live. Writes all go
    // through the API routes instead.
    currentUser()
      .then(() => {
        const q = query(
          collection(firestore(), "matches"),
          where("status", "==", "waiting"),
          orderBy("createdAt", "desc"),
          limit(25),
        );
        stop = onSnapshot(
          q,
          (snap) =>
            setRows(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) })),
            ),
          (e) => setError(e.message),
        );
      })
      .catch((e: Error) => setError(e.message));
    return () => stop();
  }, [configured]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await postJson<{ id: string }>("/api/matches", {
        name,
        mode,
      });
      window.location.href = `/match/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="shell">
        <h1 className="title">Lobby</h1>
        <div className="card">
          <p>
            Firebase is not configured yet. Copy <code>.env.local.example</code>{" "}
            to <code>.env.local</code> and fill in your project&apos;s values,
            then restart the dev server.
          </p>
          <p>
            In the meantime the <a href="/local">hot seat board</a> works with
            no backend at all.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1 className="title">Lobby</h1>
      <p className="subtitle">
        Open tables. 2v2 seats four players; 1v1 gives each player both boards
        for their team.
      </p>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="card">
        <h2 className="panel__title">New table</h2>
        <div className="row">
          <input
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table name"
          />
          <button
            type="button"
            className="btn"
            onClick={() => setMode(mode === "2v2" ? "1v1" : "2v2")}
          >
            {mode}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="panel__title">Open tables</h2>
        {rows.length === 0 ? (
          <p className="subtitle" style={{ margin: 0 }}>
            Nothing open right now.
          </p>
        ) : (
          <ul>
            {rows.map((row) => {
              const taken = SEATS.filter((s) => row.seats[s]).length;
              return (
                <li key={row.id}>
                  <a href={`/match/${row.id}`}>{row.name}</a> — {row.mode},{" "}
                  {taken}/4 seated
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
