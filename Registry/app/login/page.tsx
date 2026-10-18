"use client";

import { FirebaseError } from "firebase/app";
import {
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clientAuth, startServerSession } from "@/lib/firebase/client";
import { Logo } from "@/components/Logo";

const EMAIL_KEY = "akshara:loginEmail";

type Mode = "password" | "link";
type State = "idle" | "busy" | "linkSent" | "resetSent" | "finishing" | "needEmail";

function message(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(e.code)) {
      return "Firebase didn't accept this email + password. Check both with “Show” (watch for capital letters, spaces or a different saved email), or use “Forgot password?”.";
    }
    if (e.code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes or reset your password.";
    if (e.code === "auth/operation-not-allowed") return "This sign-in method isn't enabled in Firebase Authentication.";
  }
  return e instanceof Error ? e.message : String(e);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function enter(signIn: () => Promise<unknown>) {
    setError(null);
    try {
      await signIn();
      await startServerSession();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(message(e));
      setState("idle");
    }
  }

  function finishLink(address: string) {
    setState("finishing");
    return enter(async () => {
      await signInWithEmailLink(clientAuth(), address, window.location.href);
      try {
        window.localStorage.removeItem(EMAIL_KEY);
      } catch {}
    });
  }

  useEffect(() => {
    if (!isSignInWithEmailLink(clientAuth(), window.location.href)) return;
    setMode("link");
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(EMAIL_KEY);
    } catch {}
    if (saved) void finishLink(saved);
    else setState("needEmail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (state === "needEmail") return finishLink(address);
    setState("busy");
    if (mode === "password") return enter(() => signInWithEmailAndPassword(clientAuth(), address, password.trim()));
    setError(null);
    try {
      await sendSignInLinkToEmail(clientAuth(), address, { url: `${window.location.origin}/login`, handleCodeInApp: true });
      try {
        window.localStorage.setItem(EMAIL_KEY, address);
      } catch {}
      setState("linkSent");
    } catch (err) {
      setError(message(err));
      setState("idle");
    }
  }

  async function forgot() {
    const address = email.trim();
    if (!address) return setError("Enter your email first, then click “Forgot password?”.");
    setError(null);
    try {
      await sendPasswordResetEmail(clientAuth(), address, { url: `${window.location.origin}/login` });
    } catch (e) {
      // Don't reveal whether the address exists.
      if (!(e instanceof FirebaseError && e.code === "auth/user-not-found")) return setError(message(e));
    }
    setState("resetSent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Logo sub="Registry" className="mb-6" />
      <h1 className="h1">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">For the research team. Readers and raters join with the link you send them.</p>

      {state === "linkSent" ? (
        <div className="card mt-6 text-sm">
          We sent a sign-in link to <b>{email}</b>. Open it on this device to continue.
        </div>
      ) : state === "resetSent" ? (
        <div className="card mt-6 space-y-3 text-sm">
          <p>
            If <b>{email}</b> has access, a password-reset email is on its way. Set your password there, then come back
            and sign in.
          </p>
          <button className="btn w-full" onClick={() => setState("idle")}>
            Back to sign in
          </button>
        </div>
      ) : state === "finishing" ? (
        <div className="card mt-6 text-sm">Signing you in…</div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-6 space-y-3">
          {state === "needEmail" ? (
            <p className="text-sm">Confirm the email address the link was sent to.</p>
          ) : (
            <div className="grid grid-cols-2 rounded-md border border-line p-0.5 text-sm">
              {(["password", "link"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`rounded py-1 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-ink"}`}
                >
                  {m === "password" ? "Password" : "Email link"}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "password" && state !== "needEmail" && (
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">Password</label>
                <button type="button" onClick={forgot} className="text-xs text-muted-foreground underline hover:text-ink">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="input pr-14"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}
          <button className="btn btn-primary w-full" disabled={state === "busy"}>
            {state === "needEmail"
              ? "Continue"
              : state === "busy"
                ? "Please wait…"
                : mode === "password"
                  ? "Sign in"
                  : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </main>
  );
}
