/**
 * Core types for Cross Reality Chess.
 *
 * Two boards run side by side: an 8x8 chess board and a 9x10 xiangqi board.
 * Captures on one board become droppable reserve pieces for the capturing
 * player's PARTNER on the other board, where they keep their native movement.
 *
 * Teams:  A = xiangqiRed + chessBlack      B = xiangqiBlack + chessWhite
 */

export type BoardKind = "chess" | "xiangqi";

export type Seat = "chessWhite" | "chessBlack" | "xiangqiRed" | "xiangqiBlack";

export type Team = "teamA" | "teamB";

export type ChessPieceType =
  | "king"
  | "queen"
  | "rook"
  | "bishop"
  | "knight"
  | "pawn";

export type XiangqiPieceType =
  | "general"
  | "advisor"
  | "elephant"
  | "horse"
  | "chariot"
  | "cannon"
  | "soldier";

export type PieceType = ChessPieceType | XiangqiPieceType;

export interface Piece {
  type: PieceType;
  owner: Seat;
  /** A promoted pawn/soldier reverts to its base type when captured. */
  promoted?: boolean;
}

/** File (column) and rank (row). r=0 is always the bottom/home edge for
 *  chessWhite and xiangqiRed; r increases toward the opponent. */
export interface Square {
  f: number;
  r: number;
}

export interface CastlingRights {
  whiteK: boolean;
  whiteQ: boolean;
  blackK: boolean;
  blackQ: boolean;
}

export interface BoardState {
  kind: BoardKind;
  width: number;
  height: number;
  /** Row-major, length width*height, index = r * width + f. */
  squares: (Piece | null)[];
  toMove: Seat;
  /** Chess board only. */
  castling: CastlingRights;
  /** Chess board only: the square a pawn may capture onto via en passant. */
  enPassant: Square | null;
  /** Plies played on this board. */
  ply: number;
}

export type Reserve = Partial<Record<PieceType, number>>;

export type MatchMode = "1v1" | "2v2";

export type MatchStatus = "active" | "finished";

export interface MatchResult {
  /** null means drawn. */
  winner: Team | null;
  reason: string;
  /** Which board decided it, when applicable. */
  board?: BoardKind;
}

export interface MatchState {
  mode: MatchMode;
  boards: Record<BoardKind, BoardState>;
  reserves: Record<Seat, Reserve>;
  /**
   * 1v1 only: index into TURN_ORDER naming whose turn it is. In 2v2 the two
   * boards advance independently and this is undefined.
   */
  turnCursor?: number;
  status: MatchStatus;
  result?: MatchResult;
  /** Positions seen, for repetition detection. Keyed per board. */
  history: Record<BoardKind, string[]>;
}

export interface NormalMove {
  kind: "move";
  board: BoardKind;
  from: Square;
  to: Square;
  /** Chess/xiangqi-board pawn promotion choice. */
  promotion?: ChessPieceType;
}

export interface DropMove {
  kind: "drop";
  board: BoardKind;
  piece: PieceType;
  to: Square;
}

export type Move = NormalMove | DropMove;

/** A legal destination, annotated for the UI. */
export interface MoveTarget {
  to: Square;
  capture: boolean;
  /** Set when this move requires choosing a promotion piece. */
  promotion?: boolean;
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
