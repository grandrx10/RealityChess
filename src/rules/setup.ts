import type { BoardKind, BoardState, Piece, Seat, XiangqiPieceType } from "./types";
import { GEOMETRY } from "./geometry";

function empty(kind: BoardKind, toMove: Seat): BoardState {
  const g = GEOMETRY[kind];
  return {
    kind,
    width: g.width,
    height: g.height,
    squares: new Array<Piece | null>(g.width * g.height).fill(null),
    toMove,
    castling: { whiteK: true, whiteQ: true, blackK: true, blackQ: true },
    enPassant: null,
    ply: 0,
  };
}

function place(board: BoardState, f: number, r: number, piece: Piece): void {
  board.squares[r * board.width + f] = piece;
}

const CHESS_BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
  "bishop",
  "knight",
  "rook",
] as const;

export function initialChessBoard(): BoardState {
  const board = empty("chess", "chessWhite");
  CHESS_BACK_RANK.forEach((type, f) => {
    place(board, f, 0, { type, owner: "chessWhite" });
    place(board, f, 7, { type, owner: "chessBlack" });
  });
  for (let f = 0; f < 8; f++) {
    place(board, f, 1, { type: "pawn", owner: "chessWhite" });
    place(board, f, 6, { type: "pawn", owner: "chessBlack" });
  }
  return board;
}

const XIANGQI_BACK_RANK: XiangqiPieceType[] = [
  "chariot",
  "horse",
  "elephant",
  "advisor",
  "general",
  "advisor",
  "elephant",
  "horse",
  "chariot",
];

export function initialXiangqiBoard(): BoardState {
  const board = empty("xiangqi", "xiangqiRed");
  XIANGQI_BACK_RANK.forEach((type, f) => {
    place(board, f, 0, { type, owner: "xiangqiRed" });
    place(board, f, 9, { type, owner: "xiangqiBlack" });
  });
  // Cannons sit on the third rank, in from each edge.
  for (const f of [1, 7]) {
    place(board, f, 2, { type: "cannon", owner: "xiangqiRed" });
    place(board, f, 7, { type: "cannon", owner: "xiangqiBlack" });
  }
  // Five soldiers each, on alternating files along the river bank.
  for (const f of [0, 2, 4, 6, 8]) {
    place(board, f, 3, { type: "soldier", owner: "xiangqiRed" });
    place(board, f, 6, { type: "soldier", owner: "xiangqiBlack" });
  }
  return board;
}
