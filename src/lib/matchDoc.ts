import { SEATS, teamOf } from "@/rules/geometry";
import type { MatchMode, MatchState, Seat, Team } from "@/rules/types";

export interface SeatOccupant {
  uid: string;
  name: string;
}

export type LobbyStatus = "waiting" | "active" | "finished";

/**
 * One document per match. A lobby is simply a match still in `waiting`, which
 * keeps the whole thing to a single collection and a single subscription.
 *
 * `state` is the serialized MatchState. Storing it as JSON sidesteps
 * Firestore's nested-array limitation and keeps every write atomic.
 */
export interface MatchDoc {
  name: string;
  mode: MatchMode;
  status: LobbyStatus;
  host: string;
  seats: Record<Seat, SeatOccupant | null>;
  state: string;
  /** Bumped on every write, so clients can spot stale snapshots. */
  version: number;
  createdAt: number;
  updatedAt: number;
}

export function emptySeats(): Record<Seat, SeatOccupant | null> {
  return {
    chessWhite: null,
    chessBlack: null,
    xiangqiRed: null,
    xiangqiBlack: null,
  };
}

export function encodeState(state: MatchState): string {
  return JSON.stringify(state);
}

export function decodeState(raw: string): MatchState {
  return JSON.parse(raw) as MatchState;
}

export function seatsOfTeam(team: Team): Seat[] {
  return SEATS.filter((s) => teamOf(s) === team);
}

/** Seats this uid may move. In 1v1 that is both seats of their team. */
export function seatsFor(doc: MatchDoc, uid: string): Seat[] {
  return SEATS.filter((s) => doc.seats[s]?.uid === uid);
}

export function isFull(doc: MatchDoc): boolean {
  return SEATS.every((s) => doc.seats[s] !== null);
}

/**
 * Validate a seat claim. 2v2 takes one seat at a time; 1v1 claims a whole
 * team, because one player holds both boards for their side.
 */
export function validateClaim(
  doc: MatchDoc,
  claim: Seat[],
  uid: string,
): string | null {
  if (claim.length === 0) return "No seats requested";
  if (claim.some((s) => !SEATS.includes(s))) return "Unknown seat";
  if (doc.status !== "waiting") return "That match has already started";

  for (const seat of claim) {
    const occupant = doc.seats[seat];
    if (occupant && occupant.uid !== uid) return "That seat is taken";
  }

  if (doc.mode === "2v2") {
    if (claim.length !== 1) return "Claim one seat at a time in 2v2";
  } else {
    if (claim.length !== 2) return "In 1v1 you take both seats on your team";
    const teams = new Set(claim.map(teamOf));
    if (teams.size !== 1) return "Those two seats are on different teams";
  }
  return null;
}
