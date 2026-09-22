"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId);
}

function app(): FirebaseApp {
  if (!firebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local.",
    );
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export function firestore() {
  return getFirestore(app());
}

/**
 * Anonymous sign-in is enough: a uid is all we need to own a seat. Resolves
 * once the user object exists.
 */
export function currentUser(): Promise<User> {
  const auth = getAuth(app());
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          stop();
          resolve(user);
        }
      },
      reject,
    );
    signInAnonymously(auth).catch(reject);
  });
}

/** POST helper that attaches the caller's ID token. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const user = await currentUser();
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
