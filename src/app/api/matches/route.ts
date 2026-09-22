import { db, errorResponse, requireUid } from "@/lib/firebaseAdmin";
import {
  emptySeats,
  encodeState,
  type MatchDoc,
} from "@/lib/matchDoc";
import { createMatch } from "@/rules/match";
import type { MatchMode } from "@/rules/types";

export const runtime = "nodejs";

/** Create a lobby. It becomes the match document once everybody sits down. */
export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    const body = (await req.json()) as { name?: string; mode?: MatchMode };
    const mode: MatchMode = body.mode === "1v1" ? "1v1" : "2v2";
    const name = (body.name ?? "").trim().slice(0, 40) || "Open table";

    const now = Date.now();
    const doc: MatchDoc = {
      name,
      mode,
      status: "waiting",
      host: uid,
      seats: emptySeats(),
      state: encodeState(createMatch(mode)),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db().collection("matches").add(doc);
    return Response.json({ id: ref.id });
  } catch (e) {
    return errorResponse(e);
  }
}
