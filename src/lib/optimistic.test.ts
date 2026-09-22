import { describe, expect, it } from "vitest";
import { applyMove, createMatch } from "@/rules/match";
import { prunePending, replayPending, type PendingMove } from "./optimistic";
import type { Move, Square } from "@/rules/types";

function sq(name: string): Square {
  return { f: name.charCodeAt(0) - 97, r: Number(name.slice(1)) - 1 };
}

const e2e4: Move = { kind: "move", board: "chess", from: sq("e2"), to: sq("e4") };
const e7e5: Move = { kind: "move", board: "chess", from: sq("e7"), to: sq("e5") };

function pendingMove(
  token: number,
  seat: PendingMove["seat"],
  move: Move,
  acceptedAt: number | null = null,
): PendingMove {
  return { token, seat, move, acceptedAt };
}

describe("optimistic replay", () => {
  it("shows a move immediately, before the server confirms it", () => {
    const server = createMatch("2v2");
    const shown = replayPending(server, [
      pendingMove(1, "chessWhite", e2e4),
    ]);
    // The pawn has moved on the displayed board...
    expect(shown.boards.chess.squares[3 * 8 + 4]?.type).toBe("pawn");
    expect(shown.boards.chess.toMove).toBe("chessBlack");
    // ...while the authoritative state is untouched.
    expect(server.boards.chess.squares[3 * 8 + 4]).toBeNull();
    expect(server.boards.chess.toMove).toBe("chessWhite");
  });

  it("replays several pending moves in order", () => {
    const server = createMatch("2v2");
    const shown = replayPending(server, [
      pendingMove(1, "chessWhite", e2e4),
      pendingMove(2, "chessBlack", e7e5),
    ]);
    expect(shown.boards.chess.squares[3 * 8 + 4]?.owner).toBe("chessWhite");
    expect(shown.boards.chess.squares[4 * 8 + 4]?.owner).toBe("chessBlack");
    expect(shown.boards.chess.toMove).toBe("chessWhite");
  });

  it("skips a pending move the authoritative state has overtaken", () => {
    const server = createMatch("2v2");
    // The server already played this move, so replaying it must not throw or
    // corrupt the board -- it is simply no longer applicable.
    const confirmed = applyMove(server, "chessWhite", e2e4);
    const shown = replayPending(confirmed, [
      pendingMove(1, "chessWhite", e2e4),
    ]);
    expect(shown.boards.chess.toMove).toBe("chessBlack");
    expect(shown.boards.chess.squares[3 * 8 + 4]?.type).toBe("pawn");
    // The pawn did not somehow move twice.
    expect(shown.boards.chess.squares[1 * 8 + 4]).toBeNull();
  });

  it("leaves the board untouched when nothing is pending", () => {
    const server = createMatch("2v2");
    expect(replayPending(server, [])).toBe(server);
  });
});

describe("retiring confirmed moves", () => {
  it("keeps a move the server has not acknowledged yet", () => {
    const pending = [pendingMove(1, "chessWhite", e2e4, null)];
    expect(prunePending(pending, 7)).toHaveLength(1);
  });

  it("keeps an accepted move until the snapshot catches up", () => {
    const pending = [pendingMove(1, "chessWhite", e2e4, 5)];
    // Snapshot is still behind, so the local copy is what should be shown.
    expect(prunePending(pending, 4)).toHaveLength(1);
    // Snapshot has arrived: the authoritative state now contains it.
    expect(prunePending(pending, 5)).toHaveLength(0);
    expect(prunePending(pending, 9)).toHaveLength(0);
  });

  it("retires only the moves that have landed", () => {
    const pending = [
      pendingMove(1, "chessWhite", e2e4, 5),
      pendingMove(2, "chessBlack", e7e5, 6),
      pendingMove(3, "xiangqiRed", e2e4, null),
    ];
    const left = prunePending(pending, 5);
    expect(left.map((p) => p.token)).toEqual([2, 3]);
  });
});
