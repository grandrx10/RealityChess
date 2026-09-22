"use client";

import { useMemo, useState } from "react";
import { BoardView } from "./BoardView";
import { ReserveTray } from "./ReserveTray";
import { PIECE_LABELS, type PieceNotation } from "./PieceGlyph";
import { boardOfSeat, partnerOf, seatsOfBoard } from "@/rules/geometry";
import { findRoyal, inCheck } from "@/rules/movement";
import {
  PROMOTION_CHOICES,
  legalDropTargets,
  legalTargetsFrom,
  seatMayMove,
} from "@/rules/match";
import type {
  BoardKind,
  ChessPieceType,
  MatchState,
  Move,
  MoveTarget,
  PieceType,
  Seat,
  Square,
} from "@/rules/types";

const SEAT_NAMES: Record<Seat, string> = {
  chessWhite: "Chess · White",
  chessBlack: "Chess · Black",
  xiangqiRed: "Xiangqi · Red",
  xiangqiBlack: "Xiangqi · Black",
};

const TEAM_NAMES = {
  teamA: "Team A (Red + Chess Black)",
  teamB: "Team B (Xiangqi Black + White)",
} as const;

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
}

export function MatchView({ match, controlled, onMove, error }: MatchViewProps) {
  const [notation, setNotation] = useState<PieceNotation>("icon");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);

  /** The seat this client controls on a given board, if any. */
  const seatOn = (kind: BoardKind): Seat | null =>
    controlled.find((s) => boardOfSeat(s) === kind) ?? null;

  const targets: MoveTarget[] = useMemo(() => {
    if (!selection) return [];
    return legalTargetsFrom(match, selection.from, selection.board);
  }, [match, selection]);

  const dropTargets: Square[] = useMemo(() => {
    if (!armed) return [];
    const seat = seatOn(armed.board);
    if (!seat) return [];
    return legalDropTargets(match, seat, armed.piece);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, armed, controlled]);

  function clearSelection() {
    setSelection(null);
    setArmed(null);
  }

  function handleSquareClick(kind: BoardKind, sq: Square) {
    if (match.status !== "active") return;
    const seat = seatOn(kind);
    if (!seat || !seatMayMove(match, seat)) return;

    // Placing an armed reserve piece.
    if (armed && armed.board === kind) {
      if (dropTargets.some((t) => t.f === sq.f && t.r === sq.r)) {
        onMove(seat, { kind: "drop", board: kind, piece: armed.piece, to: sq });
        clearSelection();
      } else {
        setArmed(null);
      }
      return;
    }

    const board = match.boards[kind];
    const piece = board.squares[sq.r * board.width + sq.f];

    // Completing a move.
    if (selection && selection.board === kind) {
      const target = targets.find((t) => t.to.f === sq.f && t.to.r === sq.r);
      if (target) {
        if (target.promotion) {
          setPromotion({ seat, board: kind, from: selection.from, to: sq });
        } else {
          onMove(seat, { kind: "move", board: kind, from: selection.from, to: sq });
        }
        clearSelection();
        return;
      }
    }

    // Selecting one of your own pieces.
    if (piece && piece.owner === seat) {
      setSelection({ board: kind, from: sq });
      setArmed(null);
      return;
    }
    clearSelection();
  }

  function handleArm(kind: BoardKind, piece: PieceType | null) {
    setSelection(null);
    setArmed(piece ? { board: kind, piece } : null);
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
      <header className="match__bar">
        <div className="match__status">
          <StatusLine match={match} controlled={controlled} />
        </div>
        <div className="match__tools">
          <button
            type="button"
            className="toggle"
            onClick={() =>
              setNotation((n) => (n === "icon" ? "character" : "icon"))
            }
          >
            {notation === "icon" ? "Pieces: images" : "Pieces: 漢字"}
          </button>
        </div>
      </header>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="boards">
        <BoardPanel
          kind="chess"
          title="Chess"
          match={match}
          controlled={controlled}
          notation={notation}
          selection={selection}
          targets={targets}
          dropTargets={dropTargets}
          armed={armed}
          onSquareClick={handleSquareClick}
          onArm={handleArm}
        />
        <BoardPanel
          kind="xiangqi"
          title="Xiangqi"
          match={match}
          controlled={controlled}
          notation={notation}
          selection={selection}
          targets={targets}
          dropTargets={dropTargets}
          armed={armed}
          onSquareClick={handleSquareClick}
          onArm={handleArm}
        />
      </div>

      {promotion ? (
        <div className="modal" role="dialog" aria-label="Choose a promotion">
          <div className="modal__card">
            <p className="modal__title">Promote to</p>
            <div className="modal__row">
              {PROMOTION_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="btn"
                  onClick={() => choosePromotion(choice)}
                >
                  {PIECE_LABELS[choice]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BoardPanel({
  kind,
  title,
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
  title: string;
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
  const mySeat = controlled.find((s) => boardOfSeat(s) === kind) ?? null;
  const [bottomSeat, topSeat] = seatsOfBoard(kind);
  // Show the board from the perspective of whoever is sitting here.
  const flipped = mySeat === topSeat;
  const myTurn = mySeat ? seatMayMove(match, mySeat) : false;

  const checkedSeat = seatsOfBoard(kind).find((s) => inCheck(board, s)) ?? null;
  const checkAt = checkedSeat ? findRoyal(board, checkedSeat) : null;

  const nearSeat = flipped ? topSeat : bottomSeat;
  const farSeat = flipped ? bottomSeat : topSeat;

  return (
    <section className="panel">
      <h2 className="panel__title">
        {title}
        <span className="panel__turn">
          {board.toMove === nearSeat ? "▼" : "▲"} {SEAT_NAMES[board.toMove]} to move
        </span>
      </h2>

      <ReserveTray
        seat={farSeat}
        reserve={match.reserves[farSeat]}
        notation={notation}
        armed={armed?.board === kind && farSeat === mySeat ? armed.piece : null}
        interactive={farSeat === mySeat && myTurn}
        onArm={(p) => onArm(kind, p)}
        label={`${SEAT_NAMES[farSeat]} · in hand`}
      />

      <BoardView
        board={board}
        notation={notation}
        flipped={flipped}
        selected={selection?.board === kind ? selection.from : null}
        targets={selection?.board === kind ? targets : []}
        dropTargets={armed?.board === kind ? dropTargets : []}
        checkAt={checkAt}
        onSquareClick={(sq) => onSquareClick(kind, sq)}
      />

      <ReserveTray
        seat={nearSeat}
        reserve={match.reserves[nearSeat]}
        notation={notation}
        armed={armed?.board === kind && nearSeat === mySeat ? armed.piece : null}
        interactive={nearSeat === mySeat && myTurn}
        onArm={(p) => onArm(kind, p)}
        label={`${SEAT_NAMES[nearSeat]} · in hand`}
      />

      <p className="panel__hint">
        Captures here go to {SEAT_NAMES[partnerOf(nearSeat)]} and{" "}
        {SEAT_NAMES[partnerOf(farSeat)]}.
      </p>
    </section>
  );
}

function StatusLine({
  match,
  controlled,
}: {
  match: MatchState;
  controlled: Seat[];
}) {
  if (match.status === "finished" && match.result) {
    const { winner, reason, board } = match.result;
    return (
      <strong>
        {winner ? `${TEAM_NAMES[winner]} wins` : "Draw"} — {reason}
        {board ? ` on the ${board} board` : ""}
      </strong>
    );
  }
  const yours = controlled.filter((s) => seatMayMove(match, s));
  if (yours.length === 0) {
    return <span>Waiting for the other side…</span>;
  }
  return (
    <span>
      Your move: <strong>{yours.map((s) => SEAT_NAMES[s]).join(" and ")}</strong>
    </span>
  );
}
