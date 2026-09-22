import {
  SEATS,
  TURN_ORDER,
  boardOfSeat,
  forwardOf,
  isDroppable,
  isOwnHalf,
  nativeBoardOf,
  opponentOf,
  partnerOf,
  pieceAt,
  reserveFormOf,
  sameSquare,
  seatsOfBoard,
  setPiece,
  teamOf,
} from "./geometry";
import {
  findRoyal,
  inCheck,
  isAttacked,
  pseudoTargets,
  royalsFacing,
} from "./movement";
import { initialChessBoard, initialXiangqiBoard } from "./setup";
import {
  RuleError,
  type BoardKind,
  type BoardState,
  type ChessPieceType,
  type MatchMode,
  type MatchState,
  type Move,
  type MoveTarget,
  type Piece,
  type PieceType,
  type Reserve,
  type Seat,
  type Square,
} from "./types";

const HISTORY_LIMIT = 256;

const PROMOTION_CHOICES: ChessPieceType[] = [
  "queen",
  "rook",
  "bishop",
  "knight",
];

export function createMatch(mode: MatchMode): MatchState {
  const match: MatchState = {
    mode,
    boards: { chess: initialChessBoard(), xiangqi: initialXiangqiBoard() },
    reserves: {
      chessWhite: {},
      chessBlack: {},
      xiangqiRed: {},
      xiangqiBlack: {},
    },
    turnCursor: mode === "1v1" ? 0 : undefined,
    status: "active",
    history: { chess: [], xiangqi: [] },
  };
  match.history.chess.push(positionKey(match.boards.chess));
  match.history.xiangqi.push(positionKey(match.boards.xiangqi));
  return match;
}

export function positionKey(board: BoardState): string {
  const cells = board.squares
    .map((p) => (p ? `${p.type[0]}${p.owner[5]}${p.promoted ? "+" : ""}` : "."))
    .join("");
  return `${cells}|${board.toMove}`;
}

/* -------------------------------------------------------------- turn order */

/**
 * In 2v2 the boards run independently, so a seat may move whenever it is that
 * board's turn. In 1v1 one player holds both seats of a team, and play follows
 * the strict four-turn cycle.
 */
export function seatMayMove(match: MatchState, seat: Seat): boolean {
  if (match.status !== "active") return false;
  const board = match.boards[boardOfSeat(seat)];
  if (board.toMove !== seat) return false;
  if (match.mode === "1v1") {
    return TURN_ORDER[match.turnCursor ?? 0] === seat;
  }
  return true;
}

/**
 * Which of the seats a client controls is playing on a given board.
 *
 * Hot seat holds both seats of a board, so this has to prefer whichever one is
 * on the clock. Resolving by board alone pins the chess board to White for the
 * whole game and silently drops every click Black makes.
 */
export function seatToPlay(
  match: MatchState,
  controlled: Seat[],
  board: BoardKind,
): Seat | null {
  const mine = controlled.filter((s) => boardOfSeat(s) === board);
  return mine.find((s) => seatMayMove(match, s)) ?? mine[0] ?? null;
}

/** Every seat that could legally move right now. */
export function seatsToMove(match: MatchState): Seat[] {
  return SEATS.filter((s) => seatMayMove(match, s));
}

/* ----------------------------------------------------------- board updates */

function cloneBoard(board: BoardState): BoardState {
  return {
    ...board,
    squares: board.squares.slice(),
    castling: { ...board.castling },
    enPassant: board.enPassant ? { ...board.enPassant } : null,
  };
}

function promotionRankFor(board: BoardState, seat: Seat): number {
  return forwardOf(seat) === 1 ? board.height - 1 : 0;
}

function isCastling(board: BoardState, from: Square, to: Square): boolean {
  const piece = pieceAt(board, from);
  return (
    board.kind === "chess" &&
    piece?.type === "king" &&
    from.r === to.r &&
    Math.abs(to.f - from.f) === 2
  );
}

export interface AppliedBoard {
  board: BoardState;
  captured: Piece | null;
}

/**
 * Apply a board move without any legality checking. Handles en passant,
 * castling rook transfer, promotion and the en-passant/castling bookkeeping.
 */
export function applyToBoard(
  board: BoardState,
  from: Square,
  to: Square,
  promotion?: ChessPieceType,
): AppliedBoard {
  const next = cloneBoard(board);
  const piece = pieceAt(next, from);
  if (!piece) throw new RuleError("No piece on the origin square");

  let captured = pieceAt(next, to);

  // En passant: the captured pawn stands beside the destination, not on it.
  if (
    piece.type === "pawn" &&
    !captured &&
    from.f !== to.f &&
    next.enPassant &&
    sameSquare(next.enPassant, to)
  ) {
    const victim = { f: to.f, r: from.r };
    captured = pieceAt(next, victim);
    setPiece(next, victim, null);
  }

  const castled = isCastling(next, from, to);

  setPiece(next, from, null);

  let placed: Piece = piece;
  const promoRank = promotionRankFor(next, piece.owner);
  if (piece.type === "pawn" && to.r === promoRank) {
    placed = {
      type: promotion && PROMOTION_CHOICES.includes(promotion) ? promotion : "queen",
      owner: piece.owner,
      promoted: true,
    };
  }
  setPiece(next, to, placed);

  if (castled) {
    const kingside = to.f > from.f;
    const rookFrom = { f: kingside ? next.width - 1 : 0, r: from.r };
    const rookTo = { f: kingside ? to.f - 1 : to.f + 1, r: from.r };
    const rook = pieceAt(next, rookFrom);
    setPiece(next, rookFrom, null);
    if (rook) setPiece(next, rookTo, rook);
  }

  // Double pawn push opens an en passant square; anything else clears it.
  next.enPassant =
    piece.type === "pawn" && Math.abs(to.r - from.r) === 2
      ? { f: from.f, r: (from.r + to.r) / 2 }
      : null;

  if (next.kind === "chess") {
    const rights = next.castling;
    if (piece.type === "king") {
      if (piece.owner === "chessWhite") {
        rights.whiteK = rights.whiteQ = false;
      } else {
        rights.blackK = rights.blackQ = false;
      }
    }
    // A rook leaving, or being captured on, a corner kills that right.
    for (const sq of [from, to]) {
      if (sq.r === 0 && sq.f === 0) rights.whiteQ = false;
      if (sq.r === 0 && sq.f === next.width - 1) rights.whiteK = false;
      if (sq.r === next.height - 1 && sq.f === 0) rights.blackQ = false;
      if (sq.r === next.height - 1 && sq.f === next.width - 1)
        rights.blackK = false;
    }
  }

  next.ply += 1;
  return { board: next, captured };
}

function applyDropToBoard(
  board: BoardState,
  piece: PieceType,
  owner: Seat,
  to: Square,
): BoardState {
  const next = cloneBoard(board);
  setPiece(next, to, { type: piece, owner });
  next.enPassant = null;
  next.ply += 1;
  return next;
}

/* --------------------------------------------------------- move legality */

function leavesRoyalSafe(board: BoardState, seat: Seat): boolean {
  return !inCheck(board, seat);
}

function castlingTargets(board: BoardState, seat: Seat): Square[] {
  if (board.kind !== "chess") return [];
  const home = forwardOf(seat) === 1 ? 0 : board.height - 1;
  const king = findRoyal(board, seat);
  if (!king || king.r !== home || king.f !== 4) return [];
  if (inCheck(board, seat)) return [];

  const rights = board.castling;
  const white = seat === "chessWhite";
  const foe = opponentOf(seat);
  const out: Square[] = [];

  const tryside = (allowed: boolean, rookFile: number, kingTo: number) => {
    if (!allowed) return;
    const rook = pieceAt(board, { f: rookFile, r: home });
    if (!rook || rook.type !== "rook" || rook.owner !== seat) return;
    const lo = Math.min(rookFile, king.f) + 1;
    const hi = Math.max(rookFile, king.f) - 1;
    for (let f = lo; f <= hi; f++) {
      if (pieceAt(board, { f, r: home })) return;
    }
    // The king may not pass through or land on an attacked square.
    const dir = kingTo > king.f ? 1 : -1;
    for (let f = king.f + dir; ; f += dir) {
      if (isAttacked(board, { f, r: home }, foe)) return;
      if (f === kingTo) break;
    }
    out.push({ f: kingTo, r: home });
  };

  tryside(white ? rights.whiteK : rights.blackK, board.width - 1, 6);
  tryside(white ? rights.whiteQ : rights.blackQ, 0, 2);
  return out;
}

/** Legal destinations for the piece on `from`, ready for the UI to draw. */
export function legalTargetsFrom(
  match: MatchState,
  from: Square,
  boardKind: BoardKind,
): MoveTarget[] {
  const board = match.boards[boardKind];
  const piece = pieceAt(board, from);
  if (!piece) return [];

  const candidates = [...pseudoTargets(board, from)];
  if (piece.type === "king") candidates.push(...castlingTargets(board, piece.owner));

  const promoRank = promotionRankFor(board, piece.owner);
  const out: MoveTarget[] = [];
  for (const to of candidates) {
    const { board: after } = applyToBoard(board, from, to);
    if (!leavesRoyalSafe(after, piece.owner)) continue;
    out.push({
      to,
      capture: pieceAt(board, to) !== null,
      promotion: piece.type === "pawn" && to.r === promoRank ? true : undefined,
    });
  }
  return out;
}

/**
 * Where `seat` may drop `piece`.
 *
 * Drops onto the xiangqi board must land on the dropper's own side of the
 * river. The chess board has no placement restriction at all.
 */
export function legalDropTargets(
  match: MatchState,
  seat: Seat,
  piece: PieceType,
): Square[] {
  if ((match.reserves[seat][piece] ?? 0) <= 0) return [];
  const boardKind = boardOfSeat(seat);
  const board = match.boards[boardKind];
  const restricted = boardKind === "xiangqi";
  const checked = inCheck(board, seat);
  const promoRank = promotionRankFor(board, seat);

  const out: Square[] = [];
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) {
      const to = { f, r };
      if (pieceAt(board, to)) continue;
      if (restricted && !isOwnHalf(board, seat, to)) continue;
      // A pawn on its promotion rank would be permanently immobile.
      if (piece === "pawn" && r === promoRank) continue;
      // Adding a piece can never expose your own royal, so the check test is
      // only needed when you are already in check and must block it.
      if (checked) {
        const after = applyDropToBoard(board, piece, seat, to);
        if (!leavesRoyalSafe(after, seat)) continue;
      }
      out.push(to);
    }
  }
  return out;
}

export function reserveTypes(reserve: Reserve): PieceType[] {
  return (Object.keys(reserve) as PieceType[]).filter(
    (t) => (reserve[t] ?? 0) > 0,
  );
}

export function hasAnyLegalMove(match: MatchState, seat: Seat): boolean {
  const boardKind = boardOfSeat(seat);
  const board = match.boards[boardKind];
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) {
      const p = board.squares[r * board.width + f];
      if (!p || p.owner !== seat) continue;
      if (legalTargetsFrom(match, { f, r }, boardKind).length > 0) return true;
    }
  }
  for (const type of reserveTypes(match.reserves[seat])) {
    if (legalDropTargets(match, seat, type).length > 0) return true;
  }
  return false;
}

export function allLegalMoves(match: MatchState, seat: Seat): Move[] {
  const boardKind = boardOfSeat(seat);
  const board = match.boards[boardKind];
  const moves: Move[] = [];
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) {
      const p = board.squares[r * board.width + f];
      if (!p || p.owner !== seat) continue;
      for (const t of legalTargetsFrom(match, { f, r }, boardKind)) {
        if (t.promotion) {
          for (const promo of PROMOTION_CHOICES) {
            moves.push({
              kind: "move",
              board: boardKind,
              from: { f, r },
              to: t.to,
              promotion: promo,
            });
          }
        } else {
          moves.push({ kind: "move", board: boardKind, from: { f, r }, to: t.to });
        }
      }
    }
  }
  for (const type of reserveTypes(match.reserves[seat])) {
    for (const to of legalDropTargets(match, seat, type)) {
      moves.push({ kind: "drop", board: boardKind, piece: type, to });
    }
  }
  return moves;
}

/* --------------------------------------------------------------- applying */

function addToReserve(reserve: Reserve, type: PieceType): void {
  reserve[type] = (reserve[type] ?? 0) + 1;
}

function removeFromReserve(reserve: Reserve, type: PieceType): void {
  const n = reserve[type] ?? 0;
  if (n <= 1) delete reserve[type];
  else reserve[type] = n - 1;
}

function advanceTurn(match: MatchState, seat: Seat): void {
  const boardKind = boardOfSeat(seat);
  match.boards[boardKind].toMove = opponentOf(seat);
  if (match.mode === "1v1") {
    match.turnCursor = ((match.turnCursor ?? 0) + 1) % TURN_ORDER.length;
  }
}

/**
 * Decide each board's standing. Reserves matter here: a capture on one board
 * can hand the other board's player exactly the piece they needed to block, so
 * both boards are re-evaluated after every move.
 */
function evaluateStatus(match: MatchState): void {
  if (match.status !== "active") return;
  for (const kind of ["chess", "xiangqi"] as BoardKind[]) {
    const board = match.boards[kind];
    const seat = board.toMove;
    // In 1v1 a seat that is not on the clock cannot be said to be mated yet.
    if (match.mode === "1v1" && TURN_ORDER[match.turnCursor ?? 0] !== seat)
      continue;
    if (hasAnyLegalMove(match, seat)) {
      const repeats = match.history[kind].filter(
        (k) => k === positionKey(board),
      ).length;
      if (repeats >= 3) {
        match.status = "finished";
        match.result = {
          winner: null,
          reason: "Threefold repetition",
          board: kind,
        };
        return;
      }
      continue;
    }
    match.status = "finished";
    if (inCheck(board, seat)) {
      match.result = {
        winner: teamOf(opponentOf(seat)),
        reason: "Checkmate",
        board: kind,
      };
    } else if (kind === "xiangqi") {
      // Xiangqi has no stalemate draw: the player with no move loses.
      match.result = {
        winner: teamOf(opponentOf(seat)),
        reason: "Stalemate (xiangqi: loss for the stalemated side)",
        board: kind,
      };
    } else {
      match.result = { winner: null, reason: "Stalemate", board: kind };
    }
    return;
  }
}

/** Validate and apply a move, returning a new match state. */
export function applyMove(
  match: MatchState,
  seat: Seat,
  move: Move,
): MatchState {
  if (match.status !== "active") throw new RuleError("The match is over");
  if (!seatMayMove(match, seat)) throw new RuleError("Not your turn");
  if (move.board !== boardOfSeat(seat))
    throw new RuleError("That is not your board");

  const next: MatchState = structuredClone(match);
  const boardKind = move.board;
  const board = next.boards[boardKind];

  if (move.kind === "drop") {
    if (!isDroppable(move.piece)) throw new RuleError("That piece cannot be dropped");
    if ((next.reserves[seat][move.piece] ?? 0) <= 0)
      throw new RuleError("You do not hold that piece");
    const ok = legalDropTargets(next, seat, move.piece).some((s) =>
      sameSquare(s, move.to),
    );
    if (!ok) throw new RuleError("Illegal drop square");
    removeFromReserve(next.reserves[seat], move.piece);
    next.boards[boardKind] = applyDropToBoard(board, move.piece, seat, move.to);
  } else {
    const piece = pieceAt(board, move.from);
    if (!piece) throw new RuleError("No piece there");
    if (piece.owner !== seat) throw new RuleError("That is not your piece");
    const ok = legalTargetsFrom(next, move.from, boardKind).some((t) =>
      sameSquare(t.to, move.to),
    );
    if (!ok) throw new RuleError("Illegal move");

    const { board: after, captured } = applyToBoard(
      board,
      move.from,
      move.to,
      move.promotion,
    );
    next.boards[boardKind] = after;
    if (captured) {
      // Captures feed your PARTNER, on the other board.
      addToReserve(next.reserves[partnerOf(seat)], reserveFormOf(captured));
    }
  }

  advanceTurn(next, seat);
  const log = next.history[boardKind];
  log.push(positionKey(next.boards[boardKind]));
  // Keep the log bounded so a long match still fits in one Firestore document.
  if (log.length > HISTORY_LIMIT) log.splice(0, log.length - HISTORY_LIMIT);
  evaluateStatus(next);
  return next;
}

export { PROMOTION_CHOICES, royalsFacing, inCheck, nativeBoardOf, seatsOfBoard };
