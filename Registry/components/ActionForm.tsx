"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action";

export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  /** Asks the user to confirm before submitting. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={confirm ? (e) => !window.confirm(confirm) && e.preventDefault() : undefined}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="basis-full text-xs text-red-700">{state.error}</p>}
      {state?.message && <p className="basis-full text-xs text-emerald-700">{state.message}</p>}
    </form>
  );
}
