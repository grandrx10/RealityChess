import { db, errorResponse, HttpError, requireUid } from "@/lib/firebaseAdmin";
import { validateClaim, type MatchDoc } from "@/lib/matchDoc";
import { SEATS } from "@/rules/geometry";
import type { Seat } from "@/rules/types";

export const runtime = "nodejs";

/**
 * Sit down, or stand up. Run inside a transaction so two people racing for the
 * last seat cannot both win it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUid(req);
    const { id } = await params;
    const body = (await req.json()) as {
      seats?: Seat[];
      release?: boolean;
      name?: string;
    };
    const claim = body.seats ?? [];
    const displayName = (body.name ?? "").trim().slice(0, 24) || "Player";

    const ref = db().collection("matches").doc(id);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "No such match");
      const doc = snap.data() as MatchDoc;

      if (body.release) {
        const seats = { ...doc.seats };
        for (const seat of SEATS) {
          if (seats[seat]?.uid === uid) seats[seat] = null;
        }
        tx.update(ref, {
          seats,
          version: doc.version + 1,
          updatedAt: Date.now(),
        });
        return;
      }

      const problem = validateClaim(doc, claim, uid);
      if (problem) throw new HttpError(409, problem);

      const seats = { ...doc.seats };
      // One body, one set of seats: drop anything this uid already holds.
      for (const seat of SEATS) {
        if (seats[seat]?.uid === uid) seats[seat] = null;
      }
      for (const seat of claim) {
        seats[seat] = { uid, name: displayName };
      }

      tx.update(ref, {
        seats,
        version: doc.version + 1,
        updatedAt: Date.now(),
      });
    });

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
