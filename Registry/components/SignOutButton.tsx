"use client";

import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";

export function SignOutButton() {
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        await signOut(clientAuth()).catch(() => {});
        window.location.href = "/login";
      }}
    >
      Sign out
    </button>
  );
}
