"use client";

import { PIECE_LABELS, PieceIcon, type PieceNotation } from "./PieceGlyph";
import { nativeBoardOf } from "@/rules/geometry";
import type { PieceType, Reserve, Seat } from "@/rules/types";

const ORDER: PieceType[] = [
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

export interface ReserveTrayProps {
  seat: Seat;
  reserve: Reserve;
  notation: PieceNotation;
  /** Which piece is armed for dropping, if any. */
  armed: PieceType | null;
  /** False when this tray belongs to someone else, or it is not your turn. */
  interactive: boolean;
  onArm: (piece: PieceType | null) => void;
  label: string;
}

export function ReserveTray({
  seat,
  reserve,
  notation,
  armed,
  interactive,
  onArm,
  label,
}: ReserveTrayProps) {
  const held = ORDER.filter((t) => (reserve[t] ?? 0) > 0);

  return (
    <div className="tray">
      <div className="tray__label">{label}</div>
      {held.length === 0 ? (
        <div className="tray__empty">nothing in hand</div>
      ) : (
        <div className="tray__items">
          {held.map((type) => {
            const count = reserve[type] ?? 0;
            const isArmed = armed === type;
            return (
              <button
                key={type}
                type="button"
                className={`chip${isArmed ? " chip--armed" : ""}`}
                disabled={!interactive}
                onClick={() => onArm(isArmed ? null : type)}
                title={`${PIECE_LABELS[type]} — from ${
                  nativeBoardOf(type) === "chess" ? "chess" : "xiangqi"
                }`}
              >
                <PieceIcon type={type} owner={seat} notation={notation} size={30} />
                <span className="chip__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
