import { db, errorResponse, HttpError, requireUid } from "@/lib/firebaseAdmin";
import {
  decodeState,
  encodeState,
  seatsFor,
  type MatchDoc,
} from "@/lib/matchDoc";
import { applyMove } from "@/rules/match";
import type { Move, Seat } from "@/rules/types";

export const runtime = "nodejs";

/**
 * The only way a game document ever changes. The server re-runs the same pure
 * rules engine the client uses, inside a transaction, so two boards moving at
 * once in 2v2 can never interleave into a corrupt state.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUid(req);
    const { id } = await params;
    const body = (await req.json()) as { seat?: Seat; move?: Move };
    if (!body.seat || !body.move) throw new HttpError(400, "seat and move are required");

    const ref = db().collection("matches").doc(id);

    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "No such match");
      const doc = snap.data() as MatchDoc;

      if (doc.status !== "active") throw new HttpError(409, "Match is not in play");
      if (!seatsFor(doc, uid).includes(body.seat!))
        throw new HttpError(403, "That is not your seat");

      // Throws RuleError on anything illegal, which surfaces as a 400.
      const next = applyMove(decodeState(doc.state), body.seat!, body.move!);

      tx.update(ref, {
        state: encodeState(next),
        status: next.status === "finished" ? "finished" : "active",
        version: doc.version + 1,
        updatedAt: Date.now(),
      });
      return next.status;
    });

    return Response.json({ ok: true, status: result });
  } catch (e) {
    return errorResponse(e);
  }
}
