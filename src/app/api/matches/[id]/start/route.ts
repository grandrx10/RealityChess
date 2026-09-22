import { db, errorResponse, HttpError, requireUid } from "@/lib/firebaseAdmin";
import { isFull, type MatchDoc } from "@/lib/matchDoc";

export const runtime = "nodejs";

/** The host starts the match once every seat is filled. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUid(req);
    const { id } = await params;
    const ref = db().collection("matches").doc(id);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "No such match");
      const doc = snap.data() as MatchDoc;

      if (doc.host !== uid) throw new HttpError(403, "Only the host can start");
      if (doc.status !== "waiting")
        throw new HttpError(409, "Already started");
      if (!isFull(doc)) throw new HttpError(409, "Seats are still empty");

      tx.update(ref, {
        status: "active",
        version: doc.version + 1,
        updatedAt: Date.now(),
      });
    });

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
