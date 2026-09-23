"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BoardView } from "./BoardView";
import {
  PALETTE,
  PIECE_LABELS,
  PieceIcon,
  type PieceNotation,
} from "./PieceGlyph";
import { SEATS, boardOfSeat, seatsOfBoard, teamOf } from "@/rules/geometry";
import { findRoyal, inCheck } from "@/rules/movement";
import {
  PROMOTION_CHOICES,
  legalDropTargets,
  legalTargetsFrom,
  seatMayMove,
  seatToPlay,
} from "@/rules/match";
import type {
  BoardKind,
  ChessPieceType,
  MatchState,
  Move,
  MoveTarget,
  PieceType,
  Reserve,
  Seat,
  Square,
} from "@/rules/types";

const SEAT_COUNT = SEATS.length;

const TRAY_ORDER: PieceType[] = [
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
  "chariot",
  "cannon",
  "horse",
  "elephant",
  "advisor",
  "soldier",
];

interface Selection {
  board: BoardKind;
  from: Square;
}

interface Armed {
  board: BoardKind;
  piece: PieceType;
}

interface PendingPromotion {
  seat: Seat;
  board: BoardKind;
  from: Square;
  to: Square;
}

export interface MatchViewProps {
  match: MatchState;
  /** Seats this client is allowed to move. */
  controlled: Seat[];
  onMove: (seat: Seat, move: Move) => void;
  error?: string | null;
  /** Page-level controls, shown beside the notation toggle. */
  toolbar?: ReactNode;
}

export function MatchView({
  match,
  controlled,
  onMove,
  error,
  toolbar,
}: MatchViewProps) {
  const [notation, setNotation] = useState<PieceNotation>("icon");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);

  const seatOn = (kind: BoardKind): Seat | null =>
    seatToPlay(match, controlled, kind);

  const targets: MoveTarget[] = useMemo(
    () => (selection ? legalTargetsFrom(match, selection.from, selection.board) : []),
    [match, selection],
  );

  const dropTargets: Square[] = useMemo(() => {
    if (!armed) return [];
    const seat = seatOn(armed.board);
    if (!seat) return [];
    return legalDropTargets(match, seat, armed.piece);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, armed, controlled]);

  function clear() {
    setSelection(null);
    setArmed(null);
  }

  function handleSquareClick(kind: BoardKind, sq: Square) {
    if (match.status !== "active") return;
    const seat = seatOn(kind);
    if (!seat || !seatMayMove(match, seat)) return;

    if (armed && armed.board === kind) {
      if (dropTargets.some((t) => t.f === sq.f && t.r === sq.r)) {
        onMove(seat, { kind: "drop", board: kind, piece: armed.piece, to: sq });
        clear();
      } else {
        setArmed(null);
      }
      return;
    }

    const board = match.boards[kind];
    const piece = board.squares[sq.r * board.width + sq.f];

    if (selection && selection.board === kind) {
      const target = targets.find((t) => t.to.f === sq.f && t.to.r === sq.r);
      if (target) {
        if (target.promotion) {
          setPromotion({ seat, board: kind, from: selection.from, to: sq });
        } else {
          onMove(seat, { kind: "move", board: kind, from: selection.from, to: sq });
        }
        clear();
        return;
      }
    }

    if (piece && piece.owner === seat) {
      setSelection({ board: kind, from: sq });
      setArmed(null);
      return;
    }
    clear();
  }

  function choosePromotion(choice: ChessPieceType) {
    if (!promotion) return;
    onMove(promotion.seat, {
      kind: "move",
      board: promotion.board,
      from: promotion.from,
      to: promotion.to,
      promotion: choice,
    });
    setPromotion(null);
  }

  return (
    <div className="match">
      <div className="match__bar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Switch piece notation"
          title="Pieces: images / characters"
          onClick={() => setNotation((n) => (n === "icon" ? "character" : "icon"))}
        >
          {notation === "icon" ? (
            <span className="han">車</span>
          ) : (
            <PieceIcon type="horse" owner="xiangqiRed" notation="icon" size={26} />
          )}
        </button>
        {toolbar}
      </div>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="boards">
        {(["chess", "xiangqi"] as BoardKind[]).map((kind) => (
          <BoardPanel
            key={kind}
            kind={kind}
            match={match}
            controlled={controlled}
            notation={notation}
            selection={selection}
            targets={targets}
            dropTargets={dropTargets}
            armed={armed}
            onSquareClick={handleSquareClick}
            onArm={(k, p) => {
              setSelection(null);
              setArmed(p ? { board: k, piece: p } : null);
            }}
          />
        ))}
      </div>

      {promotion ? (
        <div className="modal" role="dialog" aria-label="Choose a promotion">
          <div className="modal__card">
            {PROMOTION_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className="icon-btn icon-btn--lg"
                aria-label={PIECE_LABELS[choice]}
                title={PIECE_LABELS[choice]}
                onClick={() => choosePromotion(choice)}
              >
                <PieceIcon
                  type={choice}
                  owner={promotion.seat}
                  notation={notation}
                  size={44}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BoardPanel({
  kind,
  match,
  controlled,
  notation,
  selection,
  targets,
  dropTargets,
  armed,
  onSquareClick,
  onArm,
}: {
  kind: BoardKind;
  match: MatchState;
  controlled: Seat[];
  notation: PieceNotation;
  selection: Selection | null;
  targets: MoveTarget[];
  dropTargets: Square[];
  armed: Armed | null;
  onSquareClick: (kind: BoardKind, sq: Square) => void;
  onArm: (kind: BoardKind, piece: PieceType | null) => void;
}) {
  const board = match.boards[kind];
  const [naturalBottom, naturalTop] = seatsOfBoard(kind);

  /*
   * Partners sit on the same side of the screen. Teams are Xiangqi Red with
   * Chess Black, so the near side is Chess Black on one board and Xiangqi Red
   * on the other -- which means the chess board is drawn flipped. Watching
   * your partner's captures arrive from the row opposite yours would be
   * backwards, whatever chess convention says.
   */
  // A hot seat holds every seat and has no team of its own, so it defaults to
  // Team A: Chess Black nearest on one board, Xiangqi Red on the other.
  const nearTeam =
    controlled.length > 0 && controlled.length < SEAT_COUNT
      ? teamOf(controlled[0])
      : "teamA";
  const nearSeat =
    teamOf(naturalBottom) === nearTeam ? naturalBottom : naturalTop;
  const farSeat = nearSeat === naturalBottom ? naturalTop : naturalBottom;
  const flipped = nearSeat === naturalTop;

  const checkedSeat = seatsOfBoard(kind).find((s) => inCheck(board, s)) ?? null;
  const checkAt = checkedSeat ? findRoyal(board, checkedSeat) : null;

  // One marker per board, sliding between the two seat rows.
  const nearToMove = seatMayMove(match, nearSeat);
  const markerSeat = nearToMove ? nearSeat : farSeat;
  const decided = match.status === "finished" && match.result?.winner != null;
  const restSeat = decided
    ? (match.result!.winner === teamOf(nearSeat) ? nearSeat : farSeat)
    : markerSeat;
  const { pf, ps } = PALETTE[restSeat];

  return (
    <section className="panel">
      <div className="rail" aria-hidden>
        <span
          className={`rail__dot${restSeat === nearSeat ? " rail__dot--near" : ""}${
            decided ? " rail__dot--won" : ""
          }`}
          style={{ background: pf, borderColor: ps }}
        />
      </div>
      <div className="panel__body">
        <SeatRow
          seat={farSeat}
          match={match}
          controlled={controlled}
          notation={notation}
          armed={armed?.board === kind ? armed.piece : null}
          onArm={(p) => onArm(kind, p)}
        />
        <BoardView
          board={board}
          notation={notation}
          flipped={flipped}
          selected={selection?.board === kind ? selection.from : null}
          targets={selection?.board === kind ? targets : []}
          dropTargets={armed?.board === kind ? dropTargets : []}
          lastMove={board.lastMove ?? null}
          checkAt={checkAt}
          onSquareClick={(sq) => onSquareClick(kind, sq)}
        />
        <SeatRow
          seat={nearSeat}
          match={match}
          controlled={controlled}
          notation={notation}
          armed={armed?.board === kind ? armed.piece : null}
          onArm={(p) => onArm(kind, p)}
        />
      </div>
    </section>
  );
}

/**
 * A seat's hand. The turn itself is shown by the marker on the rail, which
 * slides between the two rows, so nothing here needs a label.
 */
function SeatRow({
  seat,
  match,
  controlled,
  notation,
  armed,
  onArm,
}: {
  seat: Seat;
  match: MatchState;
  controlled: Seat[];
  notation: PieceNotation;
  armed: PieceType | null;
  onArm: (piece: PieceType | null) => void;
}) {
  const reserve: Reserve = match.reserves[seat];
  const held = TRAY_ORDER.filter((t) => (reserve[t] ?? 0) > 0);
  const active = seatMayMove(match, seat);
  const mine = controlled.includes(seat);

  return (
    <div className={`seat${active ? " seat--active" : ""}`}>
      <div className="seat__hand">
        {held.map((type) => (
          <button
            key={type}
            type="button"
            className={`chip${armed === type && mine ? " chip--armed" : ""}`}
            disabled={!mine || !active}
            aria-label={PIECE_LABELS[type]}
            title={PIECE_LABELS[type]}
            onClick={() => onArm(armed === type ? null : type)}
          >
            <PieceIcon type={type} owner={seat} notation={notation} size={26} />
            {(reserve[type] ?? 0) > 1 ? (
              <span className="chip__n">{reserve[type]}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
