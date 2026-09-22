import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Admin SDK, used only inside API routes. It bypasses security rules, which is
 * exactly what we want: clients never write game documents directly, they post
 * a move and the server decides whether it is legal.
 */
function adminApp(): App {
  if (getApps().length) return getApp();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  // Accept either raw JSON or base64, since dashboards mangle newlines.
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const credentials = JSON.parse(json) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

export function db() {
  return getFirestore(adminApp());
}

export function auth() {
  return getAuth(adminApp());
}

/** Resolve the caller from their Firebase ID token. */
export async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Missing auth token");
  try {
    const decoded = await auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new HttpError(401, "Invalid auth token");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  // Rule violations are the caller's fault, not the server's.
  return Response.json({ error: message }, { status: 400 });
}
