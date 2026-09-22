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
  const [name, setName] = useState("");
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
        name: name.trim() || "Open table",
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
        <h1 className="brand">REALITY CHESS</h1>
        <div className="card">
          <p>
            Firebase is not configured. Copy <code>.env.local.example</code> to{" "}
            <code>.env.local</code>, fill it in, and restart the dev server.
          </p>
          <p>
            The <a href="/local">singleplayer board</a> works with no backend.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1 className="brand">REALITY CHESS</h1>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="lobby">
        <section className="pane pane--list">
          {rows.length === 0 ? (
            <p className="empty">No open tables</p>
          ) : (
            <ul className="tables">
              {rows.map((row) => {
                const taken = SEATS.filter((s) => row.seats[s]).length;
                return (
                  <li key={row.id}>
                    <a className="table-row" href={`/match/${row.id}`}>
                      <span className="table-row__name">{row.name}</span>
                      <span className="tag">{row.mode}</span>
                      <span className="seats" aria-label={`${taken} of 4 seated`}>
                        {SEATS.map((s, i) => (
                          <i key={s} className={i < taken ? "on" : undefined} />
                        ))}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="pane pane__pad">
          <div className="stack">
            <input
              className="input"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Table name"
            />
            <div className="row">
              <button
                type="button"
                className="btn"
                title="2v2: four players, boards run independently. 1v1: two players, strict turn cycle."
                onClick={() => setMode(mode === "2v2" ? "1v1" : "2v2")}
              >
                {mode}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={create}
                style={{ flex: "1 1 auto" }}
              >
                {busy ? "…" : "New table"}
              </button>
            </div>
            <a className="btn" href="/local" style={{ textAlign: "center" }}>
              Singleplayer
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
