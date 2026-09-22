"use client";

import { Fragment } from "react";
import { PieceGlyph, type PieceNotation } from "./PieceGlyph";
import type { BoardState, MoveTarget, Square } from "@/rules/types";

const CELL = 100;

export interface BoardViewProps {
  board: BoardState;
  notation: PieceNotation;
  /** Draw with the far side at the bottom. */
  flipped?: boolean;
  selected: Square | null;
  /** Destinations for the selected piece. */
  targets: MoveTarget[];
  /** Destinations for a reserve piece that is armed for dropping. */
  dropTargets: Square[];
  lastMove?: { from: Square | null; to: Square } | null;
  checkAt?: Square | null;
  onSquareClick: (sq: Square) => void;
}

export function BoardView(props: BoardViewProps) {
  return props.board.kind === "chess" ? (
    <ChessBoardView {...props} />
  ) : (
    <XiangqiBoardView {...props} />
  );
}

/* --------------------------------------------------------------- helpers */

function useProjection(board: BoardState, flipped: boolean) {
  return (sq: Square) => ({
    col: flipped ? board.width - 1 - sq.f : sq.f,
    row: flipped ? sq.r : board.height - 1 - sq.r,
  });
}

function keyOf(sq: Square) {
  return `${sq.f}-${sq.r}`;
}

function findTarget(targets: MoveTarget[], sq: Square) {
  return targets.find((t) => t.to.f === sq.f && t.to.r === sq.r);
}

function contains(list: Square[], sq: Square) {
  return list.some((s) => s.f === sq.f && s.r === sq.r);
}

/** Every square/point, in render order. */
function allSquares(board: BoardState): Square[] {
  const out: Square[] = [];
  for (let r = 0; r < board.height; r++) {
    for (let f = 0; f < board.width; f++) out.push({ f, r });
  }
  return out;
}

/* ------------------------------------------------------------ chess board */

function ChessBoardView({
  board,
  notation,
  flipped = false,
  selected,
  targets,
  dropTargets,
  lastMove,
  checkAt,
  onSquareClick,
}: BoardViewProps) {
  const project = useProjection(board, flipped);
  const W = board.width * CELL;
  const H = board.height * CELL;
  // The house river runs between ranks 4 and 5.
  const riverY = (board.height / 2) * CELL;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="board board--chess"
      role="group"
      aria-label="Chess board"
    >
      <rect x="0" y="0" width={W} height={H} className="sq-light" />
      {allSquares(board).map((sq) => {
        const { col, row } = project(sq);
        const dark = (sq.f + sq.r) % 2 === 0;
        return dark ? (
          <rect
            key={`bg-${keyOf(sq)}`}
            x={col * CELL}
            y={row * CELL}
            width={CELL}
            height={CELL}
            className="sq-dark"
          />
        ) : null;
      })}

      {/* River: the one house rule written onto the chess board itself. */}
      <g className="river">
        <rect x="0" y={riverY - 10} width={W} height="20" className="river-band" />
        <path
          d={`M0 ${riverY} h${W}`}
          className="river-dash"
          strokeDasharray="18 12"
          fill="none"
        />
        <text
          x={W / 2}
          y={riverY - 18}
          textAnchor="middle"
          className="river-label"
        >
          RIVER
        </text>
      </g>

      {lastMove ? (
        <g className="last-move">
          {lastMove.from ? <Highlight sq={lastMove.from} project={project} /> : null}
          <Highlight sq={lastMove.to} project={project} />
        </g>
      ) : null}

      {selected ? (
        <Highlight sq={selected} project={project} className="selected" />
      ) : null}

      {checkAt ? <Highlight sq={checkAt} project={project} className="check" /> : null}

      {/* Pieces */}
      {allSquares(board).map((sq) => {
        const piece = board.squares[sq.r * board.width + sq.f];
        if (!piece) return null;
        const { col, row } = project(sq);
        const inset = CELL * 0.08;
        const size = CELL - inset * 2;
        return (
          <g
            key={`p-${keyOf(sq)}`}
            transform={`translate(${col * CELL + inset} ${row * CELL + inset}) scale(${size / 100})`}
          >
            <PieceGlyph
              type={piece.type}
              owner={piece.owner}
              notation={notation}
              size={size}
            />
          </g>
        );
      })}

      {/* Legal-move indicators sit above the pieces so captures stay visible */}
      {allSquares(board).map((sq) => {
        const target = findTarget(targets, sq);
        const drop = contains(dropTargets, sq);
        if (!target && !drop) return null;
        const { col, row } = project(sq);
        return (
          <Indicator
            key={`t-${keyOf(sq)}`}
            cx={col * CELL + CELL / 2}
            cy={row * CELL + CELL / 2}
            capture={Boolean(target?.capture)}
            drop={drop}
          />
        );
      })}

      {/* Click surface */}
      {allSquares(board).map((sq) => {
        const { col, row } = project(sq);
        return (
          <rect
            key={`c-${keyOf(sq)}`}
            x={col * CELL}
            y={row * CELL}
            width={CELL}
            height={CELL}
            fill="transparent"
            className="hit"
            onClick={() => onSquareClick(sq)}
          />
        );
      })}
    </svg>
  );
}

function Highlight({
  sq,
  project,
  className = "",
}: {
  sq: Square;
  project: (s: Square) => { col: number; row: number };
  className?: string;
}) {
  const { col, row } = project(sq);
  return (
    <rect
      x={col * CELL}
      y={row * CELL}
      width={CELL}
      height={CELL}
      className={`hl ${className}`}
    />
  );
}

/* ---------------------------------------------------------- xiangqi board */

const MARGIN = 62;

function XiangqiBoardView({
  board,
  notation,
  flipped = false,
  selected,
  targets,
  dropTargets,
  lastMove,
  checkAt,
  onSquareClick,
}: BoardViewProps) {
  const project = useProjection(board, flipped);
  const W = (board.width - 1) * CELL + MARGIN * 2;
  const H = (board.height - 1) * CELL + MARGIN * 2;
  const px = (sq: Square) => {
    const { col, row } = project(sq);
    return { x: MARGIN + col * CELL, y: MARGIN + row * CELL };
  };

  const lastFile = board.width - 1;
  const lastRank = board.height - 1;
  // The river sits between ranks 5 and 6, i.e. rows 4 and 5 from the top.
  const riverTop = MARGIN + 4 * CELL;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="board board--xiangqi"
      role="group"
      aria-label="Xiangqi board"
    >
      <rect x="0" y="0" width={W} height={H} className="xq-bg" />

      {/* File lines break at the river, except the two edges. */}
      {Array.from({ length: board.width }, (_, f) => {
        const x = MARGIN + f * CELL;
        const edge = f === 0 || f === lastFile;
        return edge ? (
          <line
            key={`f-${f}`}
            x1={x}
            y1={MARGIN}
            x2={x}
            y2={MARGIN + lastRank * CELL}
            className="grid"
          />
        ) : (
          <Fragment key={`f-${f}`}>
            <line x1={x} y1={MARGIN} x2={x} y2={riverTop} className="grid" />
            <line
              x1={x}
              y1={riverTop + CELL}
              x2={x}
              y2={MARGIN + lastRank * CELL}
              className="grid"
            />
          </Fragment>
        );
      })}

      {Array.from({ length: board.height }, (_, r) => {
        const y = MARGIN + r * CELL;
        return (
          <line
            key={`r-${r}`}
            x1={MARGIN}
            y1={y}
            x2={MARGIN + lastFile * CELL}
            y2={y}
            className="grid"
          />
        );
      })}

      {/* Palace diagonals, top and bottom. */}
      {[0, 7].map((baseRow) => (
        <Fragment key={`palace-${baseRow}`}>
          <line
            x1={MARGIN + 3 * CELL}
            y1={MARGIN + baseRow * CELL}
            x2={MARGIN + 5 * CELL}
            y2={MARGIN + (baseRow + 2) * CELL}
            className="grid"
          />
          <line
            x1={MARGIN + 5 * CELL}
            y1={MARGIN + baseRow * CELL}
            x2={MARGIN + 3 * CELL}
            y2={MARGIN + (baseRow + 2) * CELL}
            className="grid"
          />
        </Fragment>
      ))}

      <text
        x={MARGIN + 2 * CELL}
        y={riverTop + CELL / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="river-han"
      >
        楚 河
      </text>
      <text
        x={MARGIN + 6 * CELL}
        y={riverTop + CELL / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="river-han"
      >
        漢 界
      </text>

      {lastMove ? (
        <g className="last-move">
          {lastMove.from ? <Spot sq={lastMove.from} px={px} /> : null}
          <Spot sq={lastMove.to} px={px} />
        </g>
      ) : null}
      {selected ? <Spot sq={selected} px={px} className="selected" /> : null}
      {checkAt ? <Spot sq={checkAt} px={px} className="check" /> : null}

      {/* Pieces sit on the intersections as discs. */}
      {allSquares(board).map((sq) => {
        const piece = board.squares[sq.r * board.width + sq.f];
        if (!piece) return null;
        const { x, y } = px(sq);
        const R = CELL * 0.44;
        const red = piece.owner === "xiangqiRed" || piece.owner === "chessWhite";
        const glyph = CELL * 0.62;
        return (
          <g key={`p-${keyOf(sq)}`}>
            <circle cx={x} cy={y} r={R} className="disc" />
            <circle
              cx={x}
              cy={y}
              r={R - 6}
              fill="none"
              className={red ? "ring ring--red" : "ring ring--black"}
            />
            <g
              transform={`translate(${x - glyph / 2} ${y - glyph / 2}) scale(${glyph / 100})`}
            >
              <PieceGlyph
                type={piece.type}
                owner={piece.owner}
                notation={notation}
                size={glyph}
              />
            </g>
          </g>
        );
      })}

      {allSquares(board).map((sq) => {
        const target = findTarget(targets, sq);
        const drop = contains(dropTargets, sq);
        if (!target && !drop) return null;
        const { x, y } = px(sq);
        return (
          <Indicator
            key={`t-${keyOf(sq)}`}
            cx={x}
            cy={y}
            capture={Boolean(target?.capture)}
            drop={drop}
          />
        );
      })}

      {allSquares(board).map((sq) => {
        const { x, y } = px(sq);
        return (
          <rect
            key={`c-${keyOf(sq)}`}
            x={x - CELL / 2}
            y={y - CELL / 2}
            width={CELL}
            height={CELL}
            fill="transparent"
            className="hit"
            onClick={() => onSquareClick(sq)}
          />
        );
      })}
    </svg>
  );
}

function Spot({
  sq,
  px,
  className = "",
}: {
  sq: Square;
  px: (s: Square) => { x: number; y: number };
  className?: string;
}) {
  const { x, y } = px(sq);
  return (
    <rect
      x={x - CELL / 2}
      y={y - CELL / 2}
      width={CELL}
      height={CELL}
      className={`hl ${className}`}
    />
  );
}

/** A dot for a quiet move, a ring for a capture, a square for a drop. */
function Indicator({
  cx,
  cy,
  capture,
  drop,
}: {
  cx: number;
  cy: number;
  capture: boolean;
  drop: boolean;
}) {
  if (capture) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={CELL * 0.42}
        className="ind ind--capture"
        fill="none"
      />
    );
  }
  if (drop) {
    return (
      <rect
        x={cx - CELL * 0.2}
        y={cy - CELL * 0.2}
        width={CELL * 0.4}
        height={CELL * 0.4}
        rx="4"
        className="ind ind--drop"
      />
    );
  }
  return <circle cx={cx} cy={cy} r={CELL * 0.16} className="ind ind--move" />;
}
