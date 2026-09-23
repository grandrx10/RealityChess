import { describe, expect, it } from "vitest";
import { GEOMETRY, partnerOf, teamOf } from "./geometry";
import { pseudoTargets, royalsFacing } from "./movement";
import { initialChessBoard, initialXiangqiBoard } from "./setup";
import {
  allLegalMoves,
  applyMove,
  createMatch,
  legalDropTargets,
  legalTargetsFrom,
  positionKey,
  seatToPlay,
} from "./match";
import type {
  BoardKind,
  BoardState,
  MatchState,
  Piece,
  PieceType,
  Seat,
  Square,
} from "./types";

/* ------------------------------------------------------------- utilities */

interface Placement {
  at: string;
  type: PieceType;
  owner: Seat;
}

/** "c4" -> { f: 2, r: 3 }. Files are letters, ranks are 1-based. */
function sq(name: string): Square {
  return { f: name.charCodeAt(0) - 97, r: Number(name.slice(1)) - 1 };
}

function blankBoard(kind: BoardKind, toMove: Seat): BoardState {
  const g = GEOMETRY[kind];
  return {
    kind,
    width: g.width,
    height: g.height,
    squares: new Array<Piece | null>(g.width * g.height).fill(null),
    toMove,
    castling: { whiteK: false, whiteQ: false, blackK: false, blackQ: false },
    enPassant: null,
    ply: 0,
    lastMove: null,
  };
}

function build(
  kind: BoardKind,
  toMove: Seat,
  placements: Placement[],
): BoardState {
  const board = blankBoard(kind, toMove);
  for (const p of placements) {
    const s = sq(p.at);
    board.squares[s.r * board.width + s.f] = { type: p.type, owner: p.owner };
  }
  return board;
}

/** A match with hand-placed boards, for testing rules in isolation. */
function scenario(opts: {
  chess?: Placement[];
  xiangqi?: Placement[];
  chessToMove?: Seat;
  xiangqiToMove?: Seat;
  reserves?: Partial<Record<Seat, Partial<Record<PieceType, number>>>>;
}): MatchState {
  const match = createMatch("2v2");
  // Only replace a board that the test actually cares about. Blanking the
  // other one would strand its player with no legal move and end the match
  // by stalemate before the move under test is ever played.
  if (opts.chess) {
    match.boards.chess = build("chess", opts.chessToMove ?? "chessWhite", opts.chess);
  } else if (opts.chessToMove) {
    match.boards.chess.toMove = opts.chessToMove;
  }
  if (opts.xiangqi) {
    match.boards.xiangqi = build(
      "xiangqi",
      opts.xiangqiToMove ?? "xiangqiRed",
      opts.xiangqi,
    );
  } else if (opts.xiangqiToMove) {
    match.boards.xiangqi.toMove = opts.xiangqiToMove;
  }
  match.reserves = {
    chessWhite: {},
    chessBlack: {},
    xiangqiRed: {},
    xiangqiBlack: {},
    ...(opts.reserves ?? {}),
  } as MatchState["reserves"];
  match.history = { chess: [], xiangqi: [] };
  return match;
}

function targetNames(squares: Square[]): string[] {
  return squares
    .map((s) => `${String.fromCharCode(97 + s.f)}${s.r + 1}`)
    .sort();
}

/* ----------------------------------------------------------------- perft */

function perft(match: MatchState, seat: Seat, depth: number): number {
  if (depth === 0) return 1;
  const moves = allLegalMoves(match, seat);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) {
    const next = applyMove(match, seat, m);
    const board = next.boards[m.board];
    total += perft(next, board.toMove, depth - 1);
  }
  return total;
}

describe("base engines (perft against published node counts)", () => {
  it("chess: 20 / 400 from the initial position", () => {
    const match = createMatch("2v2");
    expect(perft(match, "chessWhite", 1)).toBe(20);
    expect(perft(match, "chessWhite", 2)).toBe(400);
  });

  it("chess: 8902 at depth 3", () => {
    const match = createMatch("2v2");
    expect(perft(match, "chessWhite", 3)).toBe(8902);
  }, 60_000);

  /*
   * Standard xiangqi is 44 / 1920 here. This variant's horse has no hobbling
   * leg, which frees one extra jump for each horse in the opening position, so
   * these are regression baselines for the variant rather than a check against
   * the published counts. The chess numbers above are still the published ones,
   * since the chess board starts with no horses on it.
   */
  it("xiangqi: 46 / 2096 with the house rule on horses", () => {
    const match = createMatch("2v2");
    expect(perft(match, "xiangqiRed", 1)).toBe(46);
    expect(perft(match, "xiangqiRed", 2)).toBe(2096);
  }, 60_000);
});

/* ------------------------------------------------------------ team wiring */

describe("teams and capture routing", () => {
  it("pairs red with chess black, and xiangqi black with chess white", () => {
    expect(partnerOf("xiangqiRed")).toBe("chessBlack");
    expect(partnerOf("chessBlack")).toBe("xiangqiRed");
    expect(partnerOf("xiangqiBlack")).toBe("chessWhite");
    expect(partnerOf("chessWhite")).toBe("xiangqiBlack");
    expect(teamOf("xiangqiRed")).toBe(teamOf("chessBlack"));
    expect(teamOf("xiangqiBlack")).toBe(teamOf("chessWhite"));
  });

  it("sends a piece captured on the chess board to the xiangqi partner", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
        { at: "d4", type: "rook", owner: "chessWhite" },
        { at: "d7", type: "bishop", owner: "chessBlack" },
      ],
    });
    const next = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("d4"),
      to: sq("d7"),
    });
    expect(next.reserves.xiangqiBlack.bishop).toBe(1);
    expect(next.reserves.chessWhite.bishop).toBeUndefined();
  });

  it("sends a cannon captured by red to the chess black reserve", () => {
    const match = scenario({
      xiangqi: [
        { at: "e1", type: "general", owner: "xiangqiRed" },
        { at: "d10", type: "general", owner: "xiangqiBlack" },
        { at: "a1", type: "chariot", owner: "xiangqiRed" },
        { at: "a5", type: "cannon", owner: "xiangqiBlack" },
      ],
    });
    const next = applyMove(match, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("a1"),
      to: sq("a5"),
    });
    expect(next.reserves.chessBlack.cannon).toBe(1);
  });

  it("returns a promoted piece to the reserve as a pawn", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
        { at: "b7", type: "pawn", owner: "chessWhite" },
        { at: "a8", type: "rook", owner: "chessBlack" },
      ],
    });
    const promoted = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("b7"),
      to: sq("b8"),
      promotion: "queen",
    });
    const queen = promoted.boards.chess.squares[7 * 8 + 1];
    expect(queen?.type).toBe("queen");
    expect(queen?.promoted).toBe(true);

    const taken = applyMove(promoted, "chessBlack", {
      kind: "move",
      board: "chess",
      from: sq("a8"),
      to: sq("b8"),
    });
    // Black captured it, so it feeds black's partner, xiangqiRed -- as a pawn.
    expect(taken.reserves.xiangqiRed.pawn).toBe(1);
    expect(taken.reserves.xiangqiRed.queen).toBeUndefined();
  });
});

/* ------------------------------------------- xiangqi pieces on 8x8 chess */

describe("xiangqi pieces dropped on the chess board", () => {
  it("cannon slides like a rook but needs a screen to capture", () => {
    const board = build("chess", "chessWhite", [
      { at: "a1", type: "cannon", owner: "chessWhite" },
      { at: "a4", type: "pawn", owner: "chessWhite" },
      { at: "a6", type: "pawn", owner: "chessBlack" },
      { at: "d1", type: "pawn", owner: "chessBlack" },
    ]);
    const t = targetNames(pseudoTargets(board, sq("a1")));
    // Quiet slides up to the screen, then jumps it to capture on a6.
    expect(t).toContain("a2");
    expect(t).toContain("a3");
    expect(t).toContain("a6");
    // a4 is its own screen and cannot be taken; a5 is beyond the screen.
    expect(t).not.toContain("a4");
    expect(t).not.toContain("a5");
    // Along the rank there is no screen before d1, so it cannot capture it.
    expect(t).toContain("b1");
    expect(t).toContain("c1");
    expect(t).not.toContain("d1");
  });

  it("horse moves exactly as a chess knight, with no hobbling leg", () => {
    // d5 would block the leg of the jumps to c6 and e6 in standard xiangqi.
    const horse = build("chess", "chessWhite", [
      { at: "d4", type: "horse", owner: "chessWhite" },
      { at: "d5", type: "pawn", owner: "chessWhite" },
    ]);
    const knight = build("chess", "chessWhite", [
      { at: "d4", type: "knight", owner: "chessWhite" },
      { at: "d5", type: "pawn", owner: "chessWhite" },
    ]);
    const horseTargets = targetNames(pseudoTargets(horse, sq("d4")));
    expect(horseTargets).toEqual(targetNames(pseudoTargets(knight, sq("d4"))));
    expect(horseTargets).toContain("c6");
    expect(horseTargets).toContain("e6");
  });

  it("elephant moves two diagonally, is blocked by its eye, and cannot cross the river", () => {
    const board = build("chess", "chessWhite", [
      { at: "c3", type: "elephant", owner: "chessWhite" },
      { at: "b4", type: "pawn", owner: "chessBlack" },
    ]);
    const t = targetNames(pseudoTargets(board, sq("c3")));
    expect(t).toContain("a1");
    expect(t).toContain("e1");
    // a5 and e5 are across the river (ranks 5-8 are the far bank).
    expect(t).not.toContain("e5");
    // b4 blocks the eye toward a5.
    expect(t).not.toContain("a5");
  });

  it("an elephant dropped on the far bank is confined there, not frozen", () => {
    const board = build("chess", "chessWhite", [
      { at: "c7", type: "elephant", owner: "chessWhite" },
    ]);
    const t = targetNames(pseudoTargets(board, sq("c7")));
    // It may roam the far bank...
    expect(t).toContain("a5");
    expect(t).toContain("e5");
    // ...but may not cross back over the river to c5 -> a3/e3.
    expect(t).not.toContain("a3");
    expect(t).not.toContain("e3");
    expect(t.length).toBeGreaterThan(0);
  });

  it("advisor steps one diagonally with no palace, but cannot cross the river", () => {
    const board = build("chess", "chessWhite", [
      { at: "d4", type: "advisor", owner: "chessWhite" },
    ]);
    const t = targetNames(pseudoTargets(board, sq("d4")));
    expect(t).toEqual(["c3", "e3"]);
  });

  it("soldier walks forward, gaining sideways movement past the river", () => {
    const home = build("chess", "chessWhite", [
      { at: "d3", type: "soldier", owner: "chessWhite" },
    ]);
    expect(targetNames(pseudoTargets(home, sq("d3")))).toEqual(["d4"]);

    const across = build("chess", "chessWhite", [
      { at: "d5", type: "soldier", owner: "chessWhite" },
    ]);
    expect(targetNames(pseudoTargets(across, sq("d5")))).toEqual([
      "c5",
      "d6",
      "e5",
    ]);
  });
});

/* ------------------------------------------ chess pieces on 9x10 xiangqi */

describe("chess pieces dropped on the xiangqi board", () => {
  it("ignores the palace and the river", () => {
    const board = build("xiangqi", "xiangqiRed", [
      { at: "e5", type: "bishop", owner: "xiangqiRed" },
    ]);
    const t = targetNames(pseudoTargets(board, sq("e5")));
    // Diagonals run clean across the river onto the far bank.
    expect(t).toContain("a1");
    expect(t).toContain("i9");
    expect(t).toContain("a9");
  });

  it("promotes a pawn on rank 10", () => {
    const match = scenario({
      xiangqi: [
        { at: "e1", type: "general", owner: "xiangqiRed" },
        { at: "d10", type: "general", owner: "xiangqiBlack" },
        { at: "b9", type: "pawn", owner: "xiangqiRed" },
      ],
    });
    const next = applyMove(match, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("b9"),
      to: sq("b10"),
      promotion: "queen",
    });
    const promoted = next.boards.xiangqi.squares[9 * 9 + 1];
    expect(promoted?.type).toBe("queen");
    expect(promoted?.promoted).toBe(true);
  });

  it("gives a dropped pawn no double step on the xiangqi board", () => {
    const board = build("xiangqi", "xiangqiRed", [
      { at: "b2", type: "pawn", owner: "xiangqiRed" },
    ]);
    expect(targetNames(pseudoTargets(board, sq("b2")))).toEqual(["b3"]);
  });
});

/* ------------------------------------------------------------------ drops */

describe("drop placement", () => {
  it("restricts xiangqi-board drops to the dropper's own side of the river", () => {
    const match = scenario({
      xiangqi: [
        { at: "e1", type: "general", owner: "xiangqiRed" },
        { at: "d10", type: "general", owner: "xiangqiBlack" },
      ],
      reserves: { xiangqiRed: { rook: 1 } },
    });
    const targets = legalDropTargets(match, "xiangqiRed", "rook");
    // Red's half is ranks 1-5; every legal square must be inside it.
    expect(targets.every((t) => t.r <= 4)).toBe(true);
    expect(targets.some((t) => t.r === 4)).toBe(true);
    expect(targets.some((t) => t.r === 5)).toBe(false);
  });

  it("allows chess-board drops anywhere, including the far bank", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
      ],
      reserves: { chessWhite: { cannon: 1 } },
    });
    const targets = legalDropTargets(match, "chessWhite", "cannon");
    const asNames = targetNames(targets);
    expect(asNames).toContain("a1");
    expect(asNames).toContain("h8");
    expect(asNames).toContain("d7");
    // Every empty square is fair game: 64 less the two kings.
    expect(targets.length).toBe(62);
  });

  it("refuses to drop a pawn where it could never move again", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
      ],
      reserves: { chessWhite: { pawn: 1 } },
    });
    const asNames = targetNames(legalDropTargets(match, "chessWhite", "pawn"));
    expect(asNames).not.toContain("a8");
    expect(asNames).toContain("a1");
  });

  it("only allows drops that block when the dropper is in check", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
        { at: "a1", type: "rook", owner: "chessBlack" },
      ],
      reserves: { chessWhite: { knight: 1 } },
    });
    const asNames = targetNames(legalDropTargets(match, "chessWhite", "knight"));
    // The only way to answer the rook check by dropping is to block on b1-d1.
    expect(asNames).toEqual(["b1", "c1", "d1"]);
  });
});

/* ----------------------------------------------------- endings and turns */

describe("xiangqi rules and match endings", () => {
  it("forbids moves that leave the generals facing down an open file", () => {
    const match = scenario({
      xiangqi: [
        { at: "e1", type: "general", owner: "xiangqiRed" },
        { at: "e10", type: "general", owner: "xiangqiBlack" },
        // Past the river, so it has sideways moves available to it.
        { at: "e6", type: "soldier", owner: "xiangqiRed" },
      ],
    });
    const board = build("xiangqi", "xiangqiRed", [
      { at: "e1", type: "general", owner: "xiangqiRed" },
      { at: "e10", type: "general", owner: "xiangqiBlack" },
    ]);
    expect(royalsFacing(board)).toBe(true);

    // The soldier is the only thing screening the generals: d6 and f6 are
    // pseudo-legal but would expose them, leaving e7 as the only legal move.
    expect(targetNames(pseudoTargets(match.boards.xiangqi, sq("e6")))).toEqual([
      "d6",
      "e7",
      "f6",
    ]);
    const targets = legalTargetsFrom(match, sq("e6"), "xiangqi");
    expect(targetNames(targets.map((t) => t.to))).toEqual(["e7"]);
  });

  it("ends the whole match on the first checkmate, crediting the right team", () => {
    const match = scenario({
      chess: [
        { at: "h8", type: "king", owner: "chessBlack" },
        { at: "a1", type: "king", owner: "chessWhite" },
        { at: "g1", type: "queen", owner: "chessWhite" },
        // Defends g7 along the long diagonal, so the king cannot take.
        { at: "b2", type: "bishop", owner: "chessWhite" },
      ],
    });
    const next = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("g1"),
      to: sq("g7"),
    });
    expect(next.status).toBe("finished");
    expect(next.result?.reason).toBe("Checkmate");
    expect(next.result?.board).toBe("chess");
    expect(next.result?.winner).toBe(teamOf("chessWhite"));
  });

  it("treats a xiangqi stalemate as a loss, not a draw", () => {
    const match = scenario({
      xiangqi: [
        { at: "e10", type: "general", owner: "xiangqiBlack" },
        { at: "d1", type: "general", owner: "xiangqiRed" },
        // Between them the horses cover d10, f10 and e9 without ever
        // attacking e10 itself: black is smothered but not in check.
        { at: "c8", type: "horse", owner: "xiangqiRed" },
        { at: "g8", type: "horse", owner: "xiangqiRed" },
      ],
      xiangqiToMove: "xiangqiRed",
    });
    // Red shuffles its general; black is left with no legal move, unchecked.
    const next = applyMove(match, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("d1"),
      to: sq("d2"),
    });
    expect(next.status).toBe("finished");
    expect(next.result?.board).toBe("xiangqi");
    expect(next.result?.winner).toBe(teamOf("xiangqiRed"));
    expect(next.result?.reason).toMatch(/Stalemate/);
  });

  it("follows the strict four-turn cycle in 1v1", () => {
    let match = createMatch("1v1");
    expect(match.turnCursor).toBe(0);
    // Only chess white may move first, even though xiangqi red is "to move".
    expect(allLegalMoves(match, "chessWhite").length).toBeGreaterThan(0);
    expect(() =>
      applyMove(match, "xiangqiRed", {
        kind: "move",
        board: "xiangqi",
        from: sq("a1"),
        to: sq("a2"),
      }),
    ).toThrow(/Not your turn/);

    match = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("e2"),
      to: sq("e4"),
    });
    expect(match.turnCursor).toBe(1);
    match = applyMove(match, "chessBlack", {
      kind: "move",
      board: "chess",
      from: sq("e7"),
      to: sq("e5"),
    });
    expect(match.turnCursor).toBe(2);
    match = applyMove(match, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("b3"),
      to: sq("e3"),
    });
    expect(match.turnCursor).toBe(3);
  });

  it("lets both boards move independently in 2v2", () => {
    const match = createMatch("2v2");
    const afterChess = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("e2"),
      to: sq("e4"),
    });
    // Xiangqi red is still free to move: the boards do not share a clock.
    const afterBoth = applyMove(afterChess, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("b3"),
      to: sq("e3"),
    });
    expect(afterBoth.boards.chess.toMove).toBe("chessBlack");
    expect(afterBoth.boards.xiangqi.toMove).toBe("xiangqiBlack");
  });
});

describe("position keys", () => {
  it("distinguishes the two starting positions", () => {
    expect(positionKey(initialChessBoard())).not.toBe(
      positionKey(initialXiangqiBoard()),
    );
  });
});

describe("the full cross-board loop", () => {
  it("carries a captured chess piece into the xiangqi partner's hand and onto the board", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
        { at: "d1", type: "rook", owner: "chessWhite" },
        { at: "d6", type: "knight", owner: "chessBlack" },
      ],
    });

    // 1. Chess White takes a knight.
    const captured = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("d1"),
      to: sq("d6"),
    });
    // 2. It lands in the hand of White's partner, xiangqi Black.
    expect(captured.reserves.xiangqiBlack.knight).toBe(1);

    // 3. Black's half of the xiangqi board is ranks 6-10, so the drop must
    //    land there and nowhere else.
    const drops = legalDropTargets(captured, "xiangqiBlack", "knight");
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every((d) => d.r >= 5)).toBe(true);

    // 4. Play it. Xiangqi Black moves second on that board, so let Red go.
    const afterRed = applyMove(captured, "xiangqiRed", {
      kind: "move",
      board: "xiangqi",
      from: sq("b3"),
      to: sq("e3"),
    });
    // d7: rank 7 carries black's soldiers on the even files, so d is free.
    const target = legalDropTargets(afterRed, "xiangqiBlack", "knight").find(
      (d) => d.f === 3 && d.r === 6,
    )!;
    expect(target).toBeDefined();
    const dropped = applyMove(afterRed, "xiangqiBlack", {
      kind: "drop",
      board: "xiangqi",
      piece: "knight",
      to: target,
    });

    const placed = dropped.boards.xiangqi.squares[6 * 9 + 3];
    expect(placed).toEqual({ type: "knight", owner: "xiangqiBlack" });
    expect(dropped.reserves.xiangqiBlack.knight).toBeUndefined();

    // 5. On the xiangqi board it still moves as a chess knight: eight jumps
    //    from the middle, and no hobbling leg.
    const jumps = targetNames(pseudoTargets(dropped.boards.xiangqi, target));
    expect(jumps).toEqual(["b6", "c5", "c9", "e5", "e9", "f6", "f8"]);
    // b8 is missing only because black's own cannon stands there -- not
    // because of any hobbling leg, which a chess knight does not have.
    expect(jumps).not.toContain("b8");
  });
});

describe("whose seat a client is playing on a board", () => {
  it("follows the clock when one client holds both seats (hot seat)", () => {
    const all: Seat[] = [
      "chessWhite",
      "chessBlack",
      "xiangqiRed",
      "xiangqiBlack",
    ];
    let match = createMatch("2v2");
    expect(seatToPlay(match, all, "chess")).toBe("chessWhite");

    match = applyMove(match, "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("e2"),
      to: sq("e4"),
    });
    // Resolving by board alone would still say chessWhite here, and every
    // click Black made would be discarded.
    expect(seatToPlay(match, all, "chess")).toBe("chessBlack");
    expect(seatToPlay(match, all, "xiangqi")).toBe("xiangqiRed");
  });

  it("returns the single seat an online player holds, in turn or not", () => {
    const mine: Seat[] = ["chessBlack"];
    const match = createMatch("2v2");
    // Not their turn yet, but it is still their seat.
    expect(seatToPlay(match, mine, "chess")).toBe("chessBlack");
    expect(seatToPlay(match, mine, "xiangqi")).toBeNull();
  });
});

describe("last move marker", () => {
  it("records where a piece came from and where it went", () => {
    const match = applyMove(createMatch("2v2"), "chessWhite", {
      kind: "move",
      board: "chess",
      from: sq("e2"),
      to: sq("e4"),
    });
    expect(match.boards.chess.lastMove).toEqual({
      from: sq("e2"),
      to: sq("e4"),
      drop: false,
    });
    // The other board is untouched.
    expect(match.boards.xiangqi.lastMove).toBeNull();
  });

  it("marks a drop as having no origin", () => {
    const match = scenario({
      chess: [
        { at: "e1", type: "king", owner: "chessWhite" },
        { at: "e8", type: "king", owner: "chessBlack" },
      ],
      reserves: { chessWhite: { cannon: 1 } },
    });
    const next = applyMove(match, "chessWhite", {
      kind: "drop",
      board: "chess",
      piece: "cannon",
      to: sq("d4"),
    });
    expect(next.boards.chess.lastMove).toEqual({
      from: null,
      to: sq("d4"),
      drop: true,
    });
  });
});
