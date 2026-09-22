import {
  forwardOf,
  geometryOf,
  hasCrossedRiver,
  inBounds,
  inPalace,
  pieceAt,
  sameSideOfRiver,
  sameSquare,
  seatsOfBoard,
} from "./geometry";
import type { BoardState, Seat, Square } from "./types";

const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// Chess knight / xiangqi horse jumps, paired with the square that blocks a
// horse's leg (the orthogonal step it takes first).
const HORSE_JUMPS: ReadonlyArray<{
  d: readonly [number, number];
  leg: readonly [number, number];
}> = [
  { d: [1, 2], leg: [0, 1] },
  { d: [-1, 2], leg: [0, 1] },
  { d: [1, -2], leg: [0, -1] },
  { d: [-1, -2], leg: [0, -1] },
  { d: [2, 1], leg: [1, 0] },
  { d: [2, -1], leg: [1, 0] },
  { d: [-2, 1], leg: [-1, 0] },
  { d: [-2, -1], leg: [-1, 0] },
];

function slide(
  board: BoardState,
  from: Square,
  dirs: ReadonlyArray<readonly [number, number]>,
  owner: Seat,
  out: Square[],
): void {
  for (const [df, dr] of dirs) {
    let sq = { f: from.f + df, r: from.r + dr };
    while (inBounds(board, sq)) {
      const occupant = pieceAt(board, sq);
      if (!occupant) {
        out.push(sq);
      } else {
        if (occupant.owner !== owner) out.push(sq);
        break;
      }
      sq = { f: sq.f + df, r: sq.r + dr };
    }
  }
}

function step(
  board: BoardState,
  from: Square,
  dirs: ReadonlyArray<readonly [number, number]>,
  owner: Seat,
  out: Square[],
): void {
  for (const [df, dr] of dirs) {
    const sq = { f: from.f + df, r: from.r + dr };
    if (!inBounds(board, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

// Cannon: slides like a chariot when not capturing, but a capture requires
// exactly one intervening piece (the screen), of either colour.
function cannonTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  for (const [df, dr] of ORTHO) {
    let sq = { f: from.f + df, r: from.r + dr };
    let screen = false;
    while (inBounds(board, sq)) {
      const occupant = pieceAt(board, sq);
      if (!screen) {
        if (!occupant) out.push(sq);
        else screen = true;
      } else if (occupant) {
        if (occupant.owner !== owner) out.push(sq);
        break;
      }
      sq = { f: sq.f + df, r: sq.r + dr };
    }
  }
}

function horseTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  for (const { d, leg } of HORSE_JUMPS) {
    const blocker = { f: from.f + leg[0], r: from.r + leg[1] };
    // The hobbling leg: an occupied orthogonal neighbour blocks the jump.
    if (inBounds(board, blocker) && pieceAt(board, blocker)) continue;
    const sq = { f: from.f + d[0], r: from.r + d[1] };
    if (!inBounds(board, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

function knightTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  // A chess knight keeps chess rules everywhere: no hobbling leg.
  for (const { d } of HORSE_JUMPS) {
    const sq = { f: from.f + d[0], r: from.r + d[1] };
    if (!inBounds(board, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

// Two points diagonally, blocked at the midpoint (the elephant's eye). It may
// never CROSS the river -- on either board. Because chess-board drops are
// unrestricted, an elephant can begin on the far bank and is then stuck there,
// so the test is against its current square rather than its owner's half.
function elephantTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  for (const [df, dr] of DIAG) {
    const eye = { f: from.f + df, r: from.r + dr };
    if (!inBounds(board, eye) || pieceAt(board, eye)) continue;
    const sq = { f: from.f + df * 2, r: from.r + dr * 2 };
    if (!inBounds(board, sq)) continue;
    if (!sameSideOfRiver(board, from, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

// One point diagonally. Confined to the palace where one exists (the xiangqi
// board); on the chess board it roams its own bank but cannot cross the river.
function advisorTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  const hasPalace = geometryOf(board).palaceFiles !== null;
  for (const [df, dr] of DIAG) {
    const sq = { f: from.f + df, r: from.r + dr };
    if (!inBounds(board, sq)) continue;
    if (
      hasPalace
        ? !inPalace(board, owner, sq)
        : !sameSideOfRiver(board, from, sq)
    )
      continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

function generalTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  const hasPalace = geometryOf(board).palaceFiles !== null;
  for (const [df, dr] of ORTHO) {
    const sq = { f: from.f + df, r: from.r + dr };
    if (!inBounds(board, sq)) continue;
    if (hasPalace && !inPalace(board, owner, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (!occupant || occupant.owner !== owner) out.push(sq);
  }
}

// Forward one; gains sideways movement once past the river. Never retreats.
function soldierTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  const fwd = forwardOf(owner);
  const dirs: Array<readonly [number, number]> = [[0, fwd]];
  if (hasCrossedRiver(board, owner, from)) {
    dirs.push([1, 0], [-1, 0]);
  }
  step(board, from, dirs, owner, out);
}

// The chess pawn's native starting rank, or null on boards where it has none
// (so a pawn dropped on the xiangqi board never gets a double step).
function pawnStartRank(board: BoardState, owner: Seat): number | null {
  if (board.kind !== "chess") return null;
  return forwardOf(owner) === 1 ? 1 : board.height - 2;
}

function pawnTargets(
  board: BoardState,
  from: Square,
  owner: Seat,
  out: Square[],
): void {
  const fwd = forwardOf(owner);
  const one = { f: from.f, r: from.r + fwd };
  if (inBounds(board, one) && !pieceAt(board, one)) {
    out.push(one);
    const start = pawnStartRank(board, owner);
    if (start !== null && from.r === start) {
      const two = { f: from.f, r: from.r + fwd * 2 };
      if (inBounds(board, two) && !pieceAt(board, two)) out.push(two);
    }
  }
  for (const df of [-1, 1]) {
    const sq = { f: from.f + df, r: from.r + fwd };
    if (!inBounds(board, sq)) continue;
    const occupant = pieceAt(board, sq);
    if (occupant && occupant.owner !== owner) {
      out.push(sq);
    } else if (!occupant && board.enPassant && sameSquare(board.enPassant, sq)) {
      out.push(sq);
    }
  }
}

/**
 * Every square this piece could move to, ignoring check and castling. Each
 * piece keeps its NATIVE movement on whichever board it finds itself on; only
 * the river-relative pieces read the board's geometry.
 */
export function pseudoTargets(board: BoardState, from: Square): Square[] {
  const piece = pieceAt(board, from);
  if (!piece) return [];
  const out: Square[] = [];
  const owner = piece.owner;

  switch (piece.type) {
    // chess
    case "rook":
      slide(board, from, ORTHO, owner, out);
      break;
    case "bishop":
      slide(board, from, DIAG, owner, out);
      break;
    case "queen":
      slide(board, from, [...ORTHO, ...DIAG], owner, out);
      break;
    case "knight":
      knightTargets(board, from, owner, out);
      break;
    case "king":
      step(board, from, [...ORTHO, ...DIAG], owner, out);
      break;
    case "pawn":
      pawnTargets(board, from, owner, out);
      break;
    // xiangqi
    case "chariot":
      slide(board, from, ORTHO, owner, out);
      break;
    case "cannon":
      cannonTargets(board, from, owner, out);
      break;
    case "horse":
      horseTargets(board, from, owner, out);
      break;
    case "elephant":
      elephantTargets(board, from, owner, out);
      break;
    case "advisor":
      advisorTargets(board, from, owner, out);
      break;
    case "general":
      generalTargets(board, from, owner, out);
      break;
    case "soldier":
      soldierTargets(board, from, owner, out);
      break;
  }
  return out;
}

/* ----------------------------------------------------------- check tests */

export function findRoyal(board: BoardState, seat: Seat): Square | null {
  const type = board.kind === "chess" ? "king" : "general";
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) {
      const p = board.squares[r * board.width + f];
      if (p && p.owner === seat && p.type === type) return { f, r };
    }
  }
  return null;
}

/** Could `by` move a piece onto `target` right now? */
export function isAttacked(
  board: BoardState,
  target: Square,
  by: Seat,
): boolean {
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) {
      const p = board.squares[r * board.width + f];
      if (!p || p.owner !== by) continue;
      for (const t of pseudoTargets(board, { f, r })) {
        if (sameSquare(t, target)) return true;
      }
    }
  }
  return false;
}

/**
 * Xiangqi's flying-general rule: the two generals may not face each other down
 * an open file. Scoped to the xiangqi board, where both royals are generals.
 */
export function royalsFacing(board: BoardState): boolean {
  if (board.kind !== "xiangqi") return false;
  const [a, b] = seatsOfBoard(board.kind);
  const ra = findRoyal(board, a);
  const rb = findRoyal(board, b);
  if (!ra || !rb || ra.f !== rb.f) return false;
  const lo = Math.min(ra.r, rb.r) + 1;
  const hi = Math.max(ra.r, rb.r);
  for (let r = lo; r < hi; r++) {
    if (board.squares[r * board.width + ra.f]) return false;
  }
  return true;
}

export function inCheck(board: BoardState, seat: Seat): boolean {
  const royal = findRoyal(board, seat);
  if (!royal) return false;
  const foe = seatsOfBoard(board.kind).find((s) => s !== seat)!;
  if (isAttacked(board, royal, foe)) return true;
  return royalsFacing(board);
}
