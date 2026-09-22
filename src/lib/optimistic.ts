import { applyMove } from "@/rules/match";
import type { MatchState, Move, Seat } from "@/rules/types";

/**
 * A move played locally that the server has not confirmed through a snapshot
 * yet. `acceptedAt` is the document version the server reported writing; until
 * a snapshot reaches that version, the local copy is what the player sees.
 */
export interface PendingMove {
  token: number;
  seat: Seat;
  move: Move;
  acceptedAt: number | null;
}

/**
 * The server's state with unconfirmed moves replayed on top.
 *
 * The client runs the same pure engine the server does, so a move that will be
 * accepted looks identical here the instant it is played. A pending move that
 * no longer applies is skipped rather than dropped: the usual reason is that
 * the authoritative state already contains it, and the snapshot that retires it
 * is normally a moment away.
 */
export function replayPending(
  server: MatchState,
  pending: readonly PendingMove[],
): MatchState {
  let state = server;
  for (const p of pending) {
    try {
      state = applyMove(state, p.seat, p.move);
    } catch {
      // Superseded by the authoritative state.
    }
  }
  return state;
}

/**
 * Drop the moves a snapshot has caught up with. A move the server accepted at
 * version N is retired once the document reaches N, because from then on the
 * authoritative state already includes it.
 */
export function prunePending(
  pending: readonly PendingMove[],
  documentVersion: number,
): PendingMove[] {
  return pending.filter(
    (p) => p.acceptedAt === null || documentVersion < p.acceptedAt,
  );
}
