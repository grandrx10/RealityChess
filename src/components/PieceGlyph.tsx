import type { PieceType, Seat } from "@/rules/types";
import { isChessPiece } from "@/rules/geometry";
import {
  CHESS_ART,
  CHESS_SCALE,
  xiangqiSprite,
  type XiangqiVariant,
} from "./pieceArt";

/**
 * Two art sets share one 0..100 drawing box. Which set a piece comes from is
 * the visual signal that matters in this variant: xiangqi-native pieces carry
 * their disc onto the chess board too, so "on a disc" always means "this piece
 * follows the xiangqi rulebook", however far from home it has been dropped.
 */
export type PieceNotation = "icon" | "character";

export function isRedSide(owner: Seat): boolean {
  return owner === "chessWhite" || owner === "xiangqiRed";
}

const RED_CHARACTERS: Partial<Record<PieceType, string>> = {
  general: "帥",
  advisor: "仕",
  elephant: "相",
  chariot: "俥",
  horse: "傌",
  cannon: "炮",
  soldier: "兵",
  king: "♔",
  queen: "♕",
  rook: "♖",
  bishop: "♗",
  knight: "♘",
  pawn: "♙",
};

const BLACK_CHARACTERS: Partial<Record<PieceType, string>> = {
  general: "將",
  advisor: "士",
  elephant: "象",
  chariot: "車",
  horse: "馬",
  cannon: "砲",
  soldier: "卒",
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟",
};

export function characterFor(type: PieceType, owner: Seat): string {
  const set = isRedSide(owner) ? RED_CHARACTERS : BLACK_CHARACTERS;
  return set[type] ?? "?";
}

export const PIECE_LABELS: Record<PieceType, string> = {
  king: "King",
  queen: "Queen",
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
  general: "General",
  advisor: "Advisor",
  elephant: "Elephant",
  horse: "Horse",
  chariot: "Chariot",
  cannon: "Cannon",
  soldier: "Soldier",
};

/**
 * One palette per seat. A piece's owner always tells you which board it stands
 * on, so each seat can take the colours its own game expects.
 *   --pf piece fill   --ps outline and detail   --pd xiangqi disc
 */
export const PALETTE: Record<
  Seat,
  { pf: string; ps: string; pd: string; variant: XiangqiVariant }
> = {
  chessWhite: { pf: "#f4f1ea", ps: "#1b1714", pd: "#f4f1ea", variant: "light" },
  chessBlack: { pf: "#2a2623", ps: "#ece4d4", pd: "#2a2623", variant: "dark" },
  xiangqiRed: { pf: "#c6362b", ps: "#5c1109", pd: "#f1e7d0", variant: "red" },
  xiangqiBlack: { pf: "#2a2623", ps: "#ece4d4", pd: "#2a2623", variant: "dark" },
};

export interface PieceGlyphProps {
  type: PieceType;
  owner: Seat;
  notation: PieceNotation;
}

export function PieceGlyph({ type, owner, notation }: PieceGlyphProps) {
  const colors = PALETTE[owner];
  const { pf, ps, pd } = colors;

  if (notation === "character") {
    const onDisc = !isChessPiece(type);
    return (
      <g aria-label={PIECE_LABELS[type]}>
        {onDisc ? <circle cx="50" cy="50" r="47" fill={pd} /> : null}
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isChessPiece(type) ? 72 : 58}
          fontWeight={700}
          fill={onDisc ? ps : pf}
          stroke={onDisc ? "none" : ps}
          strokeWidth={onDisc ? 0 : 1.5}
          style={{
            fontFamily:
              '"Noto Serif SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", SimSun, serif',
          }}
        >
          {characterFor(type, owner)}
        </text>
      </g>
    );
  }

  const draw = CHESS_ART[type];
  if (draw) {
    return (
      <g aria-label={PIECE_LABELS[type]} transform={CHESS_SCALE}>
        {draw(colors)}
      </g>
    );
  }
  // Xiangqi-native: a rasterised tile that already carries its own disc.
  return (
    <image
      href={xiangqiSprite(type, colors.variant)}
      x="0"
      y="0"
      width="100"
      height="100"
      aria-label={PIECE_LABELS[type]}
    />
  );
}

/** Standalone glyph for the reserve trays. */
export function PieceIcon({
  type,
  owner,
  notation,
  size = 32,
}: {
  type: PieceType;
  owner: Seat;
  notation: PieceNotation;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img">
      <PieceGlyph type={type} owner={owner} notation={notation} />
    </svg>
  );
}
