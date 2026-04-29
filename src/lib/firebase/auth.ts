"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./client";

export async function signUp(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(
    doc(db, "users", cred.user.uid),
    {
      email,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
