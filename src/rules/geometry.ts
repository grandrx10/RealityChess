import type {
  BoardKind,
  BoardState,
  ChessPieceType,
  Piece,
  PieceType,
  Seat,
  Square,
  Team,
  XiangqiPieceType,
} from "./types";

/* ------------------------------------------------------------------ seats */

export const SEATS: Seat[] = [
  "chessWhite",
  "chessBlack",
  "xiangqiRed",
  "xiangqiBlack",
];

/** 1v1 turn cycle. In 2v2 the boards run independently and this is unused. */
export const TURN_ORDER: Seat[] = [
  "chessWhite",
  "chessBlack",
  "xiangqiRed",
  "xiangqiBlack",
];

/** Team A = xiangqiRed + chessBlack, Team B = xiangqiBlack + chessWhite. */
export function teamOf(seat: Seat): Team {
  return seat === "xiangqiRed" || seat === "chessBlack" ? "teamA" : "teamB";
}

/** The seat on the OTHER board that shares your team. Captures feed them. */
export function partnerOf(seat: Seat): Seat {
  switch (seat) {
    case "xiangqiRed":
      return "chessBlack";
    case "chessBlack":
      return "xiangqiRed";
    case "xiangqiBlack":
      return "chessWhite";
    case "chessWhite":
      return "xiangqiBlack";
  }
}

/** The seat you play against, on your own board. */
export function opponentOf(seat: Seat): Seat {
  switch (seat) {
    case "chessWhite":
      return "chessBlack";
    case "chessBlack":
      return "chessWhite";
    case "xiangqiRed":
      return "xiangqiBlack";
    case "xiangqiBlack":
      return "xiangqiRed";
  }
}

export function boardOfSeat(seat: Seat): BoardKind {
  return seat === "chessWhite" || seat === "chessBlack" ? "chess" : "xiangqi";
}

export function seatsOfBoard(kind: BoardKind): [Seat, Seat] {
  return kind === "chess"
    ? ["chessWhite", "chessBlack"]
    : ["xiangqiRed", "xiangqiBlack"];
}

/** +1 means this seat's pieces advance toward higher ranks. */
export function forwardOf(seat: Seat): 1 | -1 {
  return seat === "chessWhite" || seat === "xiangqiRed" ? 1 : -1;
}

/* -------------------------------------------------------------- geometry */

export interface Geometry {
  width: number;
  height: number;
  /** Highest rank index still on the "home" (r=0) side of the river. */
  riverLow: number;
  /** Lowest rank index on the far side of the river. */
  riverHigh: number;
  /** Palace file range, inclusive. Only meaningful on the xiangqi board. */
  palaceFiles: [number, number] | null;
  /** Palace rank range for the r=0 side, inclusive. */
  palaceHome: [number, number] | null;
}

export const GEOMETRY: Record<BoardKind, Geometry> = {
  // 8x8. The house rule adds a river between ranks 4 and 5 (r=3 and r=4).
  chess: {
    width: 8,
    height: 8,
    riverLow: 3,
    riverHigh: 4,
    palaceFiles: null,
    palaceHome: null,
  },
  // 9x10 intersections. River between r=4 and r=5. Palace files d-f (3..5).
  xiangqi: {
    width: 9,
    height: 10,
    riverLow: 4,
    riverHigh: 5,
    palaceFiles: [3, 5],
    palaceHome: [0, 2],
  },
};

export function geometryOf(board: BoardState | BoardKind): Geometry {
  return GEOMETRY[typeof board === "string" ? board : board.kind];
}

export function idx(board: BoardState, sq: Square): number {
  return sq.r * board.width + sq.f;
}

export function inBounds(board: BoardState, sq: Square): boolean {
  return sq.f >= 0 && sq.f < board.width && sq.r >= 0 && sq.r < board.height;
}

export function pieceAt(board: BoardState, sq: Square): Piece | null {
  if (!inBounds(board, sq)) return null;
  return board.squares[idx(board, sq)];
}

export function setPiece(
  board: BoardState,
  sq: Square,
  piece: Piece | null,
): void {
  board.squares[idx(board, sq)] = piece;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.f === b.f && a.r === b.r;
}

/**
 * True when `sq` lies on `seat`'s own side of the river.
 *
 * Drops are restricted to your own half on BOTH boards, and the elephant and
 * advisor may never leave it.
 */
export function isOwnHalf(
  board: BoardState,
  seat: Seat,
  sq: Square,
): boolean {
  const g = geometryOf(board);
  return forwardOf(seat) === 1 ? sq.r <= g.riverLow : sq.r >= g.riverHigh;
}

/**
 * True when two squares sit on the same bank of the river.
 *
 * The elephant and advisor may not CROSS the river, which is not the same as
 * being confined to their owner's half: drops on the chess board are
 * unrestricted, so either piece can legitimately start life on the far bank
 * and is then confined there.
 */
export function sameSideOfRiver(
  board: BoardState,
  a: Square,
  b: Square,
): boolean {
  const g = geometryOf(board);
  return a.r <= g.riverLow === b.r <= g.riverLow;
}

/** True once a soldier/pawn has crossed into enemy territory. */
export function hasCrossedRiver(
  board: BoardState,
  seat: Seat,
  sq: Square,
): boolean {
  return !isOwnHalf(board, seat, sq);
}

/** Xiangqi palace test. Returns false on boards without a palace. */
export function inPalace(board: BoardState, seat: Seat, sq: Square): boolean {
  const g = geometryOf(board);
  if (!g.palaceFiles || !g.palaceHome) return false;
  const [f0, f1] = g.palaceFiles;
  if (sq.f < f0 || sq.f > f1) return false;
  const [h0, h1] = g.palaceHome;
  if (forwardOf(seat) === 1) return sq.r >= h0 && sq.r <= h1;
  const mirrored0 = g.height - 1 - h1;
  const mirrored1 = g.height - 1 - h0;
  return sq.r >= mirrored0 && sq.r <= mirrored1;
}

/* ---------------------------------------------------------------- pieces */

const CHESS_TYPES: ChessPieceType[] = [
  "king",
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];

const XIANGQI_TYPES: XiangqiPieceType[] = [
  "general",
  "advisor",
  "elephant",
  "horse",
  "chariot",
  "cannon",
  "soldier",
];

export function isChessPiece(t: PieceType): t is ChessPieceType {
  return (CHESS_TYPES as PieceType[]).includes(t);
}

export function isXiangqiPiece(t: PieceType): t is XiangqiPieceType {
  return (XIANGQI_TYPES as PieceType[]).includes(t);
}

/** The game a piece type originally belongs to. */
export function nativeBoardOf(t: PieceType): BoardKind {
  return isChessPiece(t) ? "chess" : "xiangqi";
}

/** The royal piece for a board. Losing it ends the whole match. */
export function royalTypeOf(kind: BoardKind): PieceType {
  return kind === "chess" ? "king" : "general";
}

export function isRoyal(piece: Piece, kind: BoardKind): boolean {
  return piece.type === royalTypeOf(kind);
}

/** Royals are never captured, so they never enter a reserve. */
export function isDroppable(t: PieceType): boolean {
  return t !== "king" && t !== "general";
}

/** What a captured piece becomes in the captor's partner's reserve. */
export function reserveFormOf(piece: Piece): PieceType {
  if (!piece.promoted) return piece.type;
  return nativeBoardOf(piece.type) === "chess" ? "pawn" : "soldier";
}

export function algebraic(board: BoardState, sq: Square): string {
  return `${String.fromCharCode(97 + sq.f)}${sq.r + 1}`;
}
