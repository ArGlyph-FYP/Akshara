"use client";

import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { clientAuth } from "@/lib/firebase/client";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        await signOut(clientAuth()).catch(() => {});
        window.location.href = "/login";
      }}
    >
      Sign out
    </Button>
  );
}
