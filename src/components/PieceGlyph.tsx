import type { JSX } from "react";
import type { PieceType, Seat } from "@/rules/types";

/**
 * Every piece is drawn as an icon in a 100x100 box, so a cannon looks like the
 * same cannon whether it sits on the xiangqi board or has been dropped onto
 * the chess board. `notation` swaps the xiangqi icons for their traditional
 * characters and the chess icons for the Unicode chess glyphs.
 */
export type PieceNotation = "icon" | "character";

/** Red-side seats take the red character set; black-side seats the black. */
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

/* ------------------------------------------------------------------ icons */
/* Each icon is composed from primitives in a 0 0 100 100 viewBox so it stays
 * legible down to about 28px. `currentColor` carries the owner's colour. */

const BASE = <path d="M26 84h48v9H26z" />;

const ICONS: Record<PieceType, JSX.Element> = {
  pawn: (
    <>
      <circle cx="50" cy="30" r="14" />
      <path d="M40 44h20l9 40H31z" />
      {BASE}
    </>
  ),
  rook: (
    <>
      <path d="M28 22h10v10h8V22h8v10h8V22h10v20l-7 8v34H35V50l-7-8z" />
      {BASE}
    </>
  ),
  bishop: (
    <>
      <circle cx="50" cy="17" r="7" />
      <path d="M50 26c14 8 20 26 16 38H34c-4-12 2-30 16-38z" />
      <path d="M46 44h8v4h-8z" fill="#fff" opacity=".85" />
      <path d="M34 68h32l4 16H30z" />
      {BASE}
    </>
  ),
  knight: (
    <>
      <path d="M58 14l3 9c10 5 17 15 17 27 0 14-6 20-6 34H36c0-12 4-16 9-22l-13 4c-5 2-9-3-6-8l14-20c-4-1-7-4-7-8 0-8 10-12 16-14z" />
      <circle cx="61" cy="33" r="3" fill="#fff" />
      {BASE}
    </>
  ),
  queen: (
    <>
      <path d="M26 36l10 16 10-24 4 24 4-24 10 24 10-16-6 46H32z" />
      <circle cx="26" cy="32" r="6" />
      <circle cx="74" cy="32" r="6" />
      <circle cx="50" cy="22" r="6" />
      {BASE}
    </>
  ),
  king: (
    <>
      <path d="M46 10h8v8h8v8h-8v8h-8v-8h-8v-8h8z" />
      <path d="M28 38l10 14 12-16 12 16 10-14-6 44H34z" />
      {BASE}
    </>
  ),

  general: (
    <>
      <rect x="26" y="18" width="48" height="64" rx="6" />
      <rect x="34" y="26" width="32" height="48" rx="3" fill="#fff" opacity=".9" />
      <path d="M38 46h24v6H38z" />
      <path d="M47 32h6v32h-6z" />
    </>
  ),
  advisor: (
    <>
      <path d="M50 14l26 10v24c0 18-13 30-26 36-13-6-26-18-26-36V24z" />
      <circle cx="50" cy="46" r="11" fill="#fff" opacity=".9" />
    </>
  ),
  elephant: (
    <>
      {/* Ears read first at small sizes, so they are drawn large and wide. */}
      <ellipse cx="22" cy="42" rx="17" ry="21" />
      <ellipse cx="78" cy="42" rx="17" ry="21" />
      <path d="M50 16c17 0 28 11 28 26 0 13-6 20-13 24H35c-7-4-13-11-13-24 0-15 11-26 28-26z" />
      {/* Trunk, hanging and curling forward. */}
      <path
        d="M50 62v16c0 8 6 12 12 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Tusks. */}
      <path d="M36 64l-7 20 10-6z" />
      <path d="M64 64l7 20-10-6z" />
      <circle cx="40" cy="40" r="4" fill="#fff" />
      <circle cx="60" cy="40" r="4" fill="#fff" />
    </>
  ),
  horse: (
    <>
      <path d="M60 12l4 10c9 5 15 15 15 26 0 15-7 22-7 36H34c0-13 5-18 11-24l-14 5c-6 2-10-4-6-9l16-22c-5-1-8-5-8-9 0-9 11-12 18-13z" />
      <path d="M62 20l8 6-9 3 8 6-9 3 7 6-10 1z" fill="#fff" opacity=".75" />
      <circle cx="59" cy="36" r="3" fill="#fff" />
    </>
  ),
  chariot: (
    <>
      <rect x="28" y="16" width="44" height="18" rx="3" />
      <rect x="44" y="30" width="12" height="12" />
      <circle
        cx="50"
        cy="62"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
      <circle cx="50" cy="62" r="6" />
      <path
        d="M50 42v40M30 62h40M35 47l30 30M65 47L35 77"
        stroke="currentColor"
        strokeWidth="4"
      />
    </>
  ),
  cannon: (
    <>
      <path d="M30 56l38-26 8 12-38 26z" />
      <rect x="62" y="24" width="16" height="10" rx="2" transform="rotate(-34 70 29)" />
      <rect x="22" y="56" width="34" height="12" rx="4" />
      <circle cx="34" cy="76" r="13" />
      <circle cx="34" cy="76" r="5" fill="#fff" />
      <path d="M54 70l20 12-4 7-20-12z" />
    </>
  ),
  soldier: (
    <>
      <circle cx="44" cy="28" r="12" />
      <path d="M30 46h28l6 34H26z" />
      <path
        d="M72 14v70"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M72 10l7 12h-14z" />
    </>
  ),
};

export interface PieceGlyphProps {
  type: PieceType;
  owner: Seat;
  notation: PieceNotation;
  /** Size in px of the square/point the piece occupies. */
  size: number;
}

/**
 * Colours follow the seat, not the board: a cannon captured by xiangqi Red and
 * dropped by chess Black shows up in Black's colours on the chess board.
 */
/**
 * A piece's owner always tells you which board it stands on, so each seat can
 * have the palette its own game expects: light/dark on the chess board, red
 * ink on a cream disc for xiangqi.
 */
const PALETTE: Record<Seat, { fill: string; stroke: string }> = {
  chessWhite: { fill: "#f5f3ef", stroke: "#2a2521" },
  chessBlack: { fill: "#26221f", stroke: "#0b0a09" },
  xiangqiRed: { fill: "#b32b21", stroke: "#63120d" },
  xiangqiBlack: { fill: "#26221f", stroke: "#0b0a09" },
};

export function PieceGlyph({ type, owner, notation, size }: PieceGlyphProps) {
  const red = isRedSide(owner);
  const { fill, stroke } = PALETTE[owner];

  if (notation === "character") {
    return (
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={type === "king" || isChess(type) ? 62 : 52}
        fontWeight={700}
        fill={red ? "#a4231f" : "#18150f"}
        style={{
          fontFamily:
            '"Noto Serif SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", "SimSun", serif',
          paintOrder: "stroke",
        }}
        stroke={red ? "#fff" : "#fff"}
        strokeWidth={notation === "character" ? 2 : 0}
      >
        {characterFor(type, owner)}
      </text>
    );
  }

  return (
    <g
      color={fill}
      fill="currentColor"
      stroke={stroke}
      strokeWidth={4}
      strokeLinejoin="round"
      aria-label={PIECE_LABELS[type]}
    >
      {ICONS[type]}
    </g>
  );
}

function isChess(type: PieceType): boolean {
  return (
    type === "king" ||
    type === "queen" ||
    type === "rook" ||
    type === "bishop" ||
    type === "knight" ||
    type === "pawn"
  );
}

/** Standalone icon for reserve trays and menus. */
export function PieceIcon({
  type,
  owner,
  notation,
  size = 34,
}: {
  type: PieceType;
  owner: Seat;
  notation: PieceNotation;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img">
      <PieceGlyph type={type} owner={owner} notation={notation} size={size} />
    </svg>
  );
}
